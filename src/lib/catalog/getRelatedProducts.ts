import 'server-only';
import { getPrisma } from '@/lib/db/prisma';
import {
  availableProductWhere,
  catalogProductSelect,
  toCatalogProduct,
  visibleProductWhere,
  type ProductDetail,
} from './queries';
import type { Prisma } from '@/generated/prisma/client';

const RELATED_TOTAL = 4;
/** Same set, same family (same game), same game: the rest fills the free places. */
const RELATED_QUOTAS = [2, 1, 1] as const;

/**
 * Takes up to `quotas[i]` items from each bucket, then fills the remaining
 * places in bucket order. No duplicate; the result keeps the bucket order.
 */
export function allocateSlots<T extends { id: string }>(
  buckets: readonly (readonly T[])[],
  quotas: readonly number[],
  total: number,
): T[] {
  const picked: { item: T; bucket: number; position: number }[] = [];
  const seen = new Set<string>();
  const take = (item: T, bucket: number, position: number) => {
    if (picked.length >= total || seen.has(item.id)) return false;
    seen.add(item.id);
    picked.push({ item, bucket, position });
    return true;
  };
  buckets.forEach((bucket, index) => {
    let taken = 0;
    for (const [position, item] of bucket.entries()) {
      if (taken >= (quotas[index] ?? 0)) break;
      if (take(item, index, position)) taken++;
    }
  });
  buckets.forEach((bucket, index) =>
    bucket.forEach((item, position) => take(item, index, position)),
  );
  return picked
    .sort((a, b) => a.bucket - b.bucket || a.position - b.position)
    .map(({ item }) => item);
}

/** Disjoint buckets, purchasable products first: never one query per card. */
export async function getRelatedProducts(product: ProductDetail) {
  const sameSet: Prisma.ProductWhereInput | null = product.tcgSet
    ? { tcgSetId: product.tcgSet.id }
    : null;
  const notSameSet: Prisma.ProductWhereInput[] = sameSet
    ? [{ NOT: sameSet }]
    : [];
  const sameCategory: Prisma.ProductWhereInput = {
    categoryId: product.categoryInfo.id,
  };
  const sameGame: Prisma.ProductWhereInput[] = product.game
    ? [{ gameId: product.game.id }]
    : [];
  const buckets: (Prisma.ProductWhereInput | null)[] = [
    sameSet,
    { AND: [sameCategory, ...sameGame, ...notSameSet] },
    // A game-less product (generic accessory) falls back to its product type.
    {
      AND: [
        ...(product.game ? sameGame : [{ productType: product.productType }]),
        ...notSameSet,
        { NOT: sameCategory },
      ],
    },
  ];
  const read = async (
    bucket: Prisma.ProductWhereInput | null,
    availability: Prisma.ProductWhereInput,
    excludeIds: readonly string[],
  ) => {
    if (!bucket) return [];
    return getPrisma().product.findMany({
      where: {
        AND: [
          visibleProductWhere,
          { id: { notIn: [product.id, ...excludeIds] } },
          bucket,
          availability,
        ],
      },
      select: catalogProductSelect,
      take: RELATED_TOTAL,
      orderBy: [
        { featured: 'desc' },
        { publishedAt: { sort: 'desc', nulls: 'last' } },
        { id: 'asc' },
      ],
    });
  };
  const available = await Promise.all(
    buckets.map((bucket) => read(bucket, availableProductWhere, [])),
  );
  let related = allocateSlots(available, RELATED_QUOTAS, RELATED_TOTAL);
  if (related.length < RELATED_TOTAL) {
    // Sold-out products only fill the places left by purchasable ones.
    const excluded = related.map((row) => row.id);
    const soldOut = await Promise.all(
      buckets.map((bucket) =>
        read(bucket, { NOT: availableProductWhere }, excluded),
      ),
    );
    related = [
      ...related,
      ...allocateSlots(soldOut, RELATED_QUOTAS, RELATED_TOTAL - related.length),
    ];
  }
  return related.map(toCatalogProduct);
}
