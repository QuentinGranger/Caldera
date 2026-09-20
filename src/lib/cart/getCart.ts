import 'server-only';
import { cache } from 'react';
import { getCartCookie } from './cartCookie';
import { emptyCart } from './types';
import { getCartByToken } from './queries';
// React cache deduplicates within one render, never between visitors.
export const getCart = cache(async () => {
  const token = await getCartCookie();
  try {
    return await getCartByToken(token);
  } catch {
    return {
      ...emptyCart(),
      readError:
        'Votre panier est momentanément indisponible. Réessayez dans quelques instants.',
    };
  }
});
