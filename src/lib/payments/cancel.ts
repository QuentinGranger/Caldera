import 'server-only';
import { getPrisma } from '@/lib/db/prisma';
import {
  lockOrder,
  orderInclude,
  transaction,
  orderLog,
} from '@/lib/orders/common';
import { releaseReservations } from '@/lib/inventory/reservations';
import { stripeGateway, type PaymentGateway } from '@/lib/stripe/stripe';
import { ensureIntent } from './intents';
import { validateIntent } from './validation';

export type CancelOrderOutcome =
  | { kind: 'cancelled' }
  | { kind: 'already_terminal'; orderStatus: string }
  | { kind: 'in_flight'; intentStatus: string }
  | { kind: 'unchanged' };

export async function cancelOrder(
  orderId: string,
  expired = false,
  gateway: PaymentGateway = stripeGateway,
): Promise<CancelOrderOutcome> {
  // No attempt ever started: releasing inside the same lock prevents a later API call.
  const initial = await transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);

    if (
      ['PAID', 'PAYMENT_REVIEW', 'CANCELLED', 'EXPIRED'].includes(order.status)
    ) {
      return {
        done: true as const,
        outcome: ['CANCELLED', 'EXPIRED'].includes(order.status)
          ? ({ kind: 'cancelled' } as const)
          : ({
              kind: 'already_terminal',
              orderStatus: order.status,
            } as const),
      };
    }

    if (expired && order.reservations.some((r) => r.expiresAt > new Date())) {
      return {
        done: true as const,
        outcome: { kind: 'unchanged' } as const,
      };
    }

    if (!order.payment!.intentStartedAt) {
      await releaseReservations(tx, order, expired);
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: expired ? 'EXPIRED' : 'CANCELLED',
          cancelledAt: new Date(),
        },
      });
      await tx.payment.update({
        where: { orderId },
        data: { status: 'CANCELLED' },
      });
      await tx.checkoutSession.update({
        where: { id: order.checkoutSessionId },
        data: { status: 'EXPIRED', readyFingerprint: null },
      });

      return {
        done: true as const,
        outcome: { kind: 'cancelled' } as const,
      };
    }

    return {
      done: false as const,
      outcome: null,
    };
  });

  if (initial.done) return initial.outcome;

  // Recover ambiguous creation with the SAME idempotency key before attempting cancellation.
  let intent = await ensureIntent(orderId, gateway);

  if (['processing', 'succeeded', 'requires_capture'].includes(intent.status)) {
    return {
      kind: 'in_flight',
      intentStatus: intent.status,
    };
  }

  if (intent.status !== 'canceled') {
    try {
      intent = await gateway.cancel(intent.id);
    } catch {
      intent = await gateway.retrieve(intent.id);
    }
  }

  if (intent.status !== 'canceled') {
    return {
      kind: 'in_flight',
      intentStatus: intent.status,
    };
  }

  const finalStatus = await transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    validateIntent(order, intent);

    if (
      ['PAID', 'PAYMENT_REVIEW', 'CANCELLED', 'EXPIRED'].includes(order.status)
    ) {
      return order.status;
    }

    await releaseReservations(tx, order, expired);
    await tx.payment.update({
      where: { orderId },
      data: { status: 'CANCELLED' },
    });
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: expired ? 'EXPIRED' : 'CANCELLED',
        cancelledAt: new Date(),
      },
    });
    await tx.checkoutSession.update({
      where: { id: order.checkoutSessionId },
      data: { status: 'EXPIRED', readyFingerprint: null },
    });

    return expired ? 'EXPIRED' : 'CANCELLED';
  });

  if (['CANCELLED', 'EXPIRED'].includes(finalStatus)) {
    orderLog('reservation_released', orderId, { intentId: intent.id });
    return { kind: 'cancelled' };
  }

  if (['PAID', 'PAYMENT_REVIEW'].includes(finalStatus)) {
    return {
      kind: 'already_terminal',
      orderStatus: finalStatus,
    };
  }

  return { kind: 'unchanged' };
}

export async function expireReservations(
  gateway: PaymentGateway = stripeGateway,
) {
  const rows = await getPrisma().order.findMany({
    where: {
      status: {
        in: ['PENDING_PAYMENT', 'PAYMENT_FAILED', 'PAYMENT_PROCESSING'],
      },
      reservations: {
        some: { status: 'ACTIVE', expiresAt: { lte: new Date() } },
      },
    },
    select: { id: true },
    orderBy: { updatedAt: 'asc' },
    take: 100,
  });

  let failures = 0;

  for (const row of rows) {
    try {
      await cancelOrder(row.id, true, gateway);
    } catch {
      failures++;
      orderLog('expiration_retry_needed', row.id);
    }
  }

  return { inspected: rows.length, failures };
}

export async function currentOrder(orderId: string) {
  return getPrisma().order.findUniqueOrThrow({
    where: { id: orderId },
    include: orderInclude,
  });
}
