import 'server-only';

import {
  catalogProductSelect,
  toCatalogProduct,
  visibleProductWhere,
} from '@/lib/catalog/queries';
import { getPrisma } from '@/lib/db/prisma';

export async function getWishlistProductIds(customerId: string) {
  const items = await getPrisma().wishlistItem.findMany({
    where: { customerId },
    select: { productId: true },
  });

  return items.map(({ productId }) => productId);
}

export async function getWishlistProducts(customerId: string) {
  const items = await getPrisma().wishlistItem.findMany({
    where: {
      customerId,
      product: { is: visibleProductWhere },
    },
    select: {
      product: { select: catalogProductSelect },
    },
    orderBy: { createdAt: 'desc' },
  });

  return items.map(({ product }) => toCatalogProduct(product));
}
