import Link from 'next/link';
import { Truck } from 'lucide-react';
import {
  DELIVERY_ZONE_LABEL,
  type ShippingOptionView,
} from '@/lib/product/services';
import { cartShippingPrice } from '@/lib/shipping/summary';
import { formatPrice } from '@/utils/formatPrice';
import styles from './CartShipping.module.scss';

const DELIVERY_PATH = '/livraison';

/**
 * Delivery in the cart, before the checkout: the carriers offered with their
 * effective price and transit time.
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
  return (
    <section className={styles.shipping} aria-labelledby="cart-shipping">
      <h3 id="cart-shipping">
        <Truck size={18} aria-hidden="true" /> Livraison
      </h3>
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
            <b>
              {Number(cartShippingPrice(offer, itemsTotal)) === 0
                ? 'Offerte'
                : formatPrice(cartShippingPrice(offer, itemsTotal))}
            </b>
          </li>
        ))}
      </ul>
      <p className={styles.note}>
        {DELIVERY_ZONE_LABEL}. Les délais de livraison courent après
        l’expédition. Le mode et le tarif exacts se choisissent à la commande.{' '}
        <Link href={DELIVERY_PATH}>Toutes les modalités</Link>
      </p>
    </section>
  );
}
