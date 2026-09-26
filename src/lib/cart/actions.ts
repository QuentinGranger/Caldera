'use server';
import { getCartCookie, setCartCookie } from './cartCookie';
import { readCart } from './getCart';
import { mutateCart } from './service';
import { CartError } from './validation';
import type { CartActionResult } from './types';

// Each action returns the fresh cart and CartProvider applies it: no
// revalidatePath, which would re-render the page and purge every cached route.
async function run(
  mutation: Parameters<typeof mutateCart>[1],
  message: string,
): Promise<CartActionResult> {
  let token = await getCartCookie();
  try {
    token = await mutateCart(token, mutation);
    await setCartCookie(token);
    return { success: true, message, cart: await readCart(token) };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof CartError
          ? error.message
          : 'Impossible de mettre à jour le panier. Réessayez.',
      // Current prices and stock, so the refusal is shown with its reason.
      cart: await readCart(token),
    };
  }
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
/** Read-only: current prices and availability, without any re-render. */
export async function refreshCartAction(): Promise<CartActionResult> {
  return {
    success: true,
    message: '',
    cart: await readCart(await getCartCookie()),
  };
}
