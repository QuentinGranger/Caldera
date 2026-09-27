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
  readError: boolean;
};

export async function getWishlistSnapshot(): Promise<WishlistSnapshot> {
  const [customer, guestIds] = await Promise.all([
    currentCustomer(),
    getGuestFavoriteIds(),
  ]);
  try {
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
      readError: false,
    };
  } catch {
    // Favorites are optional storefront state: a temporary database issue must
    // not make every page fail. Valid guest IDs remain usable for this request.
    return {
      authenticated: Boolean(customer),
      hasGuestFavorites: guestIds.length > 0,
      productIds: guestIds,
      readError: true,
    };
  }
}

export async function getWishlistProducts(snapshot?: WishlistSnapshot) {
  const current = snapshot ?? (await getWishlistSnapshot());
  const productIds = current.productIds;
  if (!productIds.length) return { products: [], readError: current.readError };
  let rows;
  try {
    rows = await getPrisma().product.findMany({
      where: { AND: [visibleProductWhere, { id: { in: productIds } }] },
      select: catalogProductSelect,
    });
  } catch {
    return { products: [], readError: true };
  }
  const byId = new Map(rows.map((row) => [row.id, row]));
  return {
    products: productIds.flatMap((id) => {
      const product = byId.get(id);
      return product ? [toCatalogProduct(product)] : [];
    }),
    readError: false,
  };
}
