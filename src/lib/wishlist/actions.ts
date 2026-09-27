'use server';

import { revalidatePath } from 'next/cache';
import { currentCustomer } from '@/lib/account/auth';
import { visibleProductWhere } from '@/lib/catalog/queries';
import { getPrisma } from '@/lib/db/prisma';
import { getWishlistSnapshot } from './data';
import {
  clearGuestFavorites,
  getGuestFavoriteIds,
  setGuestFavoriteIds,
} from './session';
import {
  addFavoriteToSession,
  isProductId,
  MAX_GUEST_FAVORITES,
} from './sessionValue';

export type WishlistActionResult = {
  success: boolean;
  productIds: string[];
  readError: boolean;
  message: string;
};

async function mergeGuestFavorites(customerId: string) {
  const guestIds = await getGuestFavoriteIds();
  if (!guestIds.length) return false;
  const visible = await getPrisma().product.findMany({
    where: { AND: [visibleProductWhere, { id: { in: guestIds } }] },
    select: { id: true },
  });
  if (visible.length)
    await getPrisma().wishlistItem.createMany({
      data: visible.map(({ id }) => ({ customerId, productId: id })),
      skipDuplicates: true,
    });
  await clearGuestFavorites();
  return true;
}

async function result(success: boolean, message: string) {
  const snapshot = await getWishlistSnapshot();
  return {
    success,
    message,
    productIds: snapshot.productIds,
    readError: snapshot.readError,
  };
}

/** Silent re-read for navigation/focus; it also handles a login in another tab. */
export async function refreshWishlistAction(): Promise<WishlistActionResult> {
  try {
    const customer = await currentCustomer();
    const merged = customer ? await mergeGuestFavorites(customer.id) : false;
    if (merged) revalidatePath('/favoris');
    return result(
      true,
      merged ? 'Vos favoris ont été synchronisés avec votre compte.' : '',
    );
  } catch {
    return result(false, 'Impossible d’actualiser vos favoris pour le moment.');
  }
}

export async function setWishlistProductAction(
  productId: unknown,
  favorited: unknown,
): Promise<WishlistActionResult> {
  if (!isProductId(productId) || typeof favorited !== 'boolean')
    return result(false, 'Ce produit ne peut pas être ajouté aux favoris.');
  const db = getPrisma();
  try {
    const customer = await currentCustomer();
    if (customer) {
      // Handles a click made just after authentication, even before the
      // background merge in WishlistProvider has completed.
      await mergeGuestFavorites(customer.id);
      if (favorited) {
        const product = await db.product.findFirst({
          where: { AND: [{ id: productId }, visibleProductWhere] },
          select: { id: true },
        });
        if (!product) return result(false, 'Ce produit n’est plus disponible.');
        await db.wishlistItem.upsert({
          where: {
            customerId_productId: { customerId: customer.id, productId },
          },
          create: { customerId: customer.id, productId },
          update: {},
        });
      } else {
        await db.wishlistItem.deleteMany({
          where: { customerId: customer.id, productId },
        });
      }
    } else {
      const ids = await getGuestFavoriteIds();
      if (favorited) {
        const product = await db.product.findFirst({
          where: { AND: [{ id: productId }, visibleProductWhere] },
          select: { id: true },
        });
        if (!product) return result(false, 'Ce produit n’est plus disponible.');
        const addition = addFavoriteToSession(ids, productId);
        if (addition.full)
          return result(
            false,
            `Vous pouvez conserver jusqu’à ${MAX_GUEST_FAVORITES} favoris pendant une session. Retirez-en un avant d’en ajouter un autre.`,
          );
        await setGuestFavoriteIds(addition.ids);
      } else {
        await setGuestFavoriteIds(ids.filter((id) => id !== productId));
      }
    }
    revalidatePath('/favoris');
    return result(
      true,
      favorited
        ? 'Produit ajouté à vos favoris.'
        : 'Produit retiré de vos favoris.',
    );
  } catch {
    return result(false, 'Impossible de modifier vos favoris pour le moment.');
  }
}
