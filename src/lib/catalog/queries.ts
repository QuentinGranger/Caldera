import { availableQuantity } from '@/lib/inventory/availability';
import 'server-only';
import { descendantIds } from './categoryTree';
import { cache } from 'react';
import type { Prisma } from '@/generated/prisma/client';
import { getPrisma } from '@/lib/db/prisma';
import { getAvailability, getProductBadge } from './getAvailability';
import { getPricing } from './getPricing';
import { getCategoryImage, getProductVisual } from './images';
import type { ProductVariantView } from '@/lib/product/purchase';
import type { CatalogProduct } from '@/types/product';

// Lectures non persistées : Studio est visible au prochain rafraîchissement.
// Published product: every parent (category, set, game) is active; the SQL facts
// of src/lib/seo/registry.ts apply the same rules.
export const publishedProductWhere: Prisma.ProductWhereInput = {
  status: 'ACTIVE',
  category: { isActive: true },
  AND: [
    { OR: [{ tcgSetId: null }, { tcgSet: { isActive: true } }] },
    { OR: [{ gameId: null }, { game: { isActive: true } }] },
  ],
};
export const visibleProductWhere: Prisma.ProductWhereInput = {
  ...publishedProductWhere,
  variants: { some: { isActive: true } },
};
/** Purchasable now: in stock (outside preorder) or open for preorder. */
export const availableProductWhere: Prisma.ProductWhereInput = {
  OR: [
    { preorder: true },
    { variants: { some: { isActive: true, availableQuantity: { gt: 0 } } } },
  ],
};
const variantSelect = {
  id: true,
  sku: true,
  language: true,
  condition: true,
  price: true,
  compareAtPrice: true,
  isDefault: true,
  isActive: true,
  stockQuantity: true,
  reservedQuantity: true,
  lowStockThreshold: true,
} satisfies Prisma.ProductVariantSelect;
const imageSelect = {
  url: true,
  alt: true,
  sortOrder: true,
  isPrimary: true,
} satisfies Prisma.ProductImageSelect;
const imageOrder = [
  { isPrimary: 'desc' },
  { sortOrder: 'asc' },
  { id: 'asc' },
] satisfies Prisma.ProductImageOrderByWithRelationInput[];
const gameSelect = {
  id: true,
  slug: true,
  name: true,
} satisfies Prisma.GameSelect;
export const catalogProductSelect = {
  id: true,
  name: true,
  slug: true,
  productType: true,
  preorder: true,
  newArrival: true,
  category: { select: { name: true, slug: true } },
  tcgSet: { select: { name: true, slug: true } },
  tags: { select: { name: true, slug: true }, orderBy: { slug: 'asc' } },
  variants: {
    where: { isActive: true },
    select: variantSelect,
    orderBy: [{ isDefault: 'desc' }, { sku: 'asc' }],
  },
  images: { select: imageSelect, orderBy: imageOrder, take: 1 },
} satisfies Prisma.ProductSelect;
type Row = Prisma.ProductGetPayload<{ select: typeof catalogProductSelect }>;
export function toCatalogProduct(
  product: Omit<Row, 'tags' | 'variants'> & {
    tags?: Row['tags'];
    variants: Pick<
      Row['variants'][number],
      | 'id'
      | 'sku'
      | 'price'
      | 'compareAtPrice'
      | 'isDefault'
      | 'isActive'
      | 'stockQuantity'
      | 'reservedQuantity'
      | 'lowStockThreshold'
    >[];
  },
): CatalogProduct {
  const image = getProductVisual(
    product.productType,
    product.name,
    product.images[0],
  );
  const availability = getAvailability(product.preorder, product.variants);
  const badge = getProductBadge(availability, product.newArrival);
  const quickAddVariant =
    [...product.variants]
      .filter((variant) => variant.isActive && availableQuantity(variant) > 0)
      .sort(
        (a, b) =>
          a.price.comparedTo(b.price) ||
          Number(b.isDefault) - Number(a.isDefault) ||
          a.sku.localeCompare(b.sku),
      )[0] ?? null;
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    category: product.category.name,
    tcgSet: product.tcgSet,
    tags: product.tags ?? [],
    image: image.url,
    imageAlt: image.alt,
    ...getPricing(product.variants),
    availability,
    quickAddVariantId: quickAddVariant?.id ?? null,
    ...(badge ? { badge } : {}),
  };
}
function boundedLimit(limit: number): number {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new RangeError('La limite doit être un entier entre 1 et 100.');
  return limit;
}
const listOrder = [
  { publishedAt: { sort: 'desc', nulls: 'last' } },
  { slug: 'asc' },
] satisfies Prisma.ProductOrderByWithRelationInput[];
async function list(
  where: Prisma.ProductWhereInput,
  limit: number,
): Promise<CatalogProduct[]> {
  const rows = await getPrisma().product.findMany({
    where: { AND: [visibleProductWhere, where] },
    select: catalogProductSelect,
    orderBy: listOrder,
    take: boundedLimit(limit),
  });
  return rows.map(toCatalogProduct);
}
/** Bounded: the full catalogue is paginated by getCatalogProducts. */
export function getProducts(limit = 100) {
  return list({}, limit);
}
export function getFeaturedProducts(limit = 4) {
  return list({ featured: true }, limit);
}
// newArrival est un choix éditorial ; publishedAt ordonne les nouveautés.
export function getNewProducts(limit = 4) {
  return list({ newArrival: true }, limit);
}
export function getProductsBySet(slug: string, limit = 100) {
  return list({ tcgSet: { slug, isActive: true } }, limit);
}
export async function getProductsByCategory(slug: string, limit = 100) {
  const categories = await getPrisma().category.findMany({
    where: { isActive: true },
    select: { id: true, parentId: true, slug: true },
  });
  return list({ categoryId: { in: descendantIds(categories, [slug]) } }, limit);
}
// Sélection éditoriale, pas un historique de mouvements de stock.
export function getRestockedProducts(limit = 3) {
  return list(
    {
      preorder: false,
      tags: { some: { slug: 'reassort' } },
      variants: { some: { isActive: true, availableQuantity: { gt: 0 } } },
    },
    limit,
  );
}
const productOrder = [
  { featured: 'desc' },
  { publishedAt: { sort: 'desc', nulls: 'last' } },
  { id: 'asc' },
] satisfies Prisma.ProductOrderByWithRelationInput[];
/**
 * Visible products of `where`, purchasable ones first (in stock or preorder),
 * then sold-out ones to fill the remaining places.
 */
