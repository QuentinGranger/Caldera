import type { ProductLanguage } from '@/generated/prisma/client';
export type ProductBadgeKind = 'new' | 'preorder' | 'sold-out' | 'limited';
export type Availability =
  'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'PREORDER';
/**
 * DTO public : montants décimaux sérialisés, aucun coût ni stock interne (sauf
 * les dernières pièces, comptées comme sur la fiche produit).
 */
export type CatalogProduct = {
  isDemonstration?: boolean;
  id: string;
  name: string;
  slug: string;
  category: string;
  tcgSet: { name: string; slug: string } | null;
  tags: { name: string; slug: string }[];
  price: string | null;
  compareAtPrice: string | null;
  priceFrom: boolean;
  image: string;
  imageAlt: string;
  availability: Availability;
  /** Languages of the variants on sale here, in the shop's order. */
  languages: ProductLanguage[];
  quickAddVariantId?: string | null;
  badge?: ProductBadgeKind;
  /**
   * Last pieces only (LOW_STOCK): how many are left, as the product page
   * already says it. Never the stock of a product that is not running out.
   */
  lowStockLeft?: number;
};
