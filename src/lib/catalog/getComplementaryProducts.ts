import 'server-only';
import { listInStockProducts, type ProductDetail } from './queries';
import { isSealedProduct } from '@/lib/product/services';

/**
 * Explicit editorial tags, not name matching: a binder is not a sleeve and
 * a box for a different format must not be advertised as an ETB protector.
 */
export const PROTECTION_TAGS = {
  sleeves: 'sleeves',
  topLoaders: 'top-loaders',
  etb: 'protection-etb',
} as const;

export async function getComplementaryProducts(product: ProductDetail) {
  if (
    process.env.CATALOG_DEMO_MODE === '1' ||
    product.isDemonstration ||
    product.availability === 'OUT_OF_STOCK' ||
    (!isSealedProduct(product.productType) &&
      product.productType !== 'SINGLE_CARD')
  )
    return [];

  const tags: string[] = [PROTECTION_TAGS.sleeves, PROTECTION_TAGS.topLoaders];
  if (product.productType === 'ETB') tags.unshift(PROTECTION_TAGS.etb);
  // Keep a maximum of two additions, prioritising an ETB's dedicated box.
  const buckets = await Promise.all(
    tags.map((slug) =>
      listInStockProducts(
        {
          id: { not: product.id },
          productType: 'ACCESSORY',
          OR: [
            { gameId: null },
            ...(product.game ? [{ gameId: product.game.id }] : []),
          ],
          tags: { some: { slug } },
        },
        2,
      ),
    ),
  );
  const selected = new Map<string, (typeof buckets)[number][number]>();
  for (const bucket of buckets) {
    const first = bucket.find((item) => !selected.has(item.id));
    if (first) selected.set(first.id, first);
    if (selected.size === 2) break;
  }
  return [...selected.values()];
}
