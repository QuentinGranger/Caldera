import { ProductBadge } from '@/components/product/ProductBadge/ProductBadge';
import { getProductBadge } from '@/lib/catalog/getAvailability';
import type { ProductVariantView } from '@/lib/product/purchase';
import { stockLabel } from '@/lib/product/stock';
import styles from './StockStatus.module.scss';

/**
 * The stock, clear and next to the price: a pill with its dot, in the colour
 * of what it says. A live region: it is read again when the version changes.
 */
export function StockStatus({
  variant,
  newArrival,
}: {
  variant: ProductVariantView;
  newArrival: boolean;
}) {
  const { text, tone } = stockLabel(variant);
  const badge = getProductBadge(variant.availability, newArrival);
  return (
    <div className={styles.stock} role="status">
      <span className={styles.pill} data-tone={tone}>
        {text}
      </span>
      {badge && <ProductBadge kind={badge} />}
    </div>
  );
}
