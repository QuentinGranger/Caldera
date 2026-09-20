import 'server-only';
import type { ProductVariant } from '@/generated/prisma/client';
type PricedVariant = Pick<
  ProductVariant,
  'sku' | 'price' | 'compareAtPrice' | 'isActive' | 'isDefault'
>;
export function getPricing(variants: readonly PricedVariant[]) {
  const active = variants
    .filter((variant) => variant.isActive)
    .sort(
      (a, b) =>
        a.price.comparedTo(b.price) ||
        Number(b.isDefault) - Number(a.isDefault) ||
        a.sku.localeCompare(b.sku),
    );
  const cheapest = active[0];
  if (!cheapest) return { price: null, compareAtPrice: null, priceFrom: false };
  return {
    price: cheapest.price.toFixed(2),
    compareAtPrice: cheapest.compareAtPrice?.greaterThan(cheapest.price)
      ? cheapest.compareAtPrice.toFixed(2)
      : null,
    priceFrom: active.some((variant) => !variant.price.equals(cheapest.price)),
  };
}
