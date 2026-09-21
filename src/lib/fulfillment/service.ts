import 'server-only';
import type { FulfillmentStatus, Prisma } from '@/generated/prisma/client';
import { adminTransaction, audit } from '@/lib/admin/common';
import {
  AdminError,
  checked,
  choice,
  id,
  text,
  whitelist,
} from '@/lib/admin/validation';
import { lockOrder } from '@/lib/orders/common';
import { enqueueOrderEmail } from '@/lib/email/outbox';
import { carriers, validTrackingUrl } from './carriers';
const nextStatus: Partial<Record<FulfillmentStatus, FulfillmentStatus>> = {
  UNFULFILLED: 'PREPARING',
  PREPARING: 'READY_TO_SHIP',
  READY_TO_SHIP: 'SHIPPED',
  SHIPPED: 'DELIVERED',
};
export function validateFulfillmentTransition(
  previous: FulfillmentStatus,
  next: FulfillmentStatus,
) {
  if (nextStatus[previous] !== next)
    throw new AdminError('Transition de préparation non autorisée.');
}
async function paidOrder(tx: Prisma.TransactionClient, orderId: string) {
  const order = await lockOrder(tx, orderId);
  if (order.status !== 'PAID' || order.payment?.status !== 'SUCCEEDED')
    throw new AdminError(
      'La commande doit être payée et son paiement confirmé.',
    );
  if (
    !order.reservations.length ||
    order.reservations.some((row) => row.status !== 'CONSUMED')
  )
    throw new AdminError(
      'Les réservations de cette commande nécessitent une vérification.',
    );
  return order;
}
export async function transitionFulfillment(adminId: string, form: FormData) {
  whitelist(form, ['orderId', 'next']);
  const orderId = id(form, 'orderId')!;
  const next = choice(form, 'next', [
    'PREPARING',
    'READY_TO_SHIP',
    'SHIPPED',
    'DELIVERED',
  ]);
  return adminTransaction(adminId, async (tx) => {
    const order = await paidOrder(tx, orderId);
    if (order.fulfillmentStatus === next) return order;
    validateFulfillmentTransition(order.fulfillmentStatus, next);
    const now = new Date();
    if (next === 'SHIPPED' || next === 'DELIVERED') {
      const shipment = await tx.shipment.findFirst({
        where: { orderId, isPrimary: true },
      });
      if (
        !shipment ||
        (next === 'SHIPPED'
          ? shipment.status !== 'DRAFT'
          : shipment.status !== 'SHIPPED')
      )
        throw new AdminError('Créez une expédition valide avant cette action.');
      if (
        !shipment.carrierName ||
        (shipment.hasTracking && !shipment.trackingNumber)
      )
        throw new AdminError(
          'Transporteur et numéro de suivi requis pour cet envoi suivi.',
        );
      if (
        next === 'SHIPPED' &&
        shipment.carrierCode === 'MONDIAL_RELAY' &&
        !shipment.providerShipmentId
      )
        throw new AdminError(
          'Créez d’abord l’expédition officielle Mondial Relay.',
        );
      await tx.shipment.update({
        where: { id: shipment.id },
        data: {
          status: next,
          ...(next === 'SHIPPED' ? { shippedAt: now } : { deliveredAt: now }),
        },
      });
    }
    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        fulfillmentStatus: next,
        ...(next === 'PREPARING'
          ? { preparationStartedAt: now }
          : next === 'READY_TO_SHIP'
            ? { readyToShipAt: now }
            : next === 'SHIPPED'
              ? { shippedAt: now }
              : { deliveredAt: now }),
      },
    });
    if (next === 'SHIPPED')
      await enqueueOrderEmail(tx, orderId, 'ORDER_SHIPPED');
    const actions = {
      PREPARING: 'ORDER_PREPARATION_STARTED',
      READY_TO_SHIP: 'ORDER_READY_TO_SHIP',
      SHIPPED: 'ORDER_SHIPPED',
      DELIVERED: 'ORDER_DELIVERED',
    };
    await audit(tx, adminId, actions[next], 'Order', orderId, {
      previous: order.fulfillmentStatus,
      next,
      manual: true,
    });
    return updated;
  });
}
export async function saveShipment(
  adminId: string,
  form: FormData,
  correction = false,
) {
  whitelist(form, [
    'orderId',
    'shipmentId',
    'version',
    'carrierCode',
    'carrierName',
    'hasTracking',
    'trackingNumber',
    'trackingUrl',
    ...(correction ? ['reason'] : []),
  ]);
  const orderId = id(form, 'orderId')!;
  const shipmentId = id(form, 'shipmentId', true);
  const carrierCode = choice(
    form,
    'carrierCode',
    carriers.map((carrier) => carrier.code),
  );
  const carrier = carriers.find((row) => row.code === carrierCode)!;
  const carrierName =
    carrierCode === 'OTHER' ? text(form, 'carrierName', 100) : carrier.label;
  const hasTracking = carrier.supportsTracking || checked(form, 'hasTracking');
  const trackingNumber = text(form, 'trackingNumber', 100, false) || null;
  if (trackingNumber && /[\u0000-\u001f\u007f]/.test(trackingNumber))
    throw new AdminError('Numéro de suivi invalide.');
  let trackingUrl: string | null;
  try {
    trackingUrl = validTrackingUrl(text(form, 'trackingUrl', 2000, false));
  } catch {
    throw new AdminError(
      'Renseignez une URL de suivi HTTP(S) valide, sans identifiants.',
    );
  }
  if (hasTracking && !trackingNumber)
    throw new AdminError('Un numéro est requis pour cet envoi suivi.');
  if (!hasTracking && (trackingNumber || trackingUrl))
    throw new AdminError('Cochez « envoi suivi » pour renseigner un suivi.');
  const reason = correction ? text(form, 'reason', 500) : null;
  return adminTransaction(adminId, async (tx) => {
    const order = await paidOrder(tx, orderId);
    const existing = await tx.shipment.findFirst({
      where: { orderId, isPrimary: true },
    });
    if (correction) {
      if (
        !existing ||
        !['SHIPPED', 'DELIVERED'].includes(existing.status) ||
        existing.id !== shipmentId
      )
        throw new AdminError('Aucune expédition envoyée à corriger.');
    } else if (
      order.fulfillmentStatus !== 'READY_TO_SHIP' ||
      (existing && existing.status !== 'DRAFT')
    )
      throw new AdminError('La commande doit être prête à expédier.');
    if (existing && !shipmentId) return existing; // duplicate creation never creates a second parcel
    if (
      existing &&
      (existing.id !== shipmentId ||
        existing.updatedAt.toISOString() !== text(form, 'version'))
    )
      throw new AdminError('L’expédition a changé. Rechargez la page.');
    if (!existing && shipmentId)
      throw new AdminError('Expédition introuvable.');
    const data = {
      carrierCode,
      carrierName,
      hasTracking,
      trackingNumber,
      trackingUrl,
    };
    const shipment = existing
      ? await tx.shipment.update({ where: { id: existing.id }, data })
      : await tx.shipment.create({ data: { ...data, orderId } });
    await audit(
      tx,
      adminId,
      correction
        ? 'SHIPMENT_TRACKING_UPDATED'
        : existing
          ? 'SHIPMENT_UPDATED'
          : 'SHIPMENT_CREATED',
      'Order',
      orderId,
      {
        shipmentId: shipment.id,
        previous: existing
          ? {
              carrierCode: existing.carrierCode,
              trackingNumber: existing.trackingNumber,
              trackingUrl: existing.trackingUrl,
            }
          : null,
        next: data,
        ...(reason ? { reason } : {}),
      },
    );
    return shipment;
  });
}
