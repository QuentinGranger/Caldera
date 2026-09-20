import Image from 'next/image';
import Link from 'next/link';
import { languageLabels } from '@/lib/catalog/params';
import type { CheckoutView } from '@/lib/checkout/types';
import { formatPrice } from '@/utils/formatPrice';
import styles from './Checkout.module.scss';

export function CheckoutSummary({ view }: { view: CheckoutView }) {
  const shippingIsFree = view.shippingAmount === '0.00';
  const itemLabel = view.cart.itemCount > 1 ? 'articles' : 'article';
  const selectedMethod = view.selectedMethod;

  return (
    <aside
      id="checkout-summary"
      className={styles.summary}
      aria-label="Récapitulatif de votre commande"
    >
      <header className={styles.summaryHeader}>
        <div>
          <span className={styles.summaryEyebrow}>RÉCAPITULATIF</span>
          <h2>Votre commande</h2>
          <p className={styles.summaryCount}>
            {view.cart.itemCount} {itemLabel}
          </p>
        </div>
        <Link href="/panier">Modifier</Link>
      </header>

      <ul className={styles.summaryItems}>
        {view.cart.items.map((item) => (
          <li key={item.id} className={styles.summaryItem}>
            <div className={styles.summaryMedia}>
              <Image
                src={item.image}
                alt={item.imageAlt}
                width={80}
                height={100}
              />
              <span
                className={styles.quantityBadge}
                aria-label={`Quantité : ${item.quantity}`}
              >
                {item.quantity}
              </span>
            </div>

            <div className={styles.summaryProduct}>
              <strong>{item.name}</strong>
              <span className={styles.summaryMeta}>
                {languageLabels[item.language]}
                <span aria-hidden="true"> · </span>
                {formatPrice(item.price)} / unité
              </span>
              {item.preorder && (
                <span className={styles.summaryTag}>Précommande</span>
              )}
            </div>

            <strong className={styles.summaryItemPrice}>
              {formatPrice(item.lineTotal)}
            </strong>
          </li>
        ))}
      </ul>

      {selectedMethod && (
        <div className={styles.summaryShipping}>
          <div>
            <span className={styles.summaryShippingLabel}>EXPÉDITION</span>
            <strong>{selectedMethod.name}</strong>
            {selectedMethod.description && <p>{selectedMethod.description}</p>}
          </div>
          <strong className={shippingIsFree ? styles.freeShipping : undefined}>
            {shippingIsFree ? 'Offerte' : formatPrice(selectedMethod.amount)}
          </strong>
        </div>
      )}

      <div className={styles.summaryBottom}>
        <dl className={styles.summaryTotals}>
          <div>
            <dt>Sous-total</dt>
            <dd>{formatPrice(view.cart.subtotal)}</dd>
          </div>
          <div>
            <dt>Livraison</dt>
            <dd className={shippingIsFree ? styles.freeShipping : undefined}>
              {view.shippingAmount === null
                ? 'À sélectionner'
                : shippingIsFree
                  ? 'Offerte'
                  : formatPrice(view.shippingAmount)}
            </dd>
          </div>
        </dl>

        <div className={styles.summaryGrandTotal}>
          <div>
            <span>
              {view.total === null ? 'TOTAL PROVISOIRE' : 'MONTANT À RÉGLER'}
            </span>
            <small>
              {view.total === null
                ? 'Livraison non incluse'
                : 'Toutes taxes comprises'}
            </small>
          </div>
          <strong>
            {formatPrice(view.total === null ? view.cart.subtotal : view.total)}
          </strong>
        </div>

        <p className={styles.summaryAssurance}>
          Prix et disponibilité revérifiés avant le paiement. Les articles sont
          réservés à la validation de la commande.
        </p>
      </div>

      {view.methods.some((method) => method.isDevelopment) && (
        <p className={styles.demo}>
          Les modes marqués « Démo » servent aux essais. Leurs tarifs et délais
          ne constituent pas une offre commerciale.
        </p>
      )}
    </aside>
  );
}
