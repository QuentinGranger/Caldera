'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentCustomer } from '@/lib/auth/customer/session';
import { visibleProductWhere } from '@/lib/catalog/queries';
import { getPrisma } from '@/lib/db/prisma';

export type WishlistActionResult = {
  success: boolean;
  favorited: boolean;
  message: string;
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function setWishlistProductAction(
  productId: unknown,
  favorited: unknown,
): Promise<WishlistActionResult> {
  const customer = await getCurrentCustomer();

  if (!customer) {
    return {
      success: false,
      favorited: false,
      message:
        'Votre session a expiré. Reconnectez-vous pour gérer vos favoris.',
    };
  }

  if (
    typeof productId !== 'string' ||
    !UUID.test(productId) ||
    typeof favorited !== 'boolean'
  ) {
    return {
      success: false,
      favorited: false,
      message: 'Ce produit ne peut pas être ajouté aux favoris.',
    };
  }

  if (favorited) {
    const product = await getPrisma().product.findFirst({
      where: { AND: [{ id: productId }, visibleProductWhere] },
      select: { id: true },
    });

    if (!product) {
      return {
        success: false,
        favorited: false,
        message: 'Ce produit n’est plus disponible.',
      };
    }

    await getPrisma().wishlistItem.upsert({
      where: {
        customerId_productId: { customerId: customer.id, productId },
      },
      create: { customerId: customer.id, productId },
      update: {},
    });
  } else {
    await getPrisma().wishlistItem.deleteMany({
      where: { customerId: customer.id, productId },
    });
  }

  revalidatePath('/compte/favoris');

  return {
    success: true,
    favorited,
    message: favorited
      ? 'Produit ajouté à vos favoris.'
      : 'Produit retiré de vos favoris.',
  };
}
