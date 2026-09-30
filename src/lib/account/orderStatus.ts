// How an order reads in the customer area. Pure module: shared by the pages
// and the unit tests.
import { fulfillmentLabels } from '@/lib/fulfillment/carriers';

/** Badge colour: waiting on the payment, on its way, arrived, stopped. */
export type OrderTone =
  'payment' | 'progress' | 'shipped' | 'delivered' | 'cancelled';

/** Paid, prepared, shipped, delivered. */
export const ORDER_STEPS = [
  'Payée',
  'En préparation',
  'Expédiée',
  'Livrée',
] as const;

type OrderStatus = {
  label: string;
  tone: OrderTone;
  /** Index in ORDER_STEPS, or null when the order is not following them. */
  step: number | null;
};

/**
 * `refund`: 'full' when nothing is left to refund (the order stops there),
 * 'partial' when some of it was refunded and the rest still follows its course.
 */
export function orderStatus(order: {
  status: string;
  fulfillmentStatus: string;
  refund?: 'full' | 'partial' | null;
}): OrderStatus {
  if (order.refund === 'full')
    return { label: 'Remboursée', tone: 'cancelled', step: null };
  const status = paymentOrFulfillment(order);
  return order.refund === 'partial'
    ? { ...status, label: `${status.label} · remboursement partiel` }
    : status;
}

function paymentOrFulfillment(order: {
  status: string;
  fulfillmentStatus: string;
}): OrderStatus {
  if (order.status === 'PAYMENT_PROCESSING')
    return { label: 'Paiement en cours', tone: 'payment', step: null };
  if (order.status === 'PAYMENT_REVIEW')
    return { label: 'Paiement en vérification', tone: 'payment', step: null };
  if (order.status === 'CANCELLED')
    return { label: 'Annulée', tone: 'cancelled', step: null };
  const label = fulfillmentLabels[order.fulfillmentStatus] ?? 'Commande reçue';
  switch (order.fulfillmentStatus) {
    case 'PREPARING':
    case 'READY_TO_SHIP':
      return { label, tone: 'progress', step: 1 };
    case 'SHIPPED':
      return { label, tone: 'shipped', step: 2 };
    case 'DELIVERED':
      return { label, tone: 'delivered', step: 3 };
    default:
      return { label, tone: 'progress', step: 0 };
  }
}

/** Still to come: paid or being paid, not yet delivered nor cancelled. */
export function isOpenOrder(tone: OrderTone) {
  return tone === 'payment' || tone === 'progress' || tone === 'shipped';
}
