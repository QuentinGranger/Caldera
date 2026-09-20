import type { FulfillmentStatus } from '@/generated/prisma/client';
import { fulfillmentLabels } from '@/lib/fulfillment/carriers';
import { formatDate } from '@/lib/admin/format';
import styles from './OrderFulfillment.module.scss';
type Tracking = {
  status: string;
  carrierName: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
};
export function OrderFulfillment({
  order,
}: {
  order: {
    status: string;
    fulfillmentStatus: FulfillmentStatus;
    paidAt: Date | null;
    preparationStartedAt: Date | null;
    readyToShipAt: Date | null;
    shippedAt: Date | null;
    deliveredAt: Date | null;
    shipments: Tracking[];
  };
}) {
  if (order.status !== 'PAID') return null;
  const shipment = order.shipments.find((item) =>
    ['SHIPPED', 'DELIVERED'].includes(item.status),
  );
  const timeline = [
    ['Commande confirmée', order.paidAt],
    ['En préparation', order.preparationStartedAt],
    ['Prête à expédier', order.readyToShipAt],
    ['Expédiée', order.shippedAt],
    ['Livrée (confirmation manuelle)', order.deliveredAt],
  ] as const;
  return (
    <section className={styles.panel}>
      <h2>Préparation & expédition</h2>
      <p className={styles.status}>
        {fulfillmentLabels[order.fulfillmentStatus]}
      </p>
      <ol className={styles.timeline}>
        {timeline
          .filter(([, date]) => date)
          .map(([title, date]) => (
            <li key={title}>
              <strong>{title}</strong>
              <time dateTime={date!.toISOString()}>{formatDate(date)}</time>
            </li>
          ))}
      </ol>
      {shipment && (
        <div>
          <p>
            Transporteur : <strong>{shipment.carrierName}</strong>
          </p>
          {shipment.trackingNumber && (
            <p>
              Numéro de suivi : <strong>{shipment.trackingNumber}</strong>
            </p>
          )}
          {shipment.trackingUrl && (
            <a
              href={shipment.trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Suivre mon colis ↗
            </a>
          )}
        </div>
      )}
      <p className={styles.note}>
        Ce suivi indique les étapes enregistrées par Caldera. Le transporteur
        fournit les informations de parcours du colis.
      </p>
    </section>
  );
}
