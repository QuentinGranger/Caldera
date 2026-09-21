import 'server-only';
import { createHash } from 'node:crypto';
import { getPrisma } from '@/lib/db/prisma';
import { adminTransaction, audit } from '@/lib/admin/common';
import { AdminError } from '@/lib/admin/validation';
import { lockOrder } from '@/lib/orders/common';
import { shippingProviders } from '@/lib/shipping/providers';
import { MondialRelayError } from '@/lib/shipping/providers/mondialRelay';
import type { PickupPoint } from '@/lib/shipping/types';

const TRACKING_TTL_MS = 15 * 60 * 1000;

function trackingUrl() {
  return 'https://www.mondialrelay.fr/suivi-de-colis/';
}

export async function createMondialRelayShipment(
  adminId: string,
  orderId: string,
) {
  const prepared = await adminTransaction(adminId, async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (
      order.status !== 'PAID' ||
      order.payment?.status !== 'SUCCEEDED' ||
      order.fulfillmentStatus !== 'READY_TO_SHIP'
    )
      throw new AdminError('La commande doit être payée et prête à expédier.');
    if (order.shippingMethodCode !== 'MONDIAL_RELAY_PICKUP')
      throw new AdminError('Cette commande n’utilise pas Mondial Relay.');
    const detail = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        pickupPoint: true,
        addresses: true,
        items: { include: { variant: { select: { weightGrams: true } } } },
      },
    });
    if (!detail.pickupPoint)
      throw new AdminError('Le snapshot du point de retrait est absent.');
    const missing = detail.items.filter(
      (item) => !item.variant?.weightGrams || item.variant.weightGrams <= 0,
    );
    if (missing.length)
      throw new AdminError(
        `Poids manquant ou invalide pour : ${missing.map((item) => item.sku).join(', ')}.`,
      );
    const weightGrams = detail.items.reduce(
      (sum, item) => sum + item.variant!.weightGrams! * item.quantity,
      0,
    );
    const existing = await tx.shipment.findFirst({
      where: { orderId, isPrimary: true },
    });
    if (existing?.providerShipmentId) return { complete: existing } as const;
    if (existing)
      throw new AdminError(
        existing.providerStatus === 'CREATE_UNKNOWN'
          ? 'La précédente réponse transporteur est ambiguë. Vérifiez Mondial Relay avant toute nouvelle création.'
          : 'Une création Mondial Relay est déjà en cours ou doit être vérifiée.',
      );
    const idempotencyKey = createHash('sha256')
      .update(`MONDIAL_RELAY:${orderId}`)
      .digest('hex');
    const shipment = await tx.shipment.create({
      data: {
        orderId,
        carrierCode: 'MONDIAL_RELAY',
        carrierName: 'Mondial Relay',
        hasTracking: true,
        idempotencyKey,
        providerStatus: 'CREATING',
        weightGrams,
      },
    });
    const address = detail.addresses.find((row) => row.role === 'SHIPPING');
    if (!address) throw new AdminError('Adresse de livraison absente.');
    return {
      shipment,
      orderNumber: detail.orderNumber,
      email: detail.email,
      phone: detail.phone,
      address,
      pickupPoint: detail.pickupPoint,
      weightGrams,
    } as const;
  });
  if ('complete' in prepared) return prepared.complete;

  try {
    const point: PickupPoint = {
      provider: 'MONDIAL_RELAY',
      id: prepared.pickupPoint.pointId,
      type: prepared.pickupPoint.type,
      name: prepared.pickupPoint.name,
      address1: prepared.pickupPoint.address1,
      address2: prepared.pickupPoint.address2,
      postalCode: prepared.pickupPoint.postalCode,
      city: prepared.pickupPoint.city,
      countryCode: prepared.pickupPoint.countryCode,
      latitude: prepared.pickupPoint.latitude?.toNumber() ?? null,
      longitude: prepared.pickupPoint.longitude?.toNumber() ?? null,
      distanceM: prepared.pickupPoint.distanceM,
      openingHours: prepared.pickupPoint.openingHours as Record<
        string,
        string[]
      > | null,
    };
    const created = await shippingProviders.MONDIAL_RELAY.createShipment({
      orderNumber: prepared.orderNumber,
      customerReference: prepared.orderNumber,
      weightGrams: prepared.weightGrams,
      recipient: {
        name: `${prepared.address.firstName} ${prepared.address.lastName}`,
        company: prepared.address.company,
        address1: prepared.address.addressLine1,
        address2: prepared.address.addressLine2,
        postalCode: prepared.address.postalCode,
        city: prepared.address.city,
        countryCode: prepared.address.countryCode,
        phone: prepared.phone || prepared.address.phone,
        email: prepared.email,
      },
      pickupPoint: point,
    });
    return adminTransaction(adminId, async (tx) => {
      const shipment = await tx.shipment.update({
        where: { id: prepared.shipment.id },
        data: {
          providerShipmentId: created.providerShipmentId,
          providerLabelUrl: created.labelUrl,
          providerStatus: 'CREATED',
          trackingNumber: created.trackingNumber,
          trackingUrl: created.trackingUrl,
        },
      });
      await audit(
        tx,
        adminId,
        'MONDIAL_RELAY_SHIPMENT_CREATED',
        'Order',
        orderId,
        {
          shipmentId: shipment.id,
          providerShipmentId: created.providerShipmentId,
          weightGrams: prepared.weightGrams,
        },
      );
      return shipment;
    });
  } catch (error) {
    const definiteRejection =
      error instanceof MondialRelayError && error.code.startsWith('STAT_');
    await getPrisma().shipment.update({
      where: { id: prepared.shipment.id },
      data: {
        providerStatus: definiteRejection
          ? 'CREATE_REJECTED'
          : 'CREATE_UNKNOWN',
      },
    });
    throw new AdminError(
      definiteRejection
        ? error.message
        : 'La réponse Mondial Relay est incertaine. Aucune relance automatique ne sera faite afin d’éviter un doublon.',
    );
  }
}

export async function syncMondialRelayTracking(
  adminId: string,
  shipmentId: string,
  force = false,
) {
  const shipment = await getPrisma().shipment.findUnique({
    where: { id: shipmentId },
  });
  if (
    !shipment ||
    shipment.carrierCode !== 'MONDIAL_RELAY' ||
    !shipment.providerShipmentId
  )
    throw new AdminError('Expédition Mondial Relay introuvable.');
  if (
    !force &&
    shipment.lastTrackedAt &&
    Date.now() - shipment.lastTrackedAt.getTime() < TRACKING_TTL_MS
  )
    return shipment;
  const tracking = await shippingProviders.MONDIAL_RELAY.getTracking(
    shipment.providerShipmentId,
  );
  return adminTransaction(adminId, async (tx) => {
    const updated = await tx.shipment.update({
      where: { id: shipment.id },
      data: {
        providerStatus: tracking.summary || shipment.providerStatus,
        trackingUrl: shipment.trackingUrl || trackingUrl(),
        lastTrackedAt: new Date(),
        trackingEvents: {
          createMany: {
            data: tracking.events.map((event) => event),
            skipDuplicates: true,
          },
        },
      },
    });
    await audit(
      tx,
      adminId,
      'MONDIAL_RELAY_TRACKING_SYNCED',
      'Order',
      shipment.orderId,
      {
        shipmentId: shipment.id,
        eventCount: tracking.events.length,
      },
    );
    return updated;
  });
}
