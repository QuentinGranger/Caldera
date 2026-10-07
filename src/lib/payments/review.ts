import 'server-only';
import { adminTransaction, audit } from '@/lib/admin/common';
import { AdminError } from '@/lib/admin/validation';
import { getPrisma } from '@/lib/db/prisma';
import { enqueueOrderEmail } from '@/lib/email/outbox';
import { releaseReservations } from '@/lib/inventory/reservations';
import { issueInvoice } from '@/lib/invoices/service';
import { lockOrder } from '@/lib/orders/common';
import { releasePromotion } from '@/lib/promotions/service';
import type { RefundGateway } from '@/lib/refunds/gateway';
import { requestRefund } from '@/lib/refunds/service';
import {
  stripeGateway,
  type Intent,
  type PaymentGateway,
} from '@/lib/stripe/stripe';
import { toStripeAmount } from '@/lib/stripe/amount';

/*
 * Orders held for review (PAYMENT_REVIEW): paid while the stock no longer
 * covered them, or an attempt too old to resume. Each way out ends in a
 * normal state — confirmed, refunded and cancelled, or cancelled unpaid.
 */

/**
 * The money arrived and the stock is back: the order becomes an ordinary
 * paid order (stock taken, invoice, confirmation to the customer).
 */
export async function approveReviewedOrder(adminId: string, orderId: string) {
  return adminTransaction(adminId, async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (order.status !== 'PAYMENT_REVIEW')
      throw new AdminError('Cette commande n’est plus à vérifier.');
    if (order.payment?.status !== 'SUCCEEDED')
      throw new AdminError(
        'Le paiement n’est pas confirmé : vérifiez d’abord auprès de Stripe.',
      );
    const refunds = await tx.refund.count({
      where: {
        orderId,
        status: { in: ['PENDING', 'REQUIRES_ACTION', 'SUCCEEDED'] },
      },
    });
    if (refunds)
      throw new AdminError(
        'Un remboursement est engagé : la commande ne peut plus être validée.',
      );
    if (!order.items.length || order.reservations.length !== order.items.length)
      throw new AdminError(
        'Réservations incohérentes : vérification technique nécessaire.',
      );
    const variantIds: string[] = [];
    for (const row of order.reservations) {
      const item = order.items.find((line) => line.variantId === row.variantId);
      // Held units are taken as they are; released ones only from free stock.
      const changed =
        row.status === 'ACTIVE'
          ? await tx.$executeRaw`UPDATE "ProductVariant" SET "stockQuantity" = "stockQuantity" - ${row.quantity}, "reservedQuantity" = "reservedQuantity" - ${row.quantity}, "updatedAt" = NOW() WHERE "id" = ${row.variantId}::uuid AND "stockQuantity" >= ${row.quantity} AND "reservedQuantity" >= ${row.quantity}`
          : await tx.$executeRaw`UPDATE "ProductVariant" SET "stockQuantity" = "stockQuantity" - ${row.quantity}, "updatedAt" = NOW() WHERE "id" = ${row.variantId}::uuid AND "stockQuantity" - "reservedQuantity" >= ${row.quantity}`;
      if (changed !== 1)
        throw new AdminError(
          `Stock insuffisant pour « ${item?.productName ?? 'un article'} » : réapprovisionnez avant de valider, ou remboursez.`,
        );
      await tx.stockReservation.update({
        where: { id: row.id },
        data: { status: 'CONSUMED' },
      });
      variantIds.push(row.variantId);
    }
    // The customer paid the discounted price: the code counts as used.
    await tx.promotionRedemption.updateMany({
      where: { orderId, status: { in: ['RESERVED', 'RELEASED'] } },
      data: { status: 'CONSUMED' },
    });
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: 'PAID',
        paidAt: order.payment.paidAt ?? new Date(),
        fulfillmentStatus: 'UNFULFILLED',
        cancelledAt: null,
      },
    });
    // As after an ordinary payment (src/lib/payments/events.ts).
    await tx.checkoutSession.updateMany({
      where: { id: order.checkoutSessionId },
      data: { status: 'COMPLETED' },
    });
    await tx.cart.updateMany({
      where: { id: order.checkoutSession.cartId, status: 'ACTIVE' },
      data: { status: 'CONVERTED' },
    });
    await issueInvoice(tx, orderId);
    await enqueueOrderEmail(tx, orderId, 'ORDER_CONFIRMATION');
    await audit(tx, adminId, 'ORDER_REVIEW_APPROVED', 'Order', orderId, {
      orderNumber: order.orderNumber,
    });
    return { orderId, variantIds };
  });
}

