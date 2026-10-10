import { availabilityLabels } from '@/lib/catalog/getAvailability';
import type { ProductVariantView } from './purchase';

export type StockTone = 'available' | 'low' | 'preorder' | 'none';

/** The words of the product page for a variant's stock, and their tone. */
export function stockLabel(variant: ProductVariantView): {
  text: string;
  tone: StockTone;
} {
  if (variant.availability === 'OUT_OF_STOCK')
    return { text: 'Rupture de stock', tone: 'none' };
  if (variant.lowStockQuantity !== null)
    return {
      text: `Plus que ${variant.lowStockQuantity} en stock`,
      tone: 'low',
    };
  return {
    text: availabilityLabels[variant.availability],
    tone: variant.availability === 'PREORDER' ? 'preorder' : 'available',
  };
}
