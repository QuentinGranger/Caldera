import 'server-only';
import type { RefundReason, RefundStatus } from '@/generated/prisma/client';
import { adminTransaction, audit } from '@/lib/admin/common';
import { changeStock } from '@/lib/admin/inventory';
import { AdminError } from '@/lib/admin/validation';
import { invalidateCatalogCache } from '@/lib/cache/catalogCache';
import { getPrisma } from '@/lib/db/prisma';
import { enqueueOrderEmail } from '@/lib/email/outbox';
import { lockOrder, transaction } from '@/lib/orders/common';
import {
  allocateRefund,
  fromCents,
  lineRefundCents,
  refundState,
  stripeReason,
  toCents,
} from './amounts';
import {
  RefundProviderError,
  stripeRefundGateway,
  type ProviderRefund,
  type RefundGateway,
} from './gateway';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Stripe keeps idempotency keys 24 hours: a refund unanswered for longer is checked by hand. */
const RETRY_WINDOW_MS = 23 * 60 * 60_000;
const SYNC_DELAY_MS = 2 * 60_000;

export type RefundRequest = {
  orderId: string;
  /** Generated with the form: a double submission creates one refund. */
  idempotencyKey: string;
  lines: { orderItemId: string; quantity: number }[];
  includeShipping: boolean;
  /** Lower amount (goodwill) or the amount of a refund without items. */
  amountCents: number | null;
  reason: RefundReason;
  note: string;
  restock: boolean;
  /** The customer return this refund settles (linked in the same transaction). */
  returnId?: string;
};

function statusOf(provider: ProviderRefund): RefundStatus {
  switch (provider.status) {
    case 'succeeded':
      return 'SUCCEEDED';
    case 'failed':
      return 'FAILED';
    case 'canceled':
      return 'CANCELED';
    case 'requires_action':
      return 'REQUIRES_ACTION';
    default:
      return 'PENDING';
  }
}

