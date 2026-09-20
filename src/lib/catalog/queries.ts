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
// Futur cache Next.js : envelopper cette frontière puis invalider le tag "catalog".
const publishedProductWhere: Prisma.ProductWhereInput = {
  status: 'ACTIVE',
  category: { isActive: true },
  OR: [{ tcgSetId: null }, { tcgSet: { isActive: true } }],
};
export const visibleProductWhere: Prisma.ProductWhereInput = {
  ...publishedProductWhere,
  variants: { some: { isActive: true } },
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
    ...(badge ? { badge } : {}),
  };
}
function boundedLimit(limit: number): number {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new RangeError('La limite doit être un entier entre 1 et 100.');
  return limit;
}
async function list(
  where: Prisma.ProductWhereInput = {},
  limit?: number,
): Promise<CatalogProduct[]> {
  const rows = await getPrisma().product.findMany({
    where: { AND: [visibleProductWhere, where] },
    select: catalogProductSelect,
    orderBy: [
      { publishedAt: { sort: 'desc', nulls: 'last' } },
      { slug: 'asc' },
    ],
    ...(limit === undefined ? {} : { take: boundedLimit(limit) }),
  });
  return rows.map(toCatalogProduct);
}
export function getProducts() {
  return list();
}
export function getFeaturedProducts(limit = 4) {
  return list({ featured: true }, limit);
}
// newArrival est un choix éditorial ; publishedAt ordonne les nouveautés.
export function getNewProducts(limit = 4) {
  return list({ newArrival: true }, limit);
}
export function getProductsBySet(slug: string) {
  return list({ tcgSet: { slug, isActive: true } });
}
export async function getProductsByCategory(slug: string) {
  const categories = await getPrisma().category.findMany({
    where: { isActive: true },
    select: { id: true, parentId: true, slug: true },
  });
  return list({ categoryId: { in: descendantIds(categories, [slug]) } });
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
export const getProductBySlug = cache(async (slug: string) => {
  const product = await getPrisma().product.findFirst({
    where: { AND: [publishedProductWhere, { slug }] },
    select: {
      ...catalogProductSelect,
      variants: {
        ...catalogProductSelect.variants,
        select: { ...variantSelect, weightGrams: true },
      },
      tcgSet: {
        select: {
          name: true,
          slug: true,
          series: true,
          logoUrl: true,
          releaseDate: true,
        },
      },
      description: true,
      shortDescription: true,
      releaseDate: true,
      images: { select: imageSelect, orderBy: imageOrder },
    },
  });
  if (!product) return null;
  return {
    ...toCatalogProduct(product),
    productType: product.productType,
    preorder: product.preorder,
    newArrival: product.newArrival,
    categoryInfo: product.category,
    tcgSet: product.tcgSet
      ? {
          ...product.tcgSet,
          releaseDate: product.tcgSet.releaseDate?.toISOString() ?? null,
        }
      : null,
    description: product.description,
    shortDescription: product.shortDescription,
    releaseDate: product.releaseDate?.toISOString() ?? null,
    images: product.images.map((image) => ({
      ...image,
      ...getProductVisual(product.productType, product.name, image),
    })),
    variants: product.variants.map((variant): ProductVariantView => ({
      id: variant.id,
      sku: variant.sku,
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
    })),
  };
});
export type ProductDetail = NonNullable<
  Awaited<ReturnType<typeof getProductBySlug>>
>;

export async function getHomeCategories() {
  const categories = await getPrisma().category.findMany({
    where: {
      isActive: true,
      slug: { in: ['pokemon', 'scelles', 'cartes', 'accessoires'] },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      imageUrl: true,
    },
    orderBy: [{ sortOrder: 'asc' }, { slug: 'asc' }],
  });
  return categories.map((category) => ({
    ...category,
    imageUrl: getCategoryImage(category.slug, category.imageUrl),
  }));
}
export async function getCollections() {
  const sets = await getPrisma().tcgSet.findMany({
    where: { isActive: true, products: { some: visibleProductWhere } },
    take: 2,
    orderBy: { slug: 'asc' },
    select: {
      name: true,
      slug: true,
      products: {
        where: visibleProductWhere,
        select: {
          slug: true,
          name: true,
          productType: true,
          images: { select: imageSelect, take: 1, orderBy: imageOrder },
        },
        take: 1,
        orderBy: { slug: 'asc' },
      },
    },
  });
  return sets.map((set) => ({
    name: set.name,
    slug: set.slug,
    href: `/extensions/${set.slug}`,
    image: getProductVisual(
      set.products[0]!.productType,
      set.products[0]!.name,
      set.products[0]!.images[0],
    ).url,
  }));
}
