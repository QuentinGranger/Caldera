export type ProductBadgeKind = 'new' | 'preorder' | 'sold-out' | 'limited';
export type Availability =
  'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'PREORDER';
/** DTO public : montants décimaux sérialisés, aucun coût ni stock interne. */
export type CatalogProduct = {
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
  quickAddVariantId: string | null;
  badge?: ProductBadgeKind;
};