/** Step 1: checks the request against what is left and records it, order locked. */
async function reserveRefund(adminId: string, request: RefundRequest) {
  return adminTransaction(adminId, async (tx) => {
    const existing = await tx.refund.findUnique({
      where: { idempotencyKey: request.idempotencyKey },
    });
    if (existing) {
      if (existing.orderId !== request.orderId)
        throw new AdminError('Formulaire invalide : rechargez la commande.');
      return existing;
    }
    const order = await lockOrder(tx, request.orderId);
    const payment = order.payment;
    if (
      order.status !== 'PAID' ||
      payment?.status !== 'SUCCEEDED' ||
      !payment.providerPaymentIntentId
    )
      throw new AdminError(
        'Seule une commande payée, dont le paiement Stripe est confirmé, peut être remboursée.',
      );
    const refunds = await tx.refund.findMany({
      where: { orderId: order.id },
      include: { items: { select: { orderItemId: true, quantity: true } } },
    });
    const state = refundState(
      {
        amount: payment.amount.toFixed(2),
        shipping: order.shippingAmount.toFixed(2),
      },
      refunds,
    );
    if (!state.remainingCents)
      throw new AdminError('Cette commande est déjà entièrement remboursée.');
    // Stripe may still create an unanswered refund: never stack another one.
    if (
      refunds.some(
        (refund) => refund.status === 'PENDING' && !refund.providerRefundId,
      )
    )
      throw new AdminError(
        'Un remboursement attend encore la réponse de Stripe. Synchronisez avec Stripe avant d’en faire un autre.',
      );

    const lines = [];
    const seen = new Set<string>();
    for (const line of request.lines) {
      if (seen.has(line.orderItemId))
        throw new AdminError('Formulaire invalide : rechargez la commande.');
      seen.add(line.orderItemId);
      if (!line.quantity) continue;
      const item = order.items.find((row) => row.id === line.orderItemId);
      if (!item)
        throw new AdminError('Article introuvable dans cette commande.');
      const refunded = state.refundedQuantities.get(item.id) ?? 0;
      const left = item.quantity - refunded;
      if (
        !Number.isInteger(line.quantity) ||
        line.quantity < 0 ||
        line.quantity > left
      )
        throw new AdminError(
          `Quantité invalide pour « ${item.productName} » : ${left} au plus.`,
        );
      lines.push({
        orderItemId: item.id,
        nominalCents: lineRefundCents(
          toCents(item.lineTotal) - toCents(item.discountAmount),
          item.quantity,
          refunded,
          line.quantity,
        ),
        quantity: line.quantity,
      });
    }
    const shippingCents = request.includeShipping
      ? state.shippingRemainingCents
      : 0;
    if (request.includeShipping && !shippingCents)
      throw new AdminError('Les frais de livraison sont déjà remboursés.');
    const nominal =
      lines.reduce((sum, line) => sum + line.nominalCents, 0) + shippingCents;
    const amountCents = request.amountCents ?? nominal;
    if (!amountCents || amountCents < 1)
      throw new AdminError(
        'Choisissez des articles, les frais de livraison ou un montant à rembourser.',
      );
    if (nominal && amountCents > nominal)
      throw new AdminError(
        `Le montant ne peut pas dépasser celui des éléments sélectionnés (${fromCents(nominal)} €).`,
      );
    if (amountCents > state.remainingCents)
      throw new AdminError(
        `Le montant dépasse le reste remboursable (${fromCents(state.remainingCents)} €).`,
      );
    if (request.restock && !lines.length)
      throw new AdminError('Sélectionnez les articles à remettre en stock.');
    const allocation = allocateRefund({
      lines,
      shippingCents,
      amountCents: nominal ? amountCents : 0,
    });
    if (request.returnId) {
      await tx.$queryRaw`SELECT id FROM "ReturnRequest" WHERE id = ${request.returnId}::uuid FOR UPDATE`;
      const linked = await tx.returnRequest.findUnique({
        where: { id: request.returnId },
        include: { refund: { select: { status: true } } },
      });
      if (!linked || linked.orderId !== order.id)
        throw new AdminError('Retour introuvable pour cette commande.');
      if (!['REQUESTED', 'APPROVED', 'RECEIVED'].includes(linked.status))
        throw new AdminError('Ce retour est déjà clos.');
      if (
        linked.refund &&
        ['PENDING', 'REQUIRES_ACTION', 'SUCCEEDED'].includes(
          linked.refund.status,
        )
      )
        throw new AdminError('Ce retour a déjà un remboursement en cours.');
    }
    const refund = await tx.refund.create({
      data: {
        orderId: order.id,
        paymentId: payment.id,
        amount: fromCents(amountCents),
        shippingAmount: fromCents(allocation.shippingCents),
        currency: payment.currency,
        reason: request.reason,
        note: request.note || null,
        restock: request.restock,
        createdById: adminId,
        idempotencyKey: request.idempotencyKey,
        items: {
          create: allocation.items.map((item) => ({
            orderItemId: item.orderItemId,
            quantity: item.quantity,
            amount: fromCents(item.cents),
          })),
        },
      },
    });
    if (request.returnId)
      await tx.returnRequest.update({
        where: { id: request.returnId },
        data: { refundId: refund.id },
      });
    await audit(tx, adminId, 'REFUND_REQUESTED', 'Order', order.id, {
      refundId: refund.id,
      amount: fromCents(amountCents),
      reason: request.reason,
      restock: request.restock,
      ...(request.returnId ? { returnId: request.returnId } : {}),
    });
    return refund;
  });
}

/** Only a refund Stripe never acknowledged: a known Stripe refund follows Stripe. */
async function markFailed(refundId: string, code: string) {
  await transaction(async (tx) => {
    const { count } = await tx.refund.updateMany({
      where: { id: refundId, status: 'PENDING', providerRefundId: null },
      data: { status: 'FAILED', failureReason: code.slice(0, 64) },
    });
    if (!count) return;
    const refund = await tx.refund.findUniqueOrThrow({
      where: { id: refundId },
    });
    if (refund.createdById)
      await audit(
        tx,
        refund.createdById,
        'REFUND_FAILED',
        'Order',
        refund.orderId,
        {
          refundId,
          code,
        },
      );
  });
}

/**
 * Step 2: asks Stripe, always with the same idempotency key. A refusal is
 * final; an unanswered call stays PENDING and is retried by syncRefunds.
 */
async function submitToProvider(refundId: string, gateway: RefundGateway) {
  const refund = await getPrisma().refund.findUniqueOrThrow({
    where: { id: refundId },
    include: {
      order: { select: { orderNumber: true } },
      payment: { select: { providerPaymentIntentId: true } },
    },
  });
  try {
    const provider = await gateway.create(
      {
        paymentIntent: refund.payment.providerPaymentIntentId!,
        amount: toCents(refund.amount),
        reason: stripeReason(refund.reason),
        metadata: {
          refundId: refund.id,
          orderId: refund.orderId,
          orderNumber: refund.order.orderNumber,
        },
      },
      `caldera-refund:${refund.id}`,
    );
    await applyProviderRefund(refund.id, provider);
  } catch (error) {
    if (!(error instanceof RefundProviderError)) throw error;
    if (error.definitive) await markFailed(refund.id, error.code);
    else
      await getPrisma().refund.updateMany({
        where: { id: refund.id, providerRefundId: null },
        data: { failureReason: error.code },
      });
  }
}

