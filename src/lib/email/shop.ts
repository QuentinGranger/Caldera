import 'server-only';
import type { EmailType, Prisma } from '@/generated/prisma/client';
import { returnReasonLabels } from '@/lib/returns/rules';
import type { ShopEmailSnapshot } from '@/emails/shop';

/**
 * E-mails to the shop itself, through the customer e-mails' outbox (same
 * retries, same idempotency, listed on the order page). Each is written in
 * the transaction of the event it reports: no event, no e-mail; a replayed
 * event, the same e-mail.
 */
export const SHOP_EMAILS = [
  'SHOP_ORDER_PAID',
  'SHOP_ORDER_REVIEW',
  'SHOP_RETURN_REQUESTED',
  'SHOP_REFUND_FAILED',
] as const satisfies readonly EmailType[];
export type ShopEmailType = (typeof SHOP_EMAILS)[number];
export function isShopEmail(type: EmailType): type is ShopEmailType {
  return (SHOP_EMAILS as readonly EmailType[]).includes(type);
}

export type ShopEvent =
  | { type: 'SHOP_ORDER_PAID' }
  | { type: 'SHOP_ORDER_REVIEW'; cause: 'STOCK' | 'STALE_PAYMENT' }
  | { type: 'SHOP_RETURN_REQUESTED'; returnId: string }
  | { type: 'SHOP_REFUND_FAILED'; refundId: string; code: string };

const EMAIL = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;

/** The shop's inbox: NOTIFICATION_EMAIL_TO, else the contact form's. */
export function shopRecipient() {
  for (const value of [
    process.env.NOTIFICATION_EMAIL_TO,
    process.env.CONTACT_EMAIL_TO,
  ]) {
    const address = value?.trim();
    if (address && EMAIL.test(address)) return address;
  }
  return null;
}

/** Queues the shop's e-mail for an event; none without a shop address. */
export async function notifyShop(
  tx: Prisma.TransactionClient,
  orderId: string,
  event: ShopEvent,
) {
  const recipient = shopRecipient();
  if (!recipient) return null;
  const detailId =
    event.type === 'SHOP_RETURN_REQUESTED'
      ? event.returnId
      : event.type === 'SHOP_REFUND_FAILED'
        ? event.refundId
        : null;
  const dedupeKey = detailId
    ? `${orderId}:${event.type}:${detailId}`
    : `${orderId}:${event.type}`;
  const existing = await tx.emailDelivery.findUnique({ where: { dedupeKey } });
  if (existing) return existing;
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: { orderBy: { id: 'asc' } }, addresses: true },
  });
  const address = order.addresses.find((row) => row.role === 'SHIPPING');
  const snapshot: ShopEmailSnapshot = {
    version: 1,
    orderId: order.id,
    orderNumber: order.orderNumber,
    customer: {
      email: order.email,
      phone: order.phone,
      name: address ? `${address.firstName} ${address.lastName}` : null,
    },
    shippingMethod: order.shippingMethodName,
    total: order.totalAmount.toFixed(2),
    shipping: order.shippingAmount.toFixed(2),
    promotionCode: order.promotionCode,
    address: address
      ? [
          `${address.firstName} ${address.lastName}`,
          address.company,
          address.addressLine1,
          address.addressLine2,
          `${address.postalCode} ${address.city}`,
          address.region,
          address.countryCode,
          address.phone,
        ].filter((line): line is string => Boolean(line))
      : [],
    items: order.items.map((item) => ({
      name: item.productName,
      sku: item.sku,
      language: item.language,
      quantity: item.quantity,
      total: item.lineTotal.toFixed(2),
    })),
  };
  if (event.type === 'SHOP_ORDER_PAID') {
    // Read after the sale in the same transaction: what is left now.
    const variants = await tx.productVariant.findMany({
      where: {
        id: {
          in: order.items.flatMap((item) =>
            item.variantId ? [item.variantId] : [],
          ),
        },
      },
      select: {
        sku: true,
        availableQuantity: true,
        lowStockThreshold: true,
      },
      orderBy: { sku: 'asc' },
    });
    snapshot.stock = variants
      .filter((row) => row.availableQuantity <= row.lowStockThreshold)
      .map((row) => ({
        sku: row.sku,
        name:
          order.items.find((item) => item.sku === row.sku)?.productName ??
          row.sku,
        available: row.availableQuantity,
      }));
  }
  if (event.type === 'SHOP_ORDER_REVIEW') snapshot.review = event.cause;
  if (event.type === 'SHOP_RETURN_REQUESTED') {
    const request = await tx.returnRequest.findUniqueOrThrow({
      where: { id: event.returnId },
      include: {
        items: { include: { orderItem: { select: { productName: true } } } },
      },
    });
    snapshot.returnRequest = {
      id: request.id,
      number: request.number,
      reason: returnReasonLabels[request.reason],
      reasonCode: request.reason,
      withdrawal: request.reason === 'WITHDRAWAL',
      message: request.customerMessage,
      items: request.items.map((item) => ({
        name: item.orderItem.productName,
        quantity: item.quantity,
      })),
    };
  }
  if (event.type === 'SHOP_REFUND_FAILED') {
    const refund = await tx.refund.findUniqueOrThrow({
      where: { id: event.refundId },
      select: { amount: true },
    });
    snapshot.refund = {
      amount: refund.amount.toFixed(2),
      code: event.code.slice(0, 64),
    };
  }
  return tx.emailDelivery.create({
    data: {
      orderId,
      type: event.type,
      dedupeKey,
      recipient,
      snapshot: snapshot as unknown as Prisma.InputJsonObject,
    },
  });
}
