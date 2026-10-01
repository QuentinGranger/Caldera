import { StartCheckoutButton } from '@/components/checkout/StartCheckoutButton';
import { formatPrice } from '@/utils/formatPrice';
import type { CartView } from '@/lib/cart/types';
import type { CartPromotionState } from '@/lib/checkout/types';
import { CartPromotionField } from './CartPromotionField';
import styles from './CartSummary.module.scss';

export function CartSummary({
  cart,
  initialPromotionState,
}: {
  cart: CartView;
  initialPromotionState: CartPromotionState | null;
}) {
  return (
    <section className={styles.summary} aria-label="Récapitulatif du panier">
      <h2>Votre sélection</h2>
      <dl>
        <div>
          <dt>Sous-total</dt>
          <dd>{formatPrice(cart.subtotal)}</dd>
        </div>
      </dl>

      <CartPromotionField cart={cart} initialState={initialPromotionState} />

      <p>Livraison calculée lors de la commande.</p>

      {cart.hasUnavailableItems && (
        <p className={styles.warning}>
          Certains articles sont indisponibles ou dépassent la quantité
          disponible. Corrigez votre sélection avant de poursuivre.
        </p>
      )}

      <StartCheckoutButton
        disabled={cart.hasUnavailableItems || !cart.items.length}
      />

      <p className={styles.note}>
        Les articles du panier ne sont pas réservés à ce stade. Les prix,
        disponibilités et éventuelles réductions seront revérifiés avant le
        paiement, puis la sélection sera réservée pendant la tentative de
        paiement.
      </p>
    </section>
  );
}