/**
 * Applies the state Stripe reports. Once it succeeds, and only once: items go
 * back on sale if asked, the customer is e-mailed and the refund is audited.
 */
export async function applyProviderRefund(
  refundId: string,
  provider: ProviderRefund,
  eventId?: string,
) {
  const restocked = await transaction(async (tx) => {
    if (
      eventId &&
      (await tx.stripeWebhookEvent.findUnique({
        where: { stripeEventId: eventId },
      }))
    )
      return false;
    await tx.$queryRaw`SELECT id FROM "Refund" WHERE id = ${refundId}::uuid FOR UPDATE`;
    const refund = await tx.refund.findUniqueOrThrow({
      where: { id: refundId },
      include: {
        items: { include: { orderItem: true } },
        payment: { select: { providerPaymentIntentId: true } },
        order: { select: { orderNumber: true } },
      },
    });
    // Never trust an object that does not match what was asked.
    if (
      provider.paymentIntentId !== refund.payment.providerPaymentIntentId ||
      provider.currency.toUpperCase() !== refund.currency.toUpperCase() ||
      provider.amount !== toCents(refund.amount) ||
      (refund.providerRefundId && refund.providerRefundId !== provider.id)
    )
      throw new Error('REMBOURSEMENT_INCOHERENT');
    const status = statusOf(provider);
    const now = new Date();
    await tx.refund.update({
      where: { id: refund.id },
      data: {
        providerRefundId: provider.id,
        status,
        failureReason:
          status === 'FAILED' || status === 'CANCELED'
            ? (provider.failureReason ?? 'REFUS_STRIPE').slice(0, 64)
            : null,
        succeededAt:
          status === 'SUCCEEDED' ? (refund.succeededAt ?? now) : undefined,
      },
    });
    // Stripe can refuse later, even after a success (closed card): recorded
    // so the order shows why the money did not go back.
    if (
      (status === 'FAILED' || status === 'CANCELED') &&
      refund.status !== status &&
      refund.createdById
    )
      await audit(
        tx,
        refund.createdById,
        'REFUND_FAILED',
        'Order',
        refund.orderId,
        {
          refundId: refund.id,
          code: provider.failureReason ?? 'REFUS_STRIPE',
        },
      );
    let restockedNow = false;
    if (status === 'SUCCEEDED' && !refund.settledAt) {
      if (refund.restock && refund.createdById) {
        for (const item of refund.items)
          if (item.orderItem.variantId)
            await changeStock(
              tx,
              refund.createdById,
              item.orderItem.variantId,
              {
                quantity: item.quantity,
                mode: 'delta',
                type: 'RETURN',
                reason: `Remboursement ${refund.order.orderNumber}`,
              },
            );
        restockedNow = true;
      }
      await enqueueOrderEmail(tx, refund.orderId, 'ORDER_REFUNDED', {
        id: refund.id,
        amount: refund.amount.toFixed(2),
        shippingAmount: refund.shippingAmount.toFixed(2),
        items: refund.items.map((item) => ({
          name: item.orderItem.productName,
          quantity: item.quantity,
          amount: item.amount.toFixed(2),
        })),
      });
      if (refund.createdById)
        await audit(
          tx,
          refund.createdById,
          'REFUND_SUCCEEDED',
          'Order',
          refund.orderId,
          {
            refundId: refund.id,
            amount: refund.amount.toFixed(2),
            restocked: restockedNow,
          },
        );
      await tx.refund.update({
        where: { id: refund.id },
        data: { settledAt: now, restockedAt: restockedNow ? now : null },
      });
      // The return it settles is closed.
      await tx.returnRequest.updateMany({
        where: {
          refundId: refund.id,
          status: { in: ['REQUESTED', 'APPROVED', 'RECEIVED'] },
        },
        data: { status: 'REFUNDED', refundedAt: now, closedAt: now },
      });
    }
    if (eventId)
      await tx.stripeWebhookEvent.create({
        data: { stripeEventId: eventId, type: 'refund', processedAt: now },
      });
    return restockedNow;
  });
  // Refunded items are on sale again: stock texts must not lag.
  if (restocked) invalidateCatalogCache();
}

