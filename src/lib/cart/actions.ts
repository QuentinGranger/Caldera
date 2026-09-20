'use server';
import { revalidatePath } from 'next/cache';
import { getCartCookie, setCartCookie } from './cartCookie';
import { mutateCart } from './service';
import { CartError } from './validation';
import type { CartActionResult } from './types';

async function run(
  mutation: Parameters<typeof mutateCart>[1],
  message: string,
): Promise<CartActionResult> {
  let result: CartActionResult;
  try {
    const token = await mutateCart(await getCartCookie(), mutation);
    await setCartCookie(token);
    result = { success: true, message };
  } catch (error) {
    result = {
      success: false,
      message:
        error instanceof CartError
          ? error.message
          : 'Impossible de mettre à jour le panier. Réessayez.',
    };
  }
  // The personalized root snapshot refreshes header, drawer and page together.
  revalidatePath('/', 'layout');
  return result;
}
export async function addToCartAction(variantId: unknown, quantity: unknown) {
  return run({ kind: 'add', variantId, quantity }, 'Article ajouté au panier.');
}
export async function updateCartItemAction(itemId: unknown, quantity: unknown) {
  return run({ kind: 'update', itemId, quantity }, 'Quantité mise à jour.');
}
export async function removeCartItemAction(itemId: unknown) {
  return run({ kind: 'remove', itemId }, 'Article supprimé du panier.');
}
export async function clearCartAction() {
  return run({ kind: 'clear' }, 'Votre panier a été vidé.');
}
export async function refreshCartAction(): Promise<CartActionResult> {
  revalidatePath('/', 'layout');
  return { success: true, message: '' };
}
