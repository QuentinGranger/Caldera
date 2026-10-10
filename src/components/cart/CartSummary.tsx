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
  const estimate = estimateCartTotal(shipping, cart.subtotal, discount);
  return (
    <section
      id="cart-summary"
      className={styles.summary}
      aria-label="Récapitulatif du panier"
    >
      <h2>Récapitulatif</h2>
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
                ? 'Offerte selon le mode choisi'
                : `Dès ${formatPrice(estimate.shipping)}`}
          </dd>
        </div>
        <div className={styles.total}>
          <dt>
            {estimate.shipping === null
              ? 'Total hors livraison'
              : 'Total estimé'}
          </dt>
          <dd>
            {estimate.shipping !== null && shipping.length > 1 ? 'Dès ' : ''}
            {formatPrice(estimate.total)}
          </dd>
        </div>
      </dl>
      <p className={styles.estimateNote}>
        {estimate.shipping === null
          ? 'Frais de livraison confirmés à l’étape suivante.'
          : `${DELIVERY_ZONE_LABEL}. Montant confirmé selon votre adresse et le mode de livraison choisi.`}
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
      {shipping.length > 0 && (
        <details className={styles.deliveryDetails}>
          <summary>Modes et délais de livraison</summary>
          <CartShipping offers={shipping} itemsTotal={estimate.itemsTotal} />
        </details>
      )}
      <p className={styles.note}>
        Les articles ne sont pas encore réservés. Prix et disponibilités sont
        revérifiés avant le paiement.
      </p>
    </section>
  );
}