export async function listProductsAvailableFirst(
  where: Prisma.ProductWhereInput,
  limit: number,
  excludeIds: readonly string[] = [],
): Promise<CatalogProduct[]> {
  const take = boundedLimit(limit);
  const base: Prisma.ProductWhereInput[] = [visibleProductWhere, where];
  if (excludeIds.length) base.push({ id: { notIn: [...excludeIds] } });
  const available = await getPrisma().product.findMany({
    where: { AND: [...base, availableProductWhere] },
    select: catalogProductSelect,
    orderBy: productOrder,
    take,
  });
  if (available.length >= take) return available.map(toCatalogProduct);
  const soldOut = await getPrisma().product.findMany({
    where: { AND: [...base, { NOT: availableProductWhere }] },
    select: catalogProductSelect,
    orderBy: productOrder,
    take: take - available.length,
  });
  return [...available, ...soldOut].map(toCatalogProduct);
}

const productDetailSelect = {
  ...catalogProductSelect,
  status: true,
  seoTitle: true,
  seoDescription: true,
  updatedAt: true,
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
      parentId: true,
      isActive: true,
    },
  },
  game: { select: { ...gameSelect, isActive: true } },
  variants: {
    ...catalogProductSelect.variants,
    select: { ...variantSelect, barcode: true, weightGrams: true },
  },
  tcgSet: {
    select: {
      id: true,
      name: true,
      slug: true,
      code: true,
      series: true,
      logoUrl: true,
      releaseDate: true,
      gameId: true,
      isActive: true,
    },
  },
  description: true,
  shortDescription: true,
  releaseDate: true,
  images: { select: imageSelect, orderBy: imageOrder },
} satisfies Prisma.ProductSelect;
type ProductDetailRow = Prisma.ProductGetPayload<{
  select: typeof productDetailSelect;
}>;

