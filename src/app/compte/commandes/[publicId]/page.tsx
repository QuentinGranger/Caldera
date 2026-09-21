import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireCustomer } from '@/lib/auth/customer/session';
import { getCustomerOrder } from '@/lib/customer/data';
import { formatPrice } from '@/utils/formatPrice';
import styles from '@/components/account/Account.module.scss';
export const metadata: Metadata = {
  title: 'Détail de commande | Les Terres de Caldera',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};
const labels: Record<string, string> = {
  PENDING_PAYMENT: 'Paiement en attente',
  PAYMENT_PROCESSING: 'Paiement en cours',
  PAID: 'Payée',
  PAYMENT_FAILED: 'Paiement échoué',
  PAYMENT_REVIEW: 'En vérification',
  CANCELLED: 'Annulée',
  EXPIRED: 'Expirée',
};
export default async function CustomerOrderPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const customer = await requireCustomer();
  const { publicId } = await params;
  const order = await getCustomerOrder(customer.id, publicId);
  if (!order) notFound();
  const shipping = order.addresses.find(
    (address) => address.role === 'SHIPPING',
  );
  const shipment = order.shipments[0];
  return (
    <>
      <header className={styles.heading}>
        <p className={styles.eyebrow}>{order.orderNumber}</p>
        <h1>Votre commande</h1>
        <p>
          Passée le {order.createdAt.toLocaleDateString('fr-FR')} ·{' '}
          <strong>{labels[order.status] ?? order.status}</strong>
        </p>
      </header>
      <div className={styles.detailGrid}>
        <section className={styles.card}>
          <h2>Articles</h2>
          {order.items.map((item) => (
            <div className={styles.line} key={item.id}>
              <span>
                <strong>
                  {item.quantity} × {item.productName}
                </strong>
                <br />
                <small>
                  {item.sku} · {item.language}
                </small>
              </span>
              <span>{formatPrice(item.lineTotal.toFixed(2))}</span>
            </div>
          ))}
          <div className={styles.actions}>
            <Link className={styles.textLink} href="/compte/commandes">
              Retour à mes commandes
            </Link>
          </div>
        </section>
        <aside className={styles.card}>
          <h2>Résumé</h2>
          <div className={styles.line}>
            <span>Sous-total</span>
            <span>{formatPrice(order.subtotalAmount.toFixed(2))}</span>
          </div>
          <div className={styles.line}>
            <span>Livraison</span>
            <span>{formatPrice(order.shippingAmount.toFixed(2))}</span>
          </div>
          <div className={styles.line}>
            <strong>Total</strong>
            <strong>{formatPrice(order.totalAmount.toFixed(2))}</strong>
          </div>
          {shipping && (
            <>
              <h3>Livraison</h3>
              <p>
                {shipping.firstName} {shipping.lastName}
                <br />
                {shipping.addressLine1}
                <br />
                {shipping.postalCode} {shipping.city}
                <br />
                {shipping.countryCode}
              </p>
            </>
          )}
          {order.pickupPoint && (
            <>
              <h3>Point de retrait</h3>
              <p>
                <strong>{order.pickupPoint.name}</strong>
                <br />
                {order.pickupPoint.address1}
                <br />
                {order.pickupPoint.postalCode} {order.pickupPoint.city}
                <br />
                <small>Point n° {order.pickupPoint.pointId}</small>
              </p>
            </>
          )}
          {shipment?.trackingNumber && (
            <p>
              <strong>Suivi :</strong> {shipment.carrierName}
              <br />
              {shipment.trackingNumber}
              {shipment.trackingUrl && (
                <>
                  <br />
                  <a className={styles.textLink} href={shipment.trackingUrl}>
                    Suivre le colis
                  </a>
                </>
              )}
            </p>
          )}
          {shipment?.trackingEvents.length ? (
            <ol>
              {shipment.trackingEvents.map((event) => (
                <li key={event.id}>
                  <strong>{event.label}</strong>
                  {event.location ? ` · ${event.location}` : ''}
                  {event.occurredAt
                    ? ` · ${event.occurredAt.toLocaleString('fr-FR')}`
                    : ''}
                </li>
              ))}
            </ol>
          ) : null}
        </aside>
      </div>
    </>
  );
}
