// Returns and withdrawals: deadlines, allowed transitions and returnable
// quantities. Pure module: shared by the service, the pages and the tests.
import { parisDate } from '@/lib/admin/dates';

export type ReturnStatusCode =
  'REQUESTED' | 'APPROVED' | 'RECEIVED' | 'REFUNDED' | 'REJECTED' | 'CANCELED';

export type ReturnReasonCode =
  'WITHDRAWAL' | 'DAMAGED' | 'DEFECTIVE' | 'WRONG_ITEM' | 'OTHER';

export const returnReasonLabels: Record<ReturnReasonCode, string> = {
  WITHDRAWAL: 'Rétractation (14 jours)',
  DAMAGED: 'Article abîmé à la réception',
  DEFECTIVE: 'Article défectueux ou non conforme',
  WRONG_ITEM: 'Article différent de la commande',
  OTHER: 'Autre motif',
};

/** CGV art. 12.1: 14 days from receipt of the goods. */
export const WITHDRAWAL_DAYS = 14;
/** CGV art. 14: refund at the latest 14 days after the withdrawal. */
export const REFUND_DAYS = 14;
/** Legal guarantee of conformity: two years from delivery. */
export const GUARANTEE_DAYS = 730;

/** Being handled: counted against what is left to return. */
export const OPEN_RETURN_STATUSES: readonly ReturnStatusCode[] = [
  'REQUESTED',
  'APPROVED',
  'RECEIVED',
];

const transitions: Record<ReturnStatusCode, readonly ReturnStatusCode[]> = {
  REQUESTED: ['APPROVED', 'REJECTED', 'RECEIVED', 'CANCELED'],
  APPROVED: ['RECEIVED', 'CANCELED'],
  RECEIVED: ['CANCELED'],
  REFUNDED: [],
  REJECTED: [],
  CANCELED: [],
};

export function canMoveReturn(from: ReturnStatusCode, to: ReturnStatusCode) {
  return transitions[from].includes(to);
}

const parisDay = (value: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(value);

/** End of the `days`-th day after `from`, in Paris (the legal way to count). */
export function endOfDayAfter(from: Date, days: number) {
  const start = parisDate(parisDay(from))!;
  const day = new Date(start.getTime() + days * 86400000 + 12 * 3600000);
  return parisDate(parisDay(day), true)!;
}

/**
 * Last moment to withdraw: 14 days after delivery. While the parcel is not
 * marked delivered the right stays open (it can be used before receipt).
 */
export function withdrawalDeadline(deliveredAt: Date | null) {
  return deliveredAt ? endOfDayAfter(deliveredAt, WITHDRAWAL_DAYS) : null;
}

export function canWithdraw(deliveredAt: Date | null, now = new Date()) {
  const deadline = withdrawalDeadline(deliveredAt);
  return !deadline || now < deadline;
}

/** Other returns (damage, defect, error): within the legal guarantee. */
export function canReportProblem(
  order: { paidAt: Date | null; deliveredAt: Date | null },
  now = new Date(),
) {
  const from = order.deliveredAt ?? order.paidAt;
  return Boolean(from) && now < endOfDayAfter(from!, GUARANTEE_DAYS);
}

/**
 * Units of each line that can still be returned: ordered, minus units in a
 * return being handled, minus units already refunded outside such a return.
 */
export function returnableQuantities(
  items: readonly { id: string; quantity: number }[],
  openReturns: readonly {
    items: { orderItemId: string; quantity: number }[];
  }[],
  refundedOutsideOpenReturns: ReadonlyMap<string, number>,
) {
  const taken = new Map<string, number>(refundedOutsideOpenReturns);
  for (const request of openReturns)
    for (const item of request.items)
      taken.set(
        item.orderItemId,
        (taken.get(item.orderItemId) ?? 0) + item.quantity,
      );
  return new Map(
    items.map((item) => [
      item.id,
      Math.max(0, item.quantity - (taken.get(item.id) ?? 0)),
    ]),
  );
}

/** The Stripe-side refund reason recorded for a return. */
export function refundReasonForReturn(reason: ReturnReasonCode) {
  if (reason === 'DAMAGED' || reason === 'DEFECTIVE') return 'DAMAGED' as const;
  if (reason === 'WRONG_ITEM') return 'OTHER' as const;
  return 'RETURN_RECEIVED' as const;
}

/** How a return reads for the customer. */
export const returnStatusCustomerLabels: Record<ReturnStatusCode, string> = {
  REQUESTED: 'Demande reçue',
  APPROVED: 'Acceptée — en attente de votre colis',
  RECEIVED: 'Colis reçu',
  REFUNDED: 'Remboursé',
  REJECTED: 'Refusée',
  CANCELED: 'Annulée',
};
