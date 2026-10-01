'use server';

import { revalidatePath } from 'next/cache';
import { allowAccountAttempt } from '@/lib/account/limits';
import { getCartCookie } from '@/lib/cart/cartCookie';
import { cartTokenHash } from '@/lib/cart/identity';
import { getActiveOrderForCheckoutRecovery } from '@/lib/orders/queries';
import { cancelOrder } from '@/lib/payments/cancel';
import { getCheckoutData } from './queries';
import {
  applyPromotionFromCart,
  mutateCheckout,
  removePromotionFromCart,
} from './service';
import { getCheckoutSummary } from './validation';
import { CheckoutError } from './schemas';
import {
  toCartPromotionState,
  type CartPromotionActionResult,
  type CartPromotionState,
  type CheckoutActionResult,
} from './types';

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

async function assertPromotionAttempt(token: string | undefined) {
  if (!(await allowAccountAttempt('promotion', cartTokenHash(token) ?? '')))
    throw new CheckoutError(
      'Trop de codes essayés. Réessayez dans une heure.',
    );
}

async function run(
  mutation: Parameters<typeof mutateCheckout>[1],
): Promise<CheckoutActionResult> {
  let result: CheckoutActionResult;

  try {
    const token = await getCartCookie();

    if (mutation.kind === 'promotion') await assertPromotionAttempt(token);

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

async function currentCartPromotionState(
  token: string | undefined,
): Promise<CartPromotionState | null> {
  const data = await getCheckoutData(token);
  return toCartPromotionState(data ? getCheckoutSummary(data) : null);
}

export async function applyCartPromotionAction(
  code: unknown,
): Promise<CartPromotionActionResult> {
  const token = await getCartCookie();
  try {
    await assertPromotionAttempt(token);
    const view = await applyPromotionFromCart(token, code);
    revalidatePath('/panier');
    return {
      success: true,
      message: 'Code promo appliqué.',
      state: toCartPromotionState(view),
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof CheckoutError
          ? error.message
          : 'Impossible d’appliquer ce code promo. Réessayez.',
      state: await currentCartPromotionState(token),
    };
  }
}

export async function removeCartPromotionAction(): Promise<CartPromotionActionResult> {
  const token = await getCartCookie();
  try {
    const view = await removePromotionFromCart(token);
    revalidatePath('/panier');
    return {
      success: true,
      message: 'Code promo retiré.',
      state: toCartPromotionState(view),
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof CheckoutError
          ? error.message
          : 'Impossible de retirer ce code promo. Réessayez.',
      state: await currentCartPromotionState(token),
    };
  }
}

export async function refreshCartPromotionAction() {
  return currentCartPromotionState(await getCartCookie());
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

export async function applyPromotionAction(sessionId: unknown, code: unknown) {
  return run({ kind: 'promotion', sessionId, code });
}

export async function removePromotionAction(sessionId: unknown) {
  return run({ kind: 'promotion-remove', sessionId });
}

export async function prepareCheckoutAction(sessionId: unknown) {
  return run({ kind: 'prepare', sessionId });
}

export async function synchronizeCheckoutAction() {
  return run({ kind: 'sync' });
}
