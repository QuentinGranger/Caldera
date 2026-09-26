import 'server-only';
import { cache } from 'react';
import { getCartCookie } from './cartCookie';
import { emptyCart, type CartView } from './types';
import { getCartByToken } from './queries';

/** Cart of a token; a read failure becomes an empty cart with a message. */
export async function readCart(token: string | undefined): Promise<CartView> {
  try {
    return await getCartByToken(token);
  } catch {
    return {
      ...emptyCart(),
      readError:
        'Votre panier est momentanément indisponible. Réessayez dans quelques instants.',
    };
  }
}

// React cache deduplicates within one render, never between visitors.
export const getCart = cache(async () => readCart(await getCartCookie()));
