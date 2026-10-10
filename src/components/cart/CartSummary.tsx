'use client';
import { useState } from 'react';
import { StartCheckoutButton } from '@/components/checkout/StartCheckoutButton';
import { CartShipping } from '@/components/shipping/CartShipping';
import { freeShipping, shippingFromLabel } from '@/lib/shipping/summary';
import { formatPrice } from '@/utils/formatPrice';
import type { CartView } from '@/lib/cart/types';
import type { CartPromotionState } from '@/lib/checkout/types';
import { useCart } from './CartProvider';
import { CartPromotionField } from './CartPromotionField';
import styles from './CartSummary.module.scss';

export function CartSummary({
  cart,
  initialPromotionState,
}: {
  cart: CartView;
  initialPromotionState: CartPromotionState | null;
}) {
  const { shipping } = useCart();
  const [promotion, setPromotion] = useState(initialPromotionState);
  // The checkout measures the free threshold against the items once the
  // code's discount is taken off.
  const itemsDiscount = Number(promotion?.promotion?.discount ?? 0);
  const itemsTotal = Math.max(0, Number(cart.subtotal) - itemsDiscount).toFixed(
    2,
  );
  const free = freeShipping(shipping, itemsTotal);
  const from = shippingFromLabel(shipping);
  return (
    <section className={styles.summary} aria-label="Récapitulatif du panier">
      <h2>Votre sélection</h2>
      <dl>
        <div>
          <dt>Sous-total</dt>
          <dd>{formatPrice(cart.subtotal)}</dd>
        </div>
        {/* Several methods and one of them free: the block below names it. */}
        {from && !(free?.state === 'reached' && shipping.length > 1) && (
          <div>
            <dt>Livraison</dt>
            <dd>
              {free?.state === 'reached'
                ? 'offerte'
                : from.replace('Livraison ', '')}
            </dd>
          </div>
        )}
      </dl>

      <CartPromotionField
        cart={cart}
        initialState={initialPromotionState}
        onStateChange={setPromotion}
      />

      {shipping.length > 0 ? (
        <CartShipping offers={shipping} itemsTotal={itemsTotal} />
      ) : (
        <p>Livraison calculée lors de la commande.</p>
      )}

      {cart.hasUnavailableItems && (
        <p className={styles.warning}>
          Certains articles sont indisponibles ou dépassent la quantité
          disponible. Corrigez votre sélection avant de poursuivre.
        </p>
      )}

      <div className={styles.checkoutAction}>
        <StartCheckoutButton
          disabled={cart.hasUnavailableItems || !cart.items.length}
        />
      </div>

      <p className={styles.note}>
        Les articles du panier ne sont pas réservés à ce stade. Les prix,
        disponibilités et éventuelles réductions seront revérifiés avant le
        paiement, puis la sélection sera réservée pendant la tentative de
        paiement.
      </p>
    </section>
  );
}
