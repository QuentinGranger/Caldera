import 'server-only';
import { enqueueOrderEmail } from '@/lib/email/outbox';
import { getPrisma } from '@/lib/db/prisma';
import {
  lockOrder,
  orderLog,
  transaction,
  OrderError,
} from '@/lib/orders/common';
import {
  canConsume,
  consumeReservations,
  releaseReservations,
} from '@/lib/inventory/reservations';
import type { Intent } from '@/lib/stripe/stripe';
import { validateIntent } from './validation';

export const paymentEvents = new Set([
  'payment_intent.succeeded',
  'payment_intent.processing',
  'payment_intent.payment_failed',
  'payment_intent.canceled',
  'payment_intent.requires_action',
]);
/** Only called by the signature-verified webhook adapter, with a freshly retrieved intent. */
export async function processPaymentEvent(
  eventId: string,
  type: string,
  intent: Intent,
) {
  if (!paymentEvents.has(type)) return;
  if (
    await getPrisma().stripeWebhookEvent.findUnique({
      where: { stripeEventId: eventId },
    })
  )
    return;
  const payment = await getPrisma().payment.findUnique({
    where: { providerPaymentIntentId: intent.id },
  });
  const orderId = payment?.orderId ?? intent.metadata.orderId;
  if (!orderId || !/^[a-f0-9-]{36}$/i.test(orderId)) return; // unrelated account event
  const exists = await getPrisma().order.findUnique({
    where: { id: orderId },
    select: { id: true },
  });
  if (!exists) return;
  const status = await transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (
      await tx.stripeWebhookEvent.findUnique({
        where: { stripeEventId: eventId },
      })
    )
      return order.status;
    validateIntent(order, intent);
    if (!order.payment!.intentStartedAt)
      throw new OrderError('Tentative Stripe non initialisée.');
    await tx.stripeWebhookEvent.create({
      data: { stripeEventId: eventId, type, processedAt: new Date() },
    });
    if (order.status === 'PAID') return order.status;
    if (order.status === 'PAYMENT_REVIEW') {
      if (intent.status === 'succeeded')
        await tx.payment.update({
          where: { orderId },
          data: {
            providerPaymentIntentId: intent.id,
            status: 'SUCCEEDED',
            paidAt: order.payment!.paidAt ?? new Date(),
          },
        });
      return order.status;
    }
    const now = new Date();
    await tx.payment.update({
      where: { orderId },
      data: { providerPaymentIntentId: intent.id },
    });
    if (intent.status === 'succeeded') {
      await tx.payment.update({
        where: { orderId },
        data: { status: 'SUCCEEDED', paidAt: now },
      });
      if (!(await canConsume(tx, order))) {
        await tx.order.update({
          where: { id: orderId },
          data: { status: 'PAYMENT_REVIEW' },
        });
        return 'PAYMENT_REVIEW';
      }
      await consumeReservations(tx, order);
      await tx.order.update({
        where: { id: orderId },
        data: { status: 'PAID', paidAt: now, fulfillmentStatus: 'UNFULFILLED' },
      });
      await tx.checkoutSession.update({
        where: { id: order.checkoutSessionId },
        data: { status: 'COMPLETED' },
      });
      await tx.cart.update({
        where: { id: order.checkoutSession.cartId },
        data: { status: 'CONVERTED' },
      });
      await enqueueOrderEmail(tx, orderId, 'ORDER_CONFIRMATION');
      return 'PAID';
    }
    if (['CANCELLED', 'EXPIRED'].includes(order.status)) return order.status;
    if (intent.status === 'canceled') {
      const expired = order.reservations.every((r) => r.expiresAt <= now);
      await releaseReservations(tx, order, expired);
      await tx.payment.update({
        where: { orderId },
        data: { status: 'CANCELLED' },
      });
      await tx.order.update({
        where: { id: orderId },
        data: { status: expired ? 'EXPIRED' : 'CANCELLED', cancelledAt: now },
      });
      await tx.checkoutSession.update({
        where: { id: order.checkoutSessionId },
        data: { status: 'EXPIRED', readyFingerprint: null },
      });
      return expired ? 'EXPIRED' : 'CANCELLED';
    }
    const next =
      intent.status === 'processing' || intent.status === 'requires_capture'
        ? 'PAYMENT_PROCESSING'
        : intent.status === 'requires_payment_method' &&
            type === 'payment_intent.payment_failed'
          ? 'PAYMENT_FAILED'
          : 'PENDING_PAYMENT';
    await tx.payment.update({
      where: { orderId },
      data: {
        status:
          next === 'PAYMENT_PROCESSING'
            ? 'PROCESSING'
            : next === 'PAYMENT_FAILED'
              ? 'FAILED'
              : intent.status === 'requires_action'
                ? 'REQUIRES_ACTION'
                : 'REQUIRES_PAYMENT_METHOD',
      },
    });
    await tx.order.update({ where: { id: orderId }, data: { status: next } });
    return next;
  });
  orderLog('webhook_processed', orderId, {
    eventId,
    intentId: intent.id,
    status,
  });
}
