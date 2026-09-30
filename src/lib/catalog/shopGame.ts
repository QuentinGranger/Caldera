// The licence Caldera sells today: Pokémon TCG only. The catalogue itself
// stays multi-game (data model, demo seed, tests); the home page and the
// menus speak of this licence alone, so a product of another game never
// contradicts what they promise. Another licence joins here when it is sold.
import type { Prisma } from '@/generated/prisma/client';

export const SHOP_GAME = { slug: 'pokemon', name: 'Pokémon' } as const;

/** Content or menu entry of the licence sold, or of no licence at all. */
export function isShopGame(slugs: readonly string[]): boolean {
  return !slugs.length || slugs.includes(SHOP_GAME.slug);
}

// Same shape on a product and on a set: the licence sold, or none.
const shopGameOrNone = {
  OR: [{ gameId: null }, { game: { slug: SHOP_GAME.slug } }],
};

/**
 * Products of the licence sold, and licence-free ones (sleeves, binders).
 * The set is checked too, should a product and its set ever disagree.
 */
export const shopProductWhere: Prisma.ProductWhereInput = {
  AND: [
    shopGameOrNone,
    { OR: [{ tcgSetId: null }, { tcgSet: shopGameOrNone }] },
  ],
};
