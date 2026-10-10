import 'server-only';
import { cache } from 'react';
import { ProductType, type Prisma } from '@/generated/prisma/client';
import { getPrisma } from '@/lib/db/prisma';
import { isSealedProduct } from '@/lib/product/services';
import { shopProductWhere } from './shopGame';
import { SHOPPING_INTENTS, type MerchandisingKey } from './merchandising';

/** A tag alone never proves a restock. Require a recorded prior stock cycle. */
const restockedIds = cache(async () => {
  const rows = await getPrisma().$queryRaw<{ id: string }[]>`
    SELECT DISTINCT v."productId" AS id
    FROM "InventoryAdjustment" a
    JOIN "ProductVariant" v ON v.id = a."variantId"
    JOIN "Product" p ON p.id = v."productId"
    WHERE p.status = 'ACTIVE' AND p."isDemonstration" = false AND p.preorder = false
      AND a.type = 'RESTOCK' AND a."previousQuantity" = 0
      AND a."quantityDelta" > 0 AND a."newQuantity" > 0
      AND a."createdAt" BETWEEN CURRENT_TIMESTAMP - INTERVAL '30 days' AND CURRENT_TIMESTAMP
      AND p."publishedAt" < a."createdAt"
      AND v."isActive" = true AND v.price > 0 AND v."availableQuantity" > 0
      AND EXISTS (SELECT 1 FROM "InventoryAdjustment" earlier
        WHERE earlier."variantId" = v.id AND earlier."createdAt" < a."createdAt"
          AND earlier."newQuantity" > 0)
  `;
  return rows.map((row) => row.id);
});

/** Same predicates power homepage shelves, result counts, filters and pages. */
export async function merchandisingWhere(
  key: MerchandisingKey,
  now = new Date(),
): Promise<Prisma.ProductWhereInput> {
  const editorial =
    key === 'du-moment' ||
    SHOPPING_INTENTS.some((intent) => intent.slug === key);
  const conditions: Prisma.ProductWhereInput[] = editorial
    ? []
    : [
        {
          isDemonstration: false,
          preorder: false,
          variants: {
            some: {
              isActive: true,
              price: { gt: 0 },
              availableQuantity: { gt: 0 },
            },
          },
        },
      ];
  // Public examples must never create artificial urgency.
  if (!editorial && process.env.CATALOG_DEMO_MODE === '1')
    return { id: { in: [] } };
  if (key === 'du-moment') conditions.push({ featured: true });
  else if (key === 'nouveaute-de-la-semaine')
    conditions.push({
      newArrival: true,
      publishedAt: { gte: new Date(now.getTime() - 7 * 86400000), lte: now },
    });
  else if (key === 'retour-en-stock')
    conditions.push({ id: { in: await restockedIds() } });
  else if (key === 'derniers-exemplaires') {
    const threshold = getPrisma().productVariant.fields.lowStockThreshold;
    conditions.push({
      variants: {
        some: {
          isActive: true,
          price: { gt: 0 },
          availableQuantity: { gt: 0, lte: threshold },
        },
        none: { isActive: true, availableQuantity: { gt: threshold } },
      },
    });
  } else {
    conditions.push({ tags: { some: { slug: key } } });
    if (key === 'a-garder-scelle') {
      conditions.push({
        productType: { in: Object.values(ProductType).filter(isSealedProduct) },
      });
    }
  }
  return { AND: [shopProductWhere, ...conditions] };
}
