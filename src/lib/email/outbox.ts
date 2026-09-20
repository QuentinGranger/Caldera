import 'server-only';
import type { Prisma, EmailType } from '@/generated/prisma/client';
export async function enqueueOrderEmail(
  tx: Prisma.TransactionClient,
  orderId: string,
  type: EmailType,
) {
  const existing = await tx.emailDelivery.findUnique({
    where: { orderId_type: { orderId, type } },
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
  };
  return tx.emailDelivery.create({
    data: { orderId, type, recipient: order.email, snapshot },
  });
}
