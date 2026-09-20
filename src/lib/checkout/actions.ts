'use server';

import { revalidatePath } from 'next/cache';
import { getCartCookie } from '@/lib/cart/cartCookie';
import { getActiveOrderForCheckoutRecovery } from '@/lib/orders/queries';
import { cancelOrder } from '@/lib/payments/cancel';
import { mutateCheckout } from './service';
import { CheckoutError } from './schemas';
import type { CheckoutActionResult } from './types';

async function recoverExpiredPayment(token: string | undefined) {
  const order = await getActiveOrderForCheckoutRecovery(token);
  if (!order) return;

  const activeReservations = order.reservations.filter(
    (reservation) => reservation.status === 'ACTIVE',
  );

  if (
    activeReservations.length > 0 &&
    activeReservations.every((reservation) => reservation.expiresAt <= new Date())
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

export async function prepareCheckoutAction(sessionId: unknown) {
  return run({ kind: 'prepare', sessionId });
}

export async function synchronizeCheckoutAction() {
  return run({ kind: 'sync' });
}
