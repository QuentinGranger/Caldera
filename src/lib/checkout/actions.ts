'use server';

import { revalidatePath } from 'next/cache';
import { getCartCookie } from '@/lib/cart/cartCookie';
import { getActiveOrderForCheckoutRecovery } from '@/lib/orders/queries';
import { cancelOrder } from '@/lib/payments/cancel';
import { mutateCheckout } from './service';
import { CheckoutError } from './schemas';
import type { CheckoutActionResult } from './types';
import { getCheckoutData } from './queries';
import { getCheckoutSummary } from './validation';
import { shippingProviders } from '@/lib/shipping/providers';

async function recoverExpiredPayment(token: string | undefined) {
  const order = await getActiveOrderForCheckoutRecovery(token);
  if (!order) return;

  const activeReservations = order.reservations.filter(
    (reservation) => reservation.status === 'ACTIVE',
  );

  if (
    activeReservations.length > 0 &&
    activeReservations.every(
      (reservation) => reservation.expiresAt <= new Date(),
    )
  ) {
    await cancelOrder(order.id, true);
  }
}

async function run(
  mutation: Parameters<typeof mutateCheckout>[1],
): Promise<CheckoutActionResult> {
  let result: CheckoutActionResult;

  try {
    const token = await getCartCookie();

    if (mutation.kind === 'start' || mutation.kind === 'sync') {
      await recoverExpiredPayment(token);
    }

    const next = await mutateCheckout(token, mutation);
    result = {
      success: true,
      message:
        mutation.kind === 'prepare'
          ? 'Votre récapitulatif est validé. Vous pouvez maintenant passer au paiement.'
          : '',
      next,
    };
  } catch (error) {
    result = {
      success: false,
      message:
        error instanceof CheckoutError
          ? error.message
          : 'Impossible d’enregistrer votre commande en préparation. Réessayez.',
      errors: error instanceof CheckoutError ? error.errors : {},
    };
  }

  revalidatePath('/', 'layout');
  return result;
}

export async function startCheckoutAction() {
  return run({ kind: 'start' });
}

export async function saveContactAction(sessionId: unknown, contact: unknown) {
  return run({ kind: 'contact', sessionId, contact });
}

export async function setShippingMethodAction(
  sessionId: unknown,
  methodId: unknown,
) {
  return run({ kind: 'shipping', sessionId, methodId });
}

export async function selectPickupPointAction(
  sessionId: unknown,
  pointId: unknown,
): Promise<CheckoutActionResult> {
  try {
    if (typeof pointId !== 'string' || !/^[A-Za-z0-9-]{3,20}$/.test(pointId))
      throw new CheckoutError('Identifiant de Point Relais® invalide.');
    const token = await getCartCookie();
    const data = await getCheckoutData(token);
    if (!data || data.session?.id !== sessionId)
      throw new CheckoutError('Cette session de checkout est introuvable.');
    const view = getCheckoutSummary(data);
    if (view.selectedMethod?.code !== 'MONDIAL_RELAY_PICKUP')
      throw new CheckoutError('Choisissez d’abord Mondial Relay.');
    const pickupPoint = await shippingProviders.MONDIAL_RELAY.getPickupPoint(
      pointId,
      view.contact.shipping.countryCode,
    );
    const next = await mutateCheckout(token, {
      kind: 'pickup',
      sessionId,
      pickupPoint,
    });
    revalidatePath('/', 'layout');
    return {
      success: true,
      message: 'Point de retrait enregistré.',
      next,
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof CheckoutError || error instanceof Error
          ? error.message
          : 'Impossible d’enregistrer ce point de retrait.',
    };
  }
}

export async function prepareCheckoutAction(sessionId: unknown) {
  return run({ kind: 'prepare', sessionId });
}

export async function synchronizeCheckoutAction() {
  return run({ kind: 'sync' });
}
