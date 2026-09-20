import Image from 'next/image';
import Link from 'next/link';
import { languageLabels } from '@/lib/catalog/params';
import type { CheckoutView } from '@/lib/checkout/types';
import { formatPrice } from '@/utils/formatPrice';
import styles from './Checkout.module.scss';

export function CheckoutSummary({ view }: { view: CheckoutView }) {
  const shippingIsFree = view.shippingAmount === '0.00';
  const itemLabel = view.cart.itemCount > 1 ? 'articles' : 'article';

  return (
    <aside
      id="checkout-summary"
      className={styles.summary}
      aria-label="Récapitulatif de votre commande"
    >
      <div className={styles.summaryHeader}>
        <div>
          <span className={styles.summaryEyebrow}>VOTRE COMMANDE</span>
          <h2>Récapitulatif</h2>
          <p className={styles.summaryCount}>
            {view.cart.itemCount} {itemLabel}
          </p>
        </div>
        <Link href="/panier">Modifier le panier</Link>
      </div>

      <ul className={styles.summaryItems}>
        {view.cart.items.map((item) => (
          <li key={item.id} className={styles.summaryItem}>
            <div className={styles.summaryMedia}>
              <Image
                src={item.image}
                alt={item.imageAlt}
                width={76}
                height={96}
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

      <div className={styles.summaryReceipt}>
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

          <div className={styles.summaryTotal}>
            <dt>
              {view.total === null ? 'Total provisoire' : 'Total'}
              {view.total === null && <small>hors livraison</small>}
            </dt>
            <dd>
              {formatPrice(view.total === null ? view.cart.subtotal : view.total)}
            </dd>
          </div>
        </dl>

        <div className={styles.summaryAssurance}>
          <span aria-hidden="true">✓</span>
          <p>
            Prix et disponibilité vérifiés avant le paiement. Les articles ne
            sont réservés qu’à la validation de la commande.
          </p>
        </div>
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
