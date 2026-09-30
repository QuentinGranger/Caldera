import 'server-only';
import type { Prisma, EmailType } from '@/generated/prisma/client';

/** What a refund e-mail tells: amount, shipping part and refunded lines. */
export type RefundEmailInput = {
  id: string;
  amount: string;
  shippingAmount: string;
  items: { name: string; quantity: number; amount: string }[];
};

/**
 * One e-mail per event: per (order, type), and per refund for ORDER_REFUNDED
 * (several partial refunds may follow each other).
 */
export async function enqueueOrderEmail(
  tx: Prisma.TransactionClient,
  orderId: string,
  type: EmailType,
  refund?: RefundEmailInput,
) {
  if ((type === 'ORDER_REFUNDED') !== Boolean(refund))
    throw new Error('Un e-mail de remboursement décrit un remboursement.');
  const dedupeKey = refund
    ? `${orderId}:${type}:${refund.id}`
    : `${orderId}:${type}`;
  const existing = await tx.emailDelivery.findUnique({
    where: { dedupeKey },
  });
  if (existing) return existing;
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      payment: true,
      items: { orderBy: { id: 'asc' } },
      addresses: true,
      shipments: { where: { isPrimary: true } },
    },
  });
  if (order.status !== 'PAID' || order.payment?.status !== 'SUCCEEDED')
    throw new Error('Email réservé aux commandes payées.');
  const shipment = order.shipments[0];
  if (
    type === 'ORDER_SHIPPED' &&
    (!shipment || !['SHIPPED', 'DELIVERED'].includes(shipment.status))
  )
    throw new Error('Expédition non confirmée.');
  const address = order.addresses.find((row) => row.role === 'SHIPPING');
  const snapshot = {
    version: 1,
    orderNumber: order.orderNumber,
    publicId: order.publicId,
    shippingMethod: order.shippingMethodName,
    subtotal: order.subtotalAmount.toFixed(2),
    shipping: order.shippingAmount.toFixed(2),
    total: order.totalAmount.toFixed(2),
    ...(order.promotionCode
      ? {
          discount: {
            code: order.promotionCode,
            amount: order.discountAmount.toFixed(2),
            shipping: order.shippingDiscountAmount.toFixed(2),
          },
        }
      : {}),
    address: address
      ? [
          `${address.firstName} ${address.lastName}`,
          address.company,
          address.addressLine1,
          address.addressLine2,
          `${address.postalCode} ${address.city}`,
          address.region,
          address.countryCode,
        ].filter((line): line is string => Boolean(line))
      : [],
    items: order.items.map((item) => ({
      name: item.productName,
      sku: item.sku,
      language: item.language,
      quantity: item.quantity,
      unitPrice: item.unitPrice.toFixed(2),
      total: item.lineTotal.toFixed(2),
    })),
    shipment:
      type === 'ORDER_SHIPPED' && shipment
        ? {
            carrier: shipment.carrierName,
            trackingNumber: shipment.trackingNumber,
            trackingUrl: shipment.trackingUrl,
          }
        : null,
    ...(refund
      ? {
          refund: {
            amount: refund.amount,
            shipping: refund.shippingAmount,
            items: refund.items,
          },
        }
      : {}),
  };
  return tx.emailDelivery.create({
    data: { orderId, type, dedupeKey, recipient: order.email, snapshot },
  });
}
