import Image from 'next/image';
import type { OrderRecord } from '@/lib/orders/common';
import { formatPrice } from '@/utils/formatPrice';
import styles from './Payment.module.scss';

export function OrderSummary({ order }: { order: OrderRecord }) {
  const shipping = order.addresses.find((a) => a.role === 'SHIPPING');
  const itemCount = order.items.reduce((total, item) => total + item.quantity, 0);
  const itemLabel = itemCount > 1 ? 'articles' : 'article';
  const shippingIsFree = order.shippingAmount.toFixed(2) === '0.00';

  return (
    <section
      className={`${styles.panel} ${styles.orderSummary}`}
      aria-label="Récapitulatif de la commande"
    >
      <header className={styles.orderSummaryHeader}>
        <div>
          <span className={styles.orderSummaryEyebrow}>RÉCAPITULATIF</span>
          <h2>Votre commande</h2>
          <p>
            {itemCount} {itemLabel}
          </p>
        </div>
      </header>

      <ul className={styles.orderSummaryList}>
        {order.items.map((item) => (
          <li key={item.id}>
            <div className={styles.orderSummaryMedia}>
              <Image
                src={item.imageUrl}
                alt={item.productName}
                width={80}
                height={100}
              />
              <span
                className={styles.orderQuantityBadge}
                aria-label={`Quantité : ${item.quantity}`}
              >
                {item.quantity}
              </span>
            </div>

            <div className={styles.orderSummaryProduct}>
              <strong>{item.productName}</strong>
              <small>
                {item.language} · {formatPrice(item.unitPrice.toFixed(2))} / unité
              </small>
            </div>

            <strong className={styles.orderSummaryLinePrice}>
              {formatPrice(item.lineTotal.toFixed(2))}
            </strong>
          </li>
        ))}
      </ul>

      <div className={styles.orderShipping}>
        <div>
          <span>EXPÉDITION</span>
          <strong>{order.shippingMethodName}</strong>
        </div>
        <strong className={shippingIsFree ? styles.orderFreeShipping : undefined}>
          {shippingIsFree
            ? 'Offerte'
            : formatPrice(order.shippingAmount.toFixed(2))}
        </strong>
      </div>

      <div className={styles.orderBottom}>
        <dl className={styles.orderSummaryTotals}>
          <div>
            <dt>Sous-total</dt>
            <dd>{formatPrice(order.subtotalAmount.toFixed(2))}</dd>
          </div>
          <div>
            <dt>Livraison</dt>
            <dd className={shippingIsFree ? styles.orderFreeShipping : undefined}>
              {shippingIsFree
                ? 'Offerte'
                : formatPrice(order.shippingAmount.toFixed(2))}
            </dd>
          </div>
        </dl>

        <div className={styles.orderGrandTotal}>
          <div>
            <span>MONTANT À RÉGLER</span>
            <small>Toutes taxes comprises</small>
          </div>
          <strong>{formatPrice(order.totalAmount.toFixed(2))}</strong>
        </div>

        {shipping && (
          <div className={styles.orderAddressBlock}>
            <span>ADRESSE DE LIVRAISON</span>
            <address>
              <strong>
                {shipping.firstName} {shipping.lastName}
              </strong>
              {shipping.company && <span>{shipping.company}</span>}
              <span>{shipping.addressLine1}</span>
              {shipping.addressLine2 && <span>{shipping.addressLine2}</span>}
              <span>
                {shipping.postalCode} {shipping.city}
              </span>
              <span>{shipping.countryCode}</span>
            </address>
          </div>
        )}
      </div>
    </section>
  );
}
