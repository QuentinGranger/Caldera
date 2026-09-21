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
  providerStatus: string | null;
  trackingEvents: {
    id: string;
    label: string;
    location: string | null;
    occurredAt: Date | null;
  }[];
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
    pickupPoint: {
      pointId: string;
      name: string;
      address1: string;
      address2: string | null;
      postalCode: string;
      city: string;
    } | null;
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
          {shipment.providerStatus && <p>{shipment.providerStatus}</p>}
          {shipment.trackingEvents.length > 0 && (
            <ol className={styles.events}>
              {shipment.trackingEvents.map((event) => (
                <li key={event.id}>
                  <strong>{event.label}</strong>
                  {event.location && <span>{event.location}</span>}
                  {event.occurredAt && (
                    <time dateTime={event.occurredAt.toISOString()}>
                      {formatDate(event.occurredAt)}
                    </time>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
      {order.pickupPoint && (
        <div className={styles.pickup}>
          <h3>Votre point de retrait</h3>
          <strong>{order.pickupPoint.name}</strong>
          <span>{order.pickupPoint.address1}</span>
          {order.pickupPoint.address2 && (
            <span>{order.pickupPoint.address2}</span>
          )}
          <span>
            {order.pickupPoint.postalCode} {order.pickupPoint.city}
          </span>
          <small>Point n° {order.pickupPoint.pointId}</small>
        </div>
      )}
      <p className={styles.note}>
        Ce suivi indique les étapes enregistrées par Caldera. Le transporteur
        fournit les informations de parcours du colis.
      </p>
    </section>
  );
}
