import { availableQuantity } from '@/lib/inventory/availability';
import type { ProductVariant } from '@/generated/prisma/client';
import type { Availability, ProductBadgeKind } from '@/types/product';
type StockVariant = Pick<
  ProductVariant,
  'isActive' | 'stockQuantity' | 'reservedQuantity' | 'lowStockThreshold'
>;
export function getAvailability(
  preorder: boolean,
  variants: readonly StockVariant[],
): Availability {
  const active = variants.filter((variant) => variant.isActive);
  if (!active.length) return 'OUT_OF_STOCK';
  if (preorder) return 'PREORDER';
  if (
    active.some(
      (variant) => availableQuantity(variant) > variant.lowStockThreshold,
    )
  )
    return 'IN_STOCK';
  if (active.some((variant) => availableQuantity(variant) > 0))
    return 'LOW_STOCK';
  return 'OUT_OF_STOCK';
}
export function getProductBadge(
  availability: Availability,
  newArrival: boolean,
): ProductBadgeKind | undefined {
  if (availability === 'PREORDER') return 'preorder';
  if (availability === 'OUT_OF_STOCK') return 'sold-out';
  if (availability === 'LOW_STOCK') return 'limited';
  return newArrival ? 'new' : undefined;
}
export const availabilityLabels: Record<Availability, string> = {
  IN_STOCK: 'En stock',
  LOW_STOCK: 'Dernières pièces',
  OUT_OF_STOCK: 'Rupture',
  PREORDER: 'Précommande',
};
