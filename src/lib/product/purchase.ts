import type {
  ProductCondition,
  ProductLanguage,
  ProductType,
} from '@/generated/prisma/client';
import type { Availability } from '@/types/product';
export type ProductVariantView = {
  id: string;
  sku: string;
  language: ProductLanguage;
  condition: ProductCondition;
  isDefault: boolean;
  price: string;
  compareAtPrice: string | null;
  availability: Availability;
  maxQuantity: number;
  lowStockQuantity: number | null;
  weightGrams: number | null;
};
export const productTypeLabels: Record<ProductType, string> = {
  BOOSTER: 'Booster',
  BLISTER: 'Blister',
  TRIPACK: 'Tripack',
  BUNDLE: 'Bundle',
  DISPLAY: 'Display',
  ETB: 'Elite Trainer Box',
  COLLECTION_BOX: 'Coffret',
  TIN: 'Tin',
  DECK: 'Deck',
  ACCESSORY: 'Accessoire',
  SINGLE_CARD: 'Carte à l’unité',
  OTHER: 'Produit de collection',
};
export const conditionLabels: Record<ProductCondition, string> = {
  NEW: 'Neuf',
};
export function selectProductVariant(
  variants: readonly ProductVariantView[],
  sku?: string | null,
) {
  return (
    variants.find((v) => v.sku === sku) ??
    [...variants].sort(
      (a, b) =>
        Number(b.isDefault) - Number(a.isDefault) ||
        (a.sku < b.sku ? -1 : a.sku > b.sku ? 1 : 0),
    )[0] ??
    null
  );
}
export function normalizeQuantity(value: string | number, max: number): number {
  if (max < 1) return 1;
  const input = String(value).trim();
  if (!/^\d+$/.test(input)) return 1;
  const quantity = Number(input);
  return Number.isSafeInteger(quantity)
    ? Math.max(1, Math.min(max, quantity))
    : 1;
}
export function canPreparePurchase(
  variant: ProductVariantView | null,
  quantity: number,
): boolean {
  return Boolean(
    variant &&
    variant.availability !== 'OUT_OF_STOCK' &&
    variant.maxQuantity > 0 &&
    Number.isInteger(quantity) &&
    quantity >= 1 &&
    quantity <= variant.maxQuantity,
  );
}
