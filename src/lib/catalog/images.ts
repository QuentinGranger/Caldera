import type { ProductType } from '@/generated/prisma/client';

const legacyPlaceholder = '/assets/products/placeholder-product.png';

export function getProductPlaceholder(type: ProductType): string {
  if (type === 'ACCESSORY')
    return '/assets/products/placeholder-accessories.png';
  if (type === 'SINGLE_CARD') return '/assets/products/placeholder-card.png';
  return '/assets/products/placeholder-sealed.png';
}

function hasVisual(url?: string | null): url is string {
  return Boolean(url?.trim()) && url?.trim() !== legacyPlaceholder;
}

export function getProductVisual(
  type: ProductType,
  name: string,
  image?: { url: string; alt: string },
) {
  return hasVisual(image?.url)
    ? { url: image.url, alt: image.alt || name }
    : {
        url: getProductPlaceholder(type),
        alt: `Visuel de remplacement Caldera — ${name}`,
      };
}

const categoryIllustrations: Record<string, string> = {
  pokemon: '/assets/images/products/charizard.png',
  scelles: '/assets/images/products/prismatic.png',
  cartes: '/assets/images/products/pikachu-v.png',
  accessoires: '/assets/images/products/sleeves.png',
};

export function getCategoryImage(
  slug: string,
  imageUrl?: string | null,
): string {
  if (hasVisual(imageUrl)) return imageUrl;
  return categoryIllustrations[slug] ?? getProductPlaceholder('OTHER');
}
