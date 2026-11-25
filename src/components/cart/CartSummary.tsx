'use client';
import { useState } from 'react';
import { StartCheckoutButton } from '@/components/checkout/StartCheckoutButton';
import { CartShipping } from '@/components/shipping/CartShipping';
import { estimateCartTotal } from '@/lib/shipping/summary';
import { DELIVERY_ZONE_LABEL } from '@/lib/product/services';
import { formatPrice } from '@/utils/formatPrice';
import type { CartView } from '@/lib/cart/types';
import type { CartPromotionState } from '@/lib/checkout/types';
import { useCart } from './CartProvider';
import { CartPromotionField } from './CartPromotionField';
import { CartAssurance } from './CartAssurance';
import styles from './CartSummary.module.scss';

export function CartSummary({
  cart,
  initialPromotionState,
}: {
  cart: CartView;
  initialPromotionState: CartPromotionState | null;
}) {
  const { shipping, pending } = useCart();
  const [promotion, setPromotion] = useState(initialPromotionState);
  const discount = promotion?.promotion?.discount ?? '0.00';
  const [selectedCountry, setSelectedCountry] = useState('FR');
  const countries = new Map(
    shipping.flatMap((offer) =>
      offer.destinations.map(
        ({ code, name }) =>
          [code, code === 'FR' ? DELIVERY_ZONE_LABEL : name] as const,
      ),
    ),
  );
  const country = countries.has(selectedCountry)
    ? selectedCountry
    : countries.keys().next().value;
  const offers = shipping.filter((offer) =>
    offer.destinations.some(({ code }) => code === country),
  );
  const estimate = estimateCartTotal(offers, cart.subtotal, discount);
  return (
    <section
      id="cart-summary"
      className={styles.summary}
      aria-label="Récapitulatif du panier"
    >
      <h2>Récapitulatif</h2>
      {country && (
        <div className={styles.destination}>
          {countries.size > 1 ? (
            <label>
              Pays de livraison
              <select
                value={country}
                onChange={(event) => setSelectedCountry(event.target.value)}
              >
                {Array.from(countries, ([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p>Livraison prévue · {countries.get(country)}</p>
          )}
        </div>
      )}
      <dl className={styles.amounts} aria-live="polite" aria-atomic="true">
        <div className={styles.subtotal}>
          <dt>Sous-total</dt>
          <dd>{formatPrice(cart.subtotal)}</dd>
        </div>
        {Number(discount) > 0 && (
          <div className={styles.discount}>
            <dt>
              Remise <span>({promotion!.promotion!.code})</span>
            </dt>
            <dd>−{formatPrice(discount)}</dd>
          </div>
        )}
        <div>
          <dt>Livraison estimée</dt>
          <dd>
            {estimate.shipping === null
              ? 'À confirmer'
              : Number(estimate.shipping) === 0
                ? offers.length > 1
                  ? 'Offerte selon le mode choisi'
                  : 'Offerte'
                : `${offers.length > 1 ? 'Dès ' : ''}${formatPrice(estimate.shipping)}`}
          </dd>
        </div>
        <div className={styles.total}>
          <dt>
            {estimate.shipping === null
              ? 'Total hors livraison'
              : 'Total estimé'}
          </dt>
          <dd>
            {estimate.shipping !== null && offers.length > 1 ? 'Dès ' : ''}
            {formatPrice(estimate.total)}
          </dd>
        </div>
      </dl>
      <p className={styles.estimateNote}>
        {estimate.shipping === null
          ? 'Frais calculés après saisie de l’adresse.'
          : 'Montant confirmé après saisie de l’adresse et choix du mode de livraison.'}
      </p>
      {cart.hasUnavailableItems && (
        <p className={styles.warning} role="alert">
          Certains articles sont indisponibles ou dépassent la quantité
          disponible. Corrigez votre panier avant de poursuivre.
        </p>
      )}
      <div className={styles.checkoutAction}>
        <StartCheckoutButton
          variant="gold"
          disabled={pending || cart.hasUnavailableItems || !cart.items.length}
        />
      </div>
      <CartAssurance
        preorder={cart.items.some((item) => item.preorder)}
        tone="night"
      />
      <CartPromotionField
        cart={cart}
        initialState={initialPromotionState}
        onStateChange={setPromotion}
      />
      {offers.length > 0 && (
        <details className={styles.deliveryDetails}>
          <summary>Modes et délais de livraison</summary>
          <CartShipping offers={offers} itemsTotal={estimate.itemsTotal} />
        </details>
      )}
      <p className={styles.note}>
        Les articles ne sont pas encore réservés. Prix et disponibilités sont
        revérifiés avant le paiement.
      </p>
    </section>
  );
}
