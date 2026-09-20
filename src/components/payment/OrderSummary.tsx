import Image from 'next/image';
import type { OrderRecord } from '@/lib/orders/common';
import { formatPrice } from '@/utils/formatPrice';
import styles from './Payment.module.scss';
export function OrderSummary({ order }: { order: OrderRecord }) {
  const shipping = order.addresses.find((a) => a.role === 'SHIPPING');
  return (
    <section className={styles.panel} aria-label="Récapitulatif de la commande">
      <h2>Votre sélection</h2>
      <ul className={styles.list}>
        {order.items.map((item) => (
          <li key={item.id}>
            <Image
              src={item.imageUrl}
              alt={item.productName}
              width={64}
              height={80}
            />
            <div>
              {item.productName}
              <small>
                {item.language} · Qté {item.quantity} ·{' '}
                {formatPrice(item.unitPrice.toFixed(2))} / unité
              </small>
            </div>
            <span className={styles.linePrice}>
              {formatPrice(item.lineTotal.toFixed(2))}
            </span>
          </li>
        ))}
      </ul>
      <dl className={styles.totals}>
        <div>
          <dt>Sous-total</dt>
          <dd>{formatPrice(order.subtotalAmount.toFixed(2))}</dd>
        </div>
        <div>
          <dt>Livraison</dt>
          <dd>{formatPrice(order.shippingAmount.toFixed(2))}</dd>
        </div>
        <div className={styles.total}>
          <dt>Total</dt>
          <dd>{formatPrice(order.totalAmount.toFixed(2))}</dd>
        </div>
      </dl>
      <p>{order.shippingMethodName}</p>
      {shipping && (
        <address className={styles.address}>
          {shipping.firstName} {shipping.lastName}
          <br />
          {shipping.company && (
            <>
              {shipping.company}
              <br />
            </>
          )}
          {shipping.addressLine1}
          <br />
          {shipping.addressLine2 && (
            <>
              {shipping.addressLine2}
              <br />
            </>
          )}
          {shipping.postalCode} {shipping.city}
          <br />
          {shipping.countryCode}
        </address>
      )}
    </section>
  );
}
