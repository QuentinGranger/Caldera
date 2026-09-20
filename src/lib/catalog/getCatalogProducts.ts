import { descendantIds } from './categoryTree';
import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { getPrisma } from '@/lib/db/prisma';
import {
  catalogProductSelect,
  toCatalogProduct,
  visibleProductWhere,
} from './queries';
import { getCategories, type CatalogCategory } from './taxonomy';
import {
  CATALOG_PAGE_SIZE,
  type CatalogFilters,
  type CatalogScope,
  type CatalogSort,
} from './params';

export function buildCatalogWhere(
  filters: CatalogFilters,
  scope: CatalogScope,
  categories: CatalogCategory[],
) {
  const db = getPrisma();
  const variant: Prisma.ProductVariantWhereInput = {
    isActive: true,
    ...(filters.language.length ? { language: { in: filters.language } } : {}),
    ...(filters.minPrice || filters.maxPrice
      ? {
          price: {
            ...(filters.minPrice ? { gte: filters.minPrice } : {}),
            ...(filters.maxPrice ? { lte: filters.maxPrice } : {}),
          },
        }
      : {}),
  };
  if (filters.availability.length) {
    variant.OR = filters.availability.map((value) =>
      value === 'preorder'
        ? { product: { preorder: true } }
        : {
            product: { preorder: false },
            availableQuantity:
              value === 'in-stock'
                ? { gt: 0 }
                : { gt: 0, lte: db.productVariant.fields.lowStockThreshold },
          },
    );
  }
  const conditions: Prisma.ProductWhereInput[] = [visibleProductWhere];
  if (scope.category)
    conditions.push({
      categoryId: { in: descendantIds(categories, [scope.category]) },
    });
  if (filters.category.length)
    conditions.push({
      categoryId: { in: descendantIds(categories, filters.category) },
    });
  if (scope.set) conditions.push({ tcgSet: { slug: scope.set } });
  if (filters.set.length)
    conditions.push({ tcgSet: { slug: { in: filters.set } } });
  if (scope.newArrival) conditions.push({ newArrival: true });
  if (scope.preorder) conditions.push({ preorder: true });
  if (filters.type.length)
    conditions.push({ productType: { in: filters.type } });
  if (filters.search) {
    // contains utilise LIKE : échapper les jokers pour rechercher un texte littéral.
    const contains = filters.search.replace(/[\\%_]/g, '\\$&');
    conditions.push({
      OR: [
        { name: { contains, mode: 'insensitive' } },
        { shortDescription: { contains, mode: 'insensitive' } },
        { slug: { contains, mode: 'insensitive' } },
        { tcgSet: { name: { contains, mode: 'insensitive' } } },
      ],
    });
  }
  conditions.push({ variants: { some: variant } });
  return {
    where: { AND: conditions } satisfies Prisma.ProductWhereInput,
    variant,
  };
}
export function buildCatalogOrderBy(
  sort: CatalogSort,
): Prisma.ProductOrderByWithRelationInput[] {
  const published = { publishedAt: { sort: 'desc', nulls: 'last' } } as const;
  if (sort === 'name-asc') return [{ name: 'asc' }, { id: 'asc' }];
  if (sort === 'newest')
    return [
      published,
      { releaseDate: { sort: 'desc', nulls: 'last' } },
      { id: 'asc' },
    ];
  return [
    { featured: 'desc' },
    published,
    { releaseDate: { sort: 'desc', nulls: 'last' } },
    { id: 'asc' },
  ];
}
export async function getCatalogProducts(
  filters: CatalogFilters,
  scope: CatalogScope = {},
) {
  const categories = await getCategories();
  const { where, variant } = buildCatalogWhere(filters, scope, categories);
  const select = {
    ...catalogProductSelect,
    tags: false,
    variants: {
      where: variant,
      select: {
        sku: true,
        price: true,
        compareAtPrice: true,
        isDefault: true,
        isActive: true,
        stockQuantity: true,
        reservedQuantity: true,
        lowStockThreshold: true,
      },
    },
  } satisfies Prisma.ProductSelect;
  return getPrisma().$transaction(
    async (tx) => {
      // Le total précède la lecture : il permet de borner la page dans le même snapshot.
      const total = await tx.product.count({ where });
      const pageCount = Math.max(1, Math.ceil(total / CATALOG_PAGE_SIZE));
      const page = Math.min(filters.page, pageCount);
      const pagination = {
        skip: (page - 1) * CATALOG_PAGE_SIZE,
        take: CATALOG_PAGE_SIZE,
      };
      let products;
      if (filters.sort === 'price-asc' || filters.sort === 'price-desc') {
        // Prisma ne trie pas Product par MIN(variants.price) : groupBy pagine en SQL.
        const groups = await tx.productVariant.groupBy({
          by: ['productId'],
          where: { AND: [variant, { product: where }] },
          _min: { price: true },
          orderBy: [
            { _min: { price: filters.sort === 'price-asc' ? 'asc' : 'desc' } },
            { productId: 'asc' },
          ],
          ...pagination,
        });
        const ids = groups.map((g) => g.productId);
        const rows = await tx.product.findMany({
          where: { id: { in: ids } },
          select,
        });
        const byId = new Map(rows.map((row) => [row.id, row]));
        products = ids.map((id) => toCatalogProduct(byId.get(id)!));
      } else {
        const rows = await tx.product.findMany({
          where,
          select,
          orderBy: buildCatalogOrderBy(filters.sort),
          ...pagination,
        });
        products = rows.map(toCatalogProduct);
      }
      return { products, total, page, pageSize: CATALOG_PAGE_SIZE, pageCount };
    },
    { isolationLevel: 'RepeatableRead', timeout: 10000 },
  );
}
export type CatalogResult = Awaited<ReturnType<typeof getCatalogProducts>>;
