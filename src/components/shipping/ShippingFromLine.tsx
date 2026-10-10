import Link from 'next/link';
import { Truck } from 'lucide-react';
import type { ShippingOptionView } from '@/lib/product/services';
import { freeThresholdLabel, shippingFromLabel } from '@/lib/shipping/summary';
import styles from './ShippingFromLine.module.scss';

const DELIVERY_PATH = '/livraison';

/**
 * Delivery in one line, wherever a price is read: « Livraison dès 5,90 € »,
 * and the free threshold when a method has one. Nothing while no method is
 * offered.
 */
export function ShippingFromLine({
  offers,
  tone = 'day',
  details = true,
}: {
  offers: readonly ShippingOptionView[];
  /** `night`: on a dark surface. */
  tone?: 'day' | 'night';
  /** The « Détails » link to /livraison: not where a link is already offered. */
  details?: boolean;
}) {
  const from = shippingFromLabel(offers);
  if (!from) return null;
  const threshold = freeThresholdLabel(offers);
  return (
    <p className={`${styles.line} ${tone === 'night' ? styles.night : ''}`}>
      <Truck size={18} aria-hidden="true" />
      <span>
        <strong>{from}</strong>
        {threshold && <> · {threshold}</>}
        {details && (
          <>
            {' '}
            <Link href={DELIVERY_PATH}>Détails</Link>
          </>
        )}
      </span>
    </p>
  );
}