/** The order cannot be honoured: refunded in full, cancelled once Stripe confirms. */
export async function refundReviewedOrder(
  adminId: string,
  orderId: string,
  idempotencyKey: string,
  gateway?: RefundGateway,
) {
  const order = await getPrisma().order.findUnique({
    where: { id: orderId },
    select: {
      status: true,
      shippingAmount: true,
      items: { select: { id: true, quantity: true } },
    },
  });
  if (!order) throw new AdminError('Commande introuvable.');
  if (order.status !== 'PAYMENT_REVIEW')
    throw new AdminError('Cette commande n’est plus à vérifier.');
  return requestRefund(
    adminId,
    {
      orderId,
      idempotencyKey,
      lines: order.items.map((item) => ({
        orderItemId: item.id,
        quantity: item.quantity,
      })),
      includeShipping: order.shippingAmount.gt(0),
      amountCents: null,
      reason: 'OTHER',
      note: 'Commande à vérifier annulée : remboursement intégral.',
      restock: false,
      cancelReview: true,
    },
    gateway,
  );
}

export type ReviewCheck =
  | { kind: 'paid' }
  | { kind: 'in_flight'; status: string }
  | { kind: 'cancelled' };

/**
 * An attempt whose answer was lost: asks Stripe what became of it. Money
 * received: recorded, then validate or refund. Still moving: wait. Nothing
 * paid: the order is cancelled and its reservation released.
 */
export async function checkReviewedPayment(
  adminId: string,
  orderId: string,
  gateway: PaymentGateway = stripeGateway,
): Promise<ReviewCheck> {
  const order = await getPrisma().order.findUnique({
    where: { id: orderId },
    select: {
      status: true,
      currency: true,
      totalAmount: true,
      payment: { select: { status: true, providerPaymentIntentId: true } },
    },
  });
  if (!order) throw new AdminError('Commande introuvable.');
  if (order.status !== 'PAYMENT_REVIEW')
    throw new AdminError('Cette commande n’est plus à vérifier.');
  if (order.payment?.status === 'SUCCEEDED') return { kind: 'paid' };
  let intents: Intent[];
  try {
    const known = order.payment?.providerPaymentIntentId;
    if (known) intents = [await gateway.retrieve(known)];
    else if (gateway.findByOrder) intents = await gateway.findByOrder(orderId);
    else throw new AdminError('Recherche Stripe indisponible.');
  } catch (error) {
    if (error instanceof AdminError) throw error;
    throw new AdminError(
      'Stripe n’a pas pu être joint. Réessayez dans quelques minutes.',
    );
  }
  // Only intents created for this very order, for its exact amount.
  const ours = intents.filter(
    (intent) =>
      intent.metadata?.orderId === orderId &&
      intent.amount === toStripeAmount(order.totalAmount) &&
      intent.currency === order.currency.toLowerCase(),
  );
  const paid = ours.find((intent) => intent.status === 'succeeded');
  if (paid) {
    await adminTransaction(adminId, async (tx) => {
      await lockOrder(tx, orderId);
      await tx.payment.update({
        where: { orderId },
        data: {
          providerPaymentIntentId: paid.id,
          status: 'SUCCEEDED',
          paidAt: new Date(),
        },
      });
      await audit(tx, adminId, 'ORDER_REVIEW_PAYMENT_FOUND', 'Order', orderId, {
        intentId: paid.id,
      });
    });
    return { kind: 'paid' };
  }
  const moving = ours.find((intent) =>
    ['processing', 'requires_action', 'requires_capture'].includes(
      intent.status,
    ),
  );
  if (moving) return { kind: 'in_flight', status: moving.status };
  // Nothing paid: no later payment may land on a cancelled order.
  for (const intent of ours)
    if (intent.status !== 'canceled')
      try {
        await gateway.cancel(intent.id);
      } catch {
        throw new AdminError(
          'Stripe n’a pas pu annuler la tentative de paiement. Réessayez dans quelques minutes.',
        );
      }
  await adminTransaction(adminId, async (tx) => {
    const locked = await lockOrder(tx, orderId);
    if (locked.status !== 'PAYMENT_REVIEW')
      throw new AdminError('Cette commande a changé entre-temps.');
    await releaseReservations(tx, locked, false);
    await releasePromotion(tx, orderId);
    await tx.payment.update({
      where: { orderId },
      data: { status: 'CANCELLED' },
    });
    await tx.order.update({
      where: { id: orderId },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
    await tx.checkoutSession.updateMany({
      where: { id: locked.checkoutSessionId },
      data: { status: 'EXPIRED', readyFingerprint: null },
    });
    await audit(tx, adminId, 'ORDER_REVIEW_CANCELLED', 'Order', orderId, {
      intents: ours.map((intent) => intent.id),
    });
  });
  return { kind: 'cancelled' };
}
