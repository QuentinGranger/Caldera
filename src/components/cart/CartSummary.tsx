import { StartCheckoutButton } from '@/components/checkout/StartCheckoutButton';
import { formatPrice } from '@/utils/formatPrice';
import type { CartView } from '@/lib/cart/types';
import styles from './CartSummary.module.scss';
export function CartSummary({ cart }: { cart: CartView }) {
  return (
    <section className={styles.summary} aria-label="Récapitulatif du panier">
      <h2>Votre sélection</h2>
      <dl>
        <div>
          <dt>Sous-total</dt>
          <dd>{formatPrice(cart.subtotal)}</dd>
        </div>
      </dl>
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
      <p>Le paiement n’est pas encore disponible.</p>
      <p className={styles.note}>
        Les articles du panier ne sont pas réservés. Les prix et disponibilités
        seront vérifiés avant la commande.
      </p>
    </section>
  );
}
