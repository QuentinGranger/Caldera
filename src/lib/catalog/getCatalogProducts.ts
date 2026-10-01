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
  withKnownSlugs,
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
  // A language scope keeps only its variants; a filter can only narrow it.
  const languages = !scope.language
    ? filters.language
    : filters.language.length
      ? filters.language.filter((language) => language === scope.language)
      : [scope.language];
  const variant: Prisma.ProductVariantWhereInput = {
    isActive: true,
    ...(languages.length || scope.language
      ? { language: { in: languages } }
      : {}),
    ...(scope.status === 'en-stock' ? { availableQuantity: { gt: 0 } } : {}),
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
  if (scope.game) conditions.push({ game: { slug: scope.game } });
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
  if (scope.newArrival || scope.status === 'nouveautes')
    conditions.push({ newArrival: true });
  if (scope.preorder || scope.status === 'precommandes')
    conditions.push({ preorder: true });
  // Same rule as ScopeStats.inStockCount: a preorder is never « en stock ».
  if (scope.status === 'en-stock') conditions.push({ preorder: false });
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
  requested: CatalogFilters,
  scope: CatalogScope = {},
) {
  const db = getPrisma();
  const [categories, knownSets] = await Promise.all([
    getCategories(),
    requested.set.length
      ? db.tcgSet.findMany({
          where: { slug: { in: requested.set }, isActive: true },
          select: { slug: true },
        })
      : Promise.resolve([]),
  ]);
  const filters = withKnownSlugs(requested, {
    categories: new Set(categories.map((category) => category.slug)),
    sets: new Set(knownSets.map((set) => set.slug)),
  });
  const { where, variant } = buildCatalogWhere(filters, scope, categories);
  const select = {
    ...catalogProductSelect,
    tags: false,
    variants: {
      where: variant,
      select: {
        id: true,
        sku: true,
        language: true,
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
  const readPage = async (page: number) => {
    const pagination = {
      skip: (page - 1) * CATALOG_PAGE_SIZE,
      take: CATALOG_PAGE_SIZE,
    };
    if (filters.sort === 'price-asc' || filters.sort === 'price-desc') {
      // Prisma ne trie pas Product par MIN(variants.price) : groupBy pagine en SQL.
      const groups = await db.productVariant.groupBy({
        by: ['productId'],
        where: { AND: [variant, { product: where }] },
        _min: { price: true },
        orderBy: [
          { _min: { price: filters.sort === 'price-asc' ? 'asc' : 'desc' } },
          { productId: 'asc' },
        ],
        ...pagination,
      });
      if (!groups.length) return [];
      const ids = groups.map((g) => g.productId);
      const rows = await db.product.findMany({
        where: { id: { in: ids } },
        select,
      });
      const byId = new Map(rows.map((row) => [row.id, row]));
      return ids.flatMap((id) => {
        const row = byId.get(id);
        return row ? [toCatalogProduct(row)] : [];
      });
    }
    const rows = await db.product.findMany({
      where,
      select,
      orderBy: buildCatalogOrderBy(filters.sort),
      ...pagination,
    });
    return rows.map(toCatalogProduct);
  };
  // Count and page run in parallel; an out-of-range page is read again once bounded.
  const [total, requestedPage] = await Promise.all([
    db.product.count({ where }),
    readPage(filters.page),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / CATALOG_PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  const products = page === filters.page ? requestedPage : await readPage(page);
  return {
    products,
    total,
    page,
    pageSize: CATALOG_PAGE_SIZE,
    pageCount,
    /** Effective filters: unknown slugs removed, page bounded. */
    filters: { ...filters, page },
  };
}
export type CatalogResult = Awaited<ReturnType<typeof getCatalogProducts>>;