export type RefundOutcome = {
  id: string;
  amount: string;
  status: RefundStatus;
  sent: boolean;
  failureReason: string | null;
};

/** Refunds the order from the administration (see the form on the order page). */
export async function requestRefund(
  adminId: string,
  request: RefundRequest,
  gateway: RefundGateway = stripeRefundGateway,
): Promise<RefundOutcome> {
  const reserved = await reserveRefund(adminId, request);
  // A second click on the same form only reports the first result.
  if (reserved.status === 'PENDING' && !reserved.providerRefundId)
    await submitToProvider(reserved.id, gateway);
  const refund = await getPrisma().refund.findUniqueOrThrow({
    where: { id: reserved.id },
  });
  return {
    id: refund.id,
    amount: refund.amount.toFixed(2),
    status: refund.status,
    sent: Boolean(refund.providerRefundId),
    failureReason: refund.failureReason,
  };
}

async function localRefundId(provider: ProviderRefund) {
  const db = getPrisma();
  const known = await db.refund.findUnique({
    where: { providerRefundId: provider.id },
    select: { id: true },
  });
  if (known) return known.id;
  const id = provider.metadata.refundId;
  if (id && UUID.test(id)) {
    const asked = await db.refund.findUnique({
      where: { id },
      select: { id: true },
    });
    if (asked) return asked.id;
  }
  return null;
}

/** A refund made in the Stripe Dashboard is recorded so the order stays exact. */
async function recordExternalRefund(provider: ProviderRefund) {
  if (!provider.paymentIntentId) return null;
  const db = getPrisma();
  const payment = await db.payment.findUnique({
    where: { providerPaymentIntentId: provider.paymentIntentId },
    select: { id: true, orderId: true, currency: true },
  });
  if (!payment) return null;
  const key = `stripe:${provider.id}`;
  const refund = await db.refund.upsert({
    where: { idempotencyKey: key },
    create: {
      orderId: payment.orderId,
      paymentId: payment.id,
      amount: fromCents(provider.amount),
      currency: payment.currency,
      reason: 'OTHER',
      note: 'Remboursement effectué depuis le Dashboard Stripe.',
      providerRefundId: provider.id,
      idempotencyKey: key,
    },
    update: {},
    select: { id: true },
  });
  return refund.id;
}

/** Signature-verified webhook adapter only, with a freshly retrieved refund. */
export async function processRefundEvent(
  eventId: string,
  provider: ProviderRefund,
) {
  if (
    await getPrisma().stripeWebhookEvent.findUnique({
      where: { stripeEventId: eventId },
    })
  )
    return;
  const refundId =
    (await localRefundId(provider)) ?? (await recordExternalRefund(provider));
  if (refundId) await applyProviderRefund(refundId, provider, eventId);
}

/**
 * Refunds still pending: re-read from Stripe, resent when Stripe never
 * answered (same key, within 24 hours), otherwise left for a manual check.
 */
export async function syncRefunds(
  options: {
    gateway?: RefundGateway;
    limit?: number;
    orderId?: string;
    now?: Date;
  } = {},
) {
  const gateway = options.gateway ?? stripeRefundGateway;
  const now = options.now ?? new Date();
  const pending = await getPrisma().refund.findMany({
    where: {
      status: { in: ['PENDING', 'REQUIRES_ACTION'] },
      ...(options.orderId
        ? { orderId: options.orderId }
        : { updatedAt: { lt: new Date(now.getTime() - SYNC_DELAY_MS) } }),
    },
    orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
    take: options.limit ?? 10,
  });
  let synced = 0;
  let failed = 0;
  for (const refund of pending) {
    try {
      if (refund.providerRefundId)
        await applyProviderRefund(
          refund.id,
          await gateway.retrieve(refund.providerRefundId),
        );
      else if (now.getTime() - refund.createdAt.getTime() < RETRY_WINDOW_MS)
        await submitToProvider(refund.id, gateway);
      else await markFailed(refund.id, 'VERIFICATION_STRIPE_REQUISE');
      synced++;
    } catch {
      failed++;
      // Pushed back so one stuck refund never blocks the others.
      await getPrisma().refund.update({
        where: { id: refund.id },
        data: { updatedAt: now },
      });
    }
  }
  return { synced, failed };
}
