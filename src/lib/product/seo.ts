// Product metadata and structured data (docs/seo-architecture.md §5 and §6),
// built from the product exactly as its page displays it.
import type { ProductDetail } from '@/lib/catalog/queries';
import {
  isPlaceholderImage,
  productNode,
  type JsonLdNode,
  type ShippingMethodInput,
} from '@/lib/seo/jsonld';
import {
  productMetadataText,
  type MetadataImage,
  type MetadataText,
} from '@/lib/seo/metadata';

/** Canonical path: /produit/{slug}, without ?variant. */
export function productPath(slug: string): string {
  return `/produit/${encodeURIComponent(slug)}`;
}

const toDate = (value: string | null) => (value ? new Date(value) : null);

/** Languages of the active variants, in display order. */
export function productLanguages(product: Pick<ProductDetail, 'variants'>) {
  return [...new Set(product.variants.map((variant) => variant.language))];
}

/** Title and description from real facts; seoTitle / seoDescription win. */
/**
 * Price announced in the description: the cheapest variant that can be bought
 * (in stock or open preorder), so « dès X € » is never a sold-out price.
 */
function purchasablePrice(product: ProductDetail) {
  const sellable = product.variants.filter(
    (variant) => variant.availability !== 'OUT_OF_STOCK',
  );
  if (!sellable.length)
    return { price: product.price, priceFrom: product.priceFrom };
  const prices = sellable.map((variant) => Number(variant.price));
  const cheapest = sellable[prices.indexOf(Math.min(...prices))]!;
  return { price: cheapest.price, priceFrom: new Set(prices).size > 1 };
}

export function productSeoText(product: ProductDetail): MetadataText {
  const { price, priceFrom } = purchasablePrice(product);
  return productMetadataText({
    name: product.name,
    categoryName: product.categoryInfo.name,
    setName: product.tcgSet?.name,
    gameName: product.game?.name,
    languages: productLanguages(product),
    price,
    priceFrom,
    availability: product.availability,
    preorder: product.preorder,
    releaseDate: toDate(product.releaseDate),
    overrides: {
      seoTitle: product.seoTitle,
      seoDescription: product.seoDescription,
    },
  });
}

/** First real photo of the gallery; replacement visuals are never shared. */
export function productShareImage(
  product: Pick<ProductDetail, 'images'>,
): MetadataImage | null {
  const image = product.images.find(({ url }) => !isPlaceholderImage(url));
  return image ? { url: image.url, alt: image.alt } : null;
}

/**
 * Product node with one Offer per active variant; null without an active
 * variant (such a page is noindex and carries no Product markup).
 */
export function productStructuredData(
  product: ProductDetail,
  shippingMethods: readonly ShippingMethodInput[] = [],
): JsonLdNode | null {
  return productNode({
    name: product.name,
    path: productPath(product.slug),
    description:
      product.description?.trim() || product.shortDescription?.trim() || null,
    images: product.images.map((image) => image.url),
    brand: product.game?.name ?? null,
    category: product.categoryInfo.name,
    releaseDate: toDate(product.releaseDate),
    variants: product.variants.map((variant) => ({
      sku: variant.sku,
      barcode: variant.barcode,
      price: variant.price,
      isActive: true,
      availability: variant.availability,
    })),
    shippingMethods,
  });
}
