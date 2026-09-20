import Image from 'next/image';
import Link from 'next/link';
import { languageLabels } from '@/lib/catalog/params';
import type { CheckoutView } from '@/lib/checkout/types';
import { formatPrice } from '@/utils/formatPrice';
import styles from './Checkout.module.scss';

export function CheckoutSummary({ view }: { view: CheckoutView }) {
  const shippingIsFree = view.shippingAmount === '0.00';

  return (
    <aside
      id="checkout-summary"
      className={styles.summary}
      aria-label="Récapitulatif de votre commande"
    >
      <div className={styles.summaryHeader}>
        <div>
          <span className={styles.summaryEyebrow}>RÉCAPITULATIF</span>
          <h2>Votre commande</h2>
        </div>
        <Link href="/panier">Modifier</Link>
      </div>

      <ul className={styles.summaryItems}>
        {view.cart.items.map((item) => (
          <li key={item.id} className={styles.summaryItem}>
            <div className={styles.summaryMedia}>
              <Image src={item.image} alt="" width={72} height={88} />
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
            {view.total === null && <small>Livraison à ajouter</small>}
          </dt>
          <dd>
            {formatPrice(view.total === null ? view.cart.subtotal : view.total)}
          </dd>
        </div>
      </dl>

      {view.methods.some((method) => method.isDevelopment) && (
        <p className={styles.demo}>
          Les modes marqués « Démo » servent aux essais. Leurs tarifs et délais
          ne constituent pas une offre commerciale.
        </p>
      )}

      <div className={styles.summaryAssurance}>
        <span aria-hidden="true">✓</span>
        <p>
          Prix et disponibilités revérifiés à chaque étape. La sélection seule
          ne réserve pas les articles.
        </p>
      </div>
    </aside>
  );
}
