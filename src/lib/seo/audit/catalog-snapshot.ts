// Read-only snapshot of the catalog for the SEO audit: only SELECT queries,
// long texts reduced to flags so 50 000 products stay light in memory.
import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { visibleProductWhere } from '@/lib/catalog/queries';
import type { AuditProduct, CatalogSnapshot } from './catalog';

type ReadClient = Pick<
  Prisma.TransactionClient,
  'game' | 'tcgSet' | 'category' | 'product' | 'productImage' | '$queryRaw'
>;

interface ProductRow {
  id: string;
  slug: string;
  name: string;
  productType: string;
  gameId: string | null;
  tcgSetId: string | null;
  categoryId: string;
  seoTitle: string | null;
  seoDescription: string | null;
  hasDescription: boolean;
}

const seoSelect = {
  seoTitle: true,
  seoDescription: true,
} as const;

export async function loadCatalogSnapshot(
  db: ReadClient,
  now = new Date(),
): Promise<CatalogSnapshot> {
  const games = await db.game.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      isActive: true,
      faq: true,
      ...seoSelect,
    },
    orderBy: [{ sortOrder: 'asc' }, { slug: 'asc' }],
  });
  const sets = await db.tcgSet.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      isActive: true,
      gameId: true,
      releaseDate: true,
      faq: true,
      ...seoSelect,
    },
    orderBy: { slug: 'asc' },
  });
  const categories = await db.category.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      isActive: true,
      parentId: true,
      faq: true,
      ...seoSelect,
    },
    orderBy: [{ sortOrder: 'asc' }, { slug: 'asc' }],
  });
  const products = await db.$queryRaw<ProductRow[]>`
    SELECT p."id"::text AS "id", p."slug", p."name",
      p."productType"::text AS "productType",
      p."gameId"::text AS "gameId", p."tcgSetId"::text AS "tcgSetId",
      p."categoryId"::text AS "categoryId", p."seoTitle", p."seoDescription",
      COALESCE(BTRIM(p."description") <> '', false) AS "hasDescription"
    FROM "Product" p
    ORDER BY p."slug"`;
  const visibleIds = new Set(
    (
      await db.product.findMany({
        where: visibleProductWhere,
        select: { id: true },
      })
    ).map((product) => product.id),
  );
  const images = await db.productImage.findMany({
    select: { productId: true, url: true, alt: true },
    orderBy: [{ productId: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
  });
  const imagesByProduct = new Map<string, AuditProduct['images']>();
  for (const image of images) {
    const list = imagesByProduct.get(image.productId) ?? [];
    list.push({ url: image.url, alt: image.alt });
    imagesByProduct.set(image.productId, list);
  }
  return {
    games,
    sets,
    categories,
    products: products.map((product) => ({
      ...product,
      visible: visibleIds.has(product.id),
      images: imagesByProduct.get(product.id) ?? [],
    })),
    now,
  };
}
