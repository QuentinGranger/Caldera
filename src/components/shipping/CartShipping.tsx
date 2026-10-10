import Link from 'next/link';
import { Truck } from 'lucide-react';
import {
  DELIVERY_ZONE_LABEL,
  HANDLING_HEADLINE,
  type ShippingOptionView,
} from '@/lib/product/services';
import { freeShipping } from '@/lib/shipping/summary';
import { formatPrice } from '@/utils/formatPrice';
import styles from './CartShipping.module.scss';

const DELIVERY_PATH = '/livraison';

const priceOf = (offer: ShippingOptionView) =>
  Number(offer.price) > 0 ? formatPrice(offer.price) : 'Offerte';

/**
 * Delivery in the cart, before the checkout: the carriers offered with their
 * price and transit time, and how far the items are from a free delivery.
 * `itemsTotal` is the items' total after a code's discount, the amount the
 * checkout measures the free threshold against.
 */
export function CartShipping({
  offers,
  itemsTotal,
}: {
  offers: readonly ShippingOptionView[];
  itemsTotal: string;
}) {
  if (!offers.length) return null;
  const free = freeShipping(offers, itemsTotal);
  return (
    <section className={styles.shipping} aria-labelledby="cart-shipping">
      <h3 id="cart-shipping">
        <Truck size={18} aria-hidden="true" /> Livraison
      </h3>
      {free?.state === 'toGo' && (
        <div className={styles.progress}>
          <p>
            Plus que <strong>{formatPrice(free.remaining)}</strong> {free.label}
          </p>
          <progress
            value={Math.round(free.ratio * 100)}
            max={100}
            aria-label={`${Math.round(free.ratio * 100)} % du seuil de livraison offerte`}
          />
        </div>
      )}
      {free?.state === 'reached' && (
        <p className={styles.reached} role="status">
          {free.label} sur votre sélection.
        </p>
      )}
      <ul className={styles.offers}>
        {offers.map((offer) => (
          <li key={offer.code}>
            <span>
              <strong>{offer.name}</strong>
              <small>
                {[
                  offer.transit && `livraison en ${offer.transit}`,
                  offer.destinations.length > 0 &&
                    offer.destinations.join(', '),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </small>
            </span>
            <b>{priceOf(offer)}</b>
          </li>
        ))}
      </ul>
      <p className={styles.note}>
        {HANDLING_HEADLINE} après confirmation du paiement ·{' '}
        {DELIVERY_ZONE_LABEL}. Le mode et le tarif exacts se choisissent à la
        commande. <Link href={DELIVERY_PATH}>Toutes les modalités</Link>
      </p>
    </section>
  );
}
