'use server';
import { revalidatePath } from 'next/cache';
import { getCartCookie } from '@/lib/cart/cartCookie';
import { mutateCheckout } from './service';
import { CheckoutError } from './schemas';
import type { CheckoutActionResult } from './types';
async function run(
  mutation: Parameters<typeof mutateCheckout>[1],
): Promise<CheckoutActionResult> {
  let result: CheckoutActionResult;
  try {
    const next = await mutateCheckout(await getCartCookie(), mutation);
    result = {
      success: true,
      message:
        mutation.kind === 'prepare'
          ? 'Votre récapitulatif est validé. Le paiement sera disponible à la prochaine étape du projet.'
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
