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
import { isProductId, MAX_GUEST_FAVORITES } from './sessionValue';

export type WishlistActionResult = {
  success: boolean;
  productIds: string[];
  message: string;
};

async function mergeGuestFavorites(customerId: string) {
  const guestIds = await getGuestFavoriteIds();
  if (!guestIds.length) return;
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
}

async function result(success: boolean, message: string) {
  const snapshot = await getWishlistSnapshot();
  return { success, message, productIds: snapshot.productIds };
}

export async function mergeGuestFavoritesAction(): Promise<WishlistActionResult> {
  const customer = await currentCustomer();
  if (!customer)
    return result(false, 'Connectez-vous pour synchroniser vos favoris.');
  try {
    await mergeGuestFavorites(customer.id);
    revalidatePath('/favoris');
    return result(true, 'Vos favoris ont été synchronisés avec votre compte.');
  } catch {
    return result(
      false,
      'Impossible de synchroniser vos favoris pour le moment.',
    );
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
        await setGuestFavoriteIds(
          [productId, ...ids.filter((id) => id !== productId)].slice(
            0,
            MAX_GUEST_FAVORITES,
          ),
        );
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
