import Image from 'next/image';
import Link from 'next/link';
import { languageLabels } from '@/lib/catalog/params';
import type { CheckoutView } from '@/lib/checkout/types';
import { formatPrice } from '@/utils/formatPrice';
import styles from './Checkout.module.scss';
export function CheckoutSummary({ view }: { view: CheckoutView }) {
  return (
    <aside
      id="checkout-summary"
      className={styles.summary}
      aria-label="Récapitulatif de votre sélection"
    >
      <h2>Votre sélection</h2>
      <Link href="/panier">Modifier le panier</Link>
      <ul>
        {view.cart.items.map((item) => (
          <li key={item.id}>
            <Image src={item.image} alt="" width={56} height={68} />
            <div>
              <strong>{item.name}</strong>
              <span>
                {languageLabels[item.language]} · Quantité : {item.quantity}
                {item.preorder ? ' · Précommande' : ''}
              </span>
            </div>
            <span>{formatPrice(item.lineTotal)}</span>
          </li>
        ))}
      </ul>
      <dl>
        <div>
          <dt>Sous-total</dt>
          <dd>{formatPrice(view.cart.subtotal)}</dd>
        </div>
        <div>
          <dt>Livraison</dt>
          <dd>
            {view.shippingAmount === null
              ? 'À sélectionner'
              : view.shippingAmount === '0.00'
                ? 'Offerte'
                : formatPrice(view.shippingAmount)}
          </dd>
        </div>
        <div className={styles.total}>
          <dt>Total provisoire</dt>
          <dd>
            {view.total === null
              ? `${formatPrice(view.cart.subtotal)} + livraison`
              : formatPrice(view.total)}
          </dd>
        </div>
      </dl>
      {view.methods.some((method) => method.isDevelopment) && (
        <p className={styles.demo}>
          Les modes marqués « Démo » servent aux essais. Leurs tarifs et délais
          ne constituent pas une offre commerciale.
        </p>
      )}
      <p>
        Prix et disponibilités sont revérifiés à chaque étape. Votre sélection
        ne réserve pas les articles.
      </p>
    </aside>
  );
}
