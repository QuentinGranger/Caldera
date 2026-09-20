import type { Metadata } from 'next';
import type { ProductDetail } from '@/lib/catalog/queries';
import { selectProductVariant } from './purchase';
const availabilityUrls = {
  IN_STOCK: 'https://schema.org/InStock',
  LOW_STOCK: 'https://schema.org/InStock',
  OUT_OF_STOCK: 'https://schema.org/OutOfStock',
  PREORDER: 'https://schema.org/PreOrder',
} as const;
function absoluteUrl(path: string): string | undefined {
  if (!process.env.SITE_URL) return undefined;
  try {
    const origin = new URL(process.env.SITE_URL);
    if (!['https:', 'http:'].includes(origin.protocol)) return undefined;
    return new URL(path, origin.origin).href;
  } catch {
    return undefined;
  }
}
export function productDescription(product: ProductDetail) {
  return (
    product.shortDescription?.trim() ||
    product.description?.trim() ||
    product.name
  )
    .replace(/\s+/g, ' ')
    .slice(0, 160);
}
export function productMetadata(product: ProductDetail): Metadata {
  const path = `/produit/${encodeURIComponent(product.slug)}`;
  const url = absoluteUrl(path),
    image = absoluteUrl(product.image),
    description = productDescription(product);
  return {
    title: `${product.name} | Les Terres de Caldera`,
    description,
    ...(url ? { alternates: { canonical: url } } : {}),
    openGraph: {
      type: 'website',
      locale: 'fr_FR',
      siteName: 'Les Terres de Caldera',
      title: product.name,
      description,
      ...(url ? { url } : {}),
      ...(image ? { images: [{ url: image, alt: product.imageAlt }] } : {}),
    },
  };
}
export function productJsonLd(product: ProductDetail) {
  const variant = selectProductVariant(product.variants);
  const path = `/produit/${encodeURIComponent(product.slug)}`,
    url = absoluteUrl(path) ?? path;
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: productDescription(product),
    image: [
      ...new Set(
        (product.images.length ? product.images : [{ url: product.image }]).map(
          (image) => absoluteUrl(image.url) ?? image.url,
        ),
      ),
    ],
    url,
    ...(variant
      ? {
          sku: variant.sku,
          offers: {
            '@type': 'Offer',
            price: variant.price,
            priceCurrency: 'EUR',
            availability: availabilityUrls[variant.availability],
            itemCondition: 'https://schema.org/NewCondition',
            url,
          },
        }
      : {}),
  };
}
export function serializeJsonLd(value: ReturnType<typeof productJsonLd>) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
