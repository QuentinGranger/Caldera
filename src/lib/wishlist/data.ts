import 'server-only';

import { currentCustomer } from '@/lib/account/auth';
import {
  catalogProductSelect,
  toCatalogProduct,
  visibleProductWhere,
} from '@/lib/catalog/queries';
import { getPrisma } from '@/lib/db/prisma';
import { getGuestFavoriteIds } from './session';

export type WishlistSnapshot = {
  authenticated: boolean;
  hasGuestFavorites: boolean;
  productIds: string[];
};

export async function getWishlistSnapshot(): Promise<WishlistSnapshot> {
  const [customer, guestIds] = await Promise.all([
    currentCustomer(),
    getGuestFavoriteIds(),
  ]);
  const db = getPrisma();
  const [items, visibleGuests] = await Promise.all([
    customer
      ? db.wishlistItem.findMany({
          where: {
            customerId: customer.id,
            product: { is: visibleProductWhere },
          },
          select: { productId: true },
          orderBy: { createdAt: 'desc' },
        })
      : Promise.resolve([]),
    guestIds.length
      ? db.product.findMany({
          where: { AND: [visibleProductWhere, { id: { in: guestIds } }] },
          select: { id: true },
        })
      : Promise.resolve([]),
  ]);
  const visibleGuestIds = new Set(visibleGuests.map(({ id }) => id));
  const productIds = [
    ...guestIds.filter((id) => visibleGuestIds.has(id)),
    ...items.map(({ productId }) => productId),
  ];
  return {
    authenticated: Boolean(customer),
    hasGuestFavorites: guestIds.length > 0,
    productIds: [...new Set(productIds)],
  };
}

export async function getWishlistProducts(snapshot?: WishlistSnapshot) {
  const productIds = (snapshot ?? (await getWishlistSnapshot())).productIds;
  if (!productIds.length) return [];
  const rows = await getPrisma().product.findMany({
    where: { AND: [visibleProductWhere, { id: { in: productIds } }] },
    select: catalogProductSelect,
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  return productIds.flatMap((id) => {
    const product = byId.get(id);
    return product ? [toCatalogProduct(product)] : [];
  });
}
