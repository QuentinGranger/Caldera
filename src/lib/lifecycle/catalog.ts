import 'server-only';
import { getPrisma } from '@/lib/db/prisma';
import { publishedProductWhere } from '@/lib/catalog/queries';
import { shopProductWhere } from '@/lib/catalog/shopGame';
import type { Prisma } from '@/generated/prisma/client';
export const realProductWhere: Prisma.ProductWhereInput = {
  AND: [
    publishedProductWhere,
    shopProductWhere,
    { isDemonstration: false, preorder: false },
  ],
};
export async function availableVariants(ids?: string[]) {
  return getPrisma().productVariant.findMany({
    where: {
      ...(ids ? { id: { in: ids } } : {}),
      isActive: true,
      price: { gt: 0 },
      availableQuantity: { gt: 0 },
      product: realProductWhere,
    },
    include: { product: { include: { tags: true } } },
    orderBy: [{ product: { publishedAt: 'desc' } }, { id: 'asc' }],
    take: 500,
  });
}
export async function complementaryVariants(
  productIds: string[],
  excludedIds: string[],
) {
  const db = getPrisma();
  const bought = await db.product.findMany({
    where: { id: { in: productIds } },
    select: { productType: true, tcgSetId: true, gameId: true },
  });
  const types = bought.map((p) => p.productType);
  if (
    !types.some((type) =>
      [
        'ETB',
        'DISPLAY',
        'BOOSTER',
        'BLISTER',
        'TRIPACK',
        'BUNDLE',
        'COLLECTION_BOX',
        'TIN',
        'DECK',
        'SINGLE_CARD',
      ].includes(type),
    )
  )
    return [];
  const tags = ['sleeves', 'top-loaders'];
  if (types.includes('ETB')) tags.unshift('protection-etb');
  if (types.includes('DISPLAY')) tags.push('deck-box');
  if (types.includes('SINGLE_CARD')) tags.unshift('penny-sleeves');
  const setIds = bought.flatMap((p) => (p.tcgSetId ? [p.tcgSetId] : []));
  const games = bought.flatMap((p) => (p.gameId ? [p.gameId] : []));
  const candidates = await db.productVariant.findMany({
    where: {
      isActive: true,
      price: { gt: 0 },
      availableQuantity: { gt: 0 },
      product: {
        AND: [
          realProductWhere,
          {
            id: { notIn: excludedIds },
            OR: [
              {
                productType: 'ACCESSORY',
                tags: { some: { slug: { in: tags } } },
                OR: [{ gameId: null }, { gameId: { in: games } }],
              },
              ...(setIds.length
                ? [
                    {
                      tcgSetId: { in: setIds },
                      productType: 'BOOSTER' as const,
                    },
                  ]
                : []),
            ],
          },
        ],
      },
    },
    include: { product: { include: { tags: true } } },
    orderBy: [{ isDefault: 'desc' }, { id: 'asc' }],
    take: 20,
  });
  const distinct = new Map<string, (typeof candidates)[number]>();
  for (const row of candidates) {
    if (!distinct.has(row.productId)) distinct.set(row.productId, row);
    if (distinct.size === 3) break;
  }
  return [...distinct.values()];
}