function toProductDetail(product: ProductDetailRow) {
  return {
    ...toCatalogProduct(product),
    productType: product.productType,
    preorder: product.preorder,
    newArrival: product.newArrival,
    categoryInfo: {
      id: product.category.id,
      name: product.category.name,
      slug: product.category.slug,
      parentId: product.category.parentId,
    },
    game: product.game
      ? {
          id: product.game.id,
          slug: product.game.slug,
          name: product.game.name,
        }
      : null,
    tcgSet: product.tcgSet
      ? {
          id: product.tcgSet.id,
          name: product.tcgSet.name,
          slug: product.tcgSet.slug,
          code: product.tcgSet.code,
          series: product.tcgSet.series,
          logoUrl: product.tcgSet.logoUrl,
          gameId: product.tcgSet.gameId,
          releaseDate: product.tcgSet.releaseDate?.toISOString() ?? null,
        }
      : null,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    updatedAt: product.updatedAt.toISOString(),
    description: product.description,
    shortDescription: product.shortDescription,
    releaseDate: product.releaseDate?.toISOString() ?? null,
    images: product.images.map((image) => ({
      ...image,
      ...getProductVisual(product.productType, product.name, image),
    })),
    variants: product.variants.map(
      (variant): ProductVariantView & { barcode: string | null } => ({
        id: variant.id,
        sku: variant.sku,
        barcode: variant.barcode,
        language: variant.language,
        condition: variant.condition,
        isDefault: variant.isDefault,
        price: variant.price.toFixed(2),
        compareAtPrice: variant.compareAtPrice?.greaterThan(variant.price)
          ? variant.compareAtPrice.toFixed(2)
          : null,
        availability: getAvailability(product.preorder, [variant]),
        maxQuantity: availableQuantity(variant),
        lowStockQuantity:
          getAvailability(product.preorder, [variant]) === 'LOW_STOCK'
            ? availableQuantity(variant)
            : null,
        weightGrams: variant.weightGrams,
      }),
    ),
  };
}
export type ProductDetail = ReturnType<typeof toProductDetail>;

/** Active parents of an archived product, to pick its redirect target. */
export interface ArchivedProductParents {
  id: string;
  slug: string;
  name: string;
  game: { id: string; slug: string; name: string } | null;
  tcgSet: { id: string; slug: string; name: string } | null;
  category: {
    id: string;
    slug: string;
    name: string;
    parentId: string | null;
  } | null;
}
export type ProductRoute =
  | { state: 'visible' | 'no-variant'; product: ProductDetail }
  | { state: 'archived'; product: ArchivedProductParents }
  | { state: 'missing'; product: null };

/**
 * visible: published with an active variant; no-variant: published, 200
 * noindex; archived: 308 to a parent; missing: DRAFT, unknown slug or inactive
 * parent (404 once SlugRedirect has been checked).
 */
export const getProductRoute = cache(
  async (slug: string): Promise<ProductRoute> => {
    const product = await getPrisma().product.findUnique({
      where: { slug },
      select: productDetailSelect,
    });
    if (!product) return { state: 'missing', product: null };
    if (product.status === 'ARCHIVED') {
      const game = product.game?.isActive ? product.game : null;
      return {
        state: 'archived',
        product: {
          id: product.id,
          slug: product.slug,
          name: product.name,
          game: game ? { id: game.id, slug: game.slug, name: game.name } : null,
          tcgSet:
            product.tcgSet?.isActive && game
              ? {
                  id: product.tcgSet.id,
                  slug: product.tcgSet.slug,
                  name: product.tcgSet.name,
                }
              : null,
          category: product.category.isActive
            ? {
                id: product.category.id,
                slug: product.category.slug,
                name: product.category.name,
                parentId: product.category.parentId,
              }
            : null,
        },
      };
    }
    // Same rules as publishedProductWhere.
    if (
      product.status !== 'ACTIVE' ||
      !product.category.isActive ||
      (product.tcgSet && !product.tcgSet.isActive) ||
      (product.game && !product.game.isActive)
    )
      return { state: 'missing', product: null };
    return {
      state: product.variants.length ? 'visible' : 'no-variant',
      product: toProductDetail(product),
    };
  },
);

/** Published product (active parents), with or without an active variant. */
export const getProductBySlug = cache(async (slug: string) => {
  const route = await getProductRoute(slug);
  return route.state === 'visible' || route.state === 'no-variant'
    ? route.product
    : null;
});

/** Active root families holding at least one visible product in their subtree. */
export async function getHomeCategories() {
  const db = getPrisma();
  const [categories, groups] = await Promise.all([
    db.category.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        imageUrl: true,
        parentId: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { slug: 'asc' }],
    }),
    db.product.groupBy({ by: ['categoryId'], where: visibleProductWhere }),
  ]);
  const byId = new Map(categories.map((category) => [category.id, category]));
  const rootsWithProducts = new Set<string>();
  for (const { categoryId } of groups) {
    // Climb to the root through active categories only; a cycle never ends on a root.
    const visited = new Set<string>();
    let current = byId.get(categoryId);
    while (current?.parentId && !visited.has(current.id)) {
      visited.add(current.id);
      current = byId.get(current.parentId);
    }
    if (current && !current.parentId) rootsWithProducts.add(current.id);
  }
  return categories
    .filter((category) => rootsWithProducts.has(category.id))
    .map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      imageUrl: getCategoryImage(category.slug, category.imageUrl),
    }));
}
/** Latest active sets with visible products, newest release first. */
