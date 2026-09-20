import 'server-only';
import { getPrisma } from '@/lib/db/prisma';
import {
  catalogProductSelect,
  toCatalogProduct,
  visibleProductWhere,
  type ProductDetail,
} from './queries';
import type { Prisma } from '@/generated/prisma/client';
/** Trois groupes disjoints, quatre lignes maximum chacun : jamais une requête par carte. */
export async function getRelatedProducts(product: ProductDetail) {
  const sameSet: Prisma.ProductWhereInput = product.tcgSet
    ? { tcgSet: { slug: product.tcgSet.slug } }
    : { id: { in: [] } };
  const sameCategory: Prisma.ProductWhereInput = {
    category: { slug: product.categoryInfo.slug },
  };
  const scopes: Prisma.ProductWhereInput[] = [
    sameSet,
    { AND: [sameCategory, { NOT: sameSet }] },
    {
      AND: [
        { productType: product.productType },
        { NOT: sameSet },
        { NOT: sameCategory },
      ],
    },
  ];
  const groups = await Promise.all(
    scopes.map((scope) =>
      getPrisma().product.findMany({
        where: {
          AND: [visibleProductWhere, { id: { not: product.id } }, scope],
        },
        select: catalogProductSelect,
        take: 4,
        orderBy: [
          { featured: 'desc' },
          { publishedAt: { sort: 'desc', nulls: 'last' } },
          { id: 'asc' },
        ],
      }),
    ),
  );
  return groups.flat().slice(0, 4).map(toCatalogProduct);
}
