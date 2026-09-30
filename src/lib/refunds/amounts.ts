// Refund arithmetic in integer cents: no floating point anywhere. Pure module,
// shared by the service, the admin form and the unit tests.

export function toCents(value: string | { toFixed(digits: number): string }) {
  const text = typeof value === 'string' ? value : value.toFixed(2);
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(text))
    throw new RangeError('Montant invalide.');
  const [units, decimals = ''] = text.split('.');
  return Number(units) * 100 + Number(decimals.padEnd(2, '0'));
}

export function fromCents(cents: number) {
  return (cents / 100).toFixed(2);
}

/** Refunds that count against the payment: done, or on their way. */
export const COMMITTED_STATUSES = [
  'PENDING',
  'REQUIRES_ACTION',
  'SUCCEEDED',
] as const;

type RefundRow = {
  amount: string | { toFixed(digits: number): string };
  shippingAmount: string | { toFixed(digits: number): string };
  status: string;
  items: { orderItemId: string; quantity: number }[];
};

/**
 * What is left to refund on a paid order: amount, shipping, and quantity per
 * line, counting pending refunds so two refunds can never overlap.
 */
export function refundState(
  paid: { amount: string; shipping: string },
  refunds: readonly RefundRow[],
) {
  const committed = refunds.filter((refund) =>
    (COMMITTED_STATUSES as readonly string[]).includes(refund.status),
  );
  const paidCents = toCents(paid.amount);
  const refunded = committed
    .filter((refund) => refund.status === 'SUCCEEDED')
    .reduce((sum, refund) => sum + toCents(refund.amount), 0);
  const pending = committed
    .filter((refund) => refund.status !== 'SUCCEEDED')
    .reduce((sum, refund) => sum + toCents(refund.amount), 0);
  const shippingCommitted = committed.reduce(
    (sum, refund) => sum + toCents(refund.shippingAmount),
    0,
  );
  const quantities = new Map<string, number>();
  for (const refund of committed)
    for (const item of refund.items)
      quantities.set(
        item.orderItemId,
        (quantities.get(item.orderItemId) ?? 0) + item.quantity,
      );
  const remaining = Math.max(0, paidCents - refunded - pending);
  return {
    paidCents,
    refundedCents: refunded,
    pendingCents: pending,
    remainingCents: remaining,
    shippingRemainingCents: Math.max(
      0,
      Math.min(toCents(paid.shipping) - shippingCommitted, remaining),
    ),
    refundedQuantities: quantities,
    /** Nothing left: the order must not be shipped any more. */
    full: remaining === 0 && refunded + pending > 0,
    partial: refunded + pending > 0 && remaining > 0,
  };
}

export type RefundLine = {
  orderItemId: string;
  unitCents: number;
  quantity: number;
};

/**
 * Splits `amountCents` over the selected lines and shipping. When less than
 * their total is refunded (a partial goodwill), each part is reduced in
 * proportion and the cents left by rounding go to the largest remainders, so
 * the parts always add up exactly.
 */
export function allocateRefund({
  lines,
  shippingCents,
  amountCents,
}: {
  lines: readonly RefundLine[];
  shippingCents: number;
  amountCents: number;
}) {
  const parts = [
    ...lines.map((line) => ({
      key: line.orderItemId,
      nominal: line.unitCents * line.quantity,
    })),
    ...(shippingCents > 0 ? [{ key: 'shipping', nominal: shippingCents }] : []),
  ];
  const nominal = parts.reduce((sum, part) => sum + part.nominal, 0);
  if (!nominal) return { items: [], shippingCents: 0, nominalCents: 0 };
  if (amountCents > nominal)
    throw new RangeError('Le montant dépasse les articles sélectionnés.');
  const shares = parts.map((part) => {
    const exact = (part.nominal * amountCents) / nominal;
    return {
      ...part,
      cents: Math.floor(exact),
      rest: exact - Math.floor(exact),
    };
  });
  let left = amountCents - shares.reduce((sum, share) => sum + share.cents, 0);
  for (const share of [...shares].sort((a, b) => b.rest - a.rest)) {
    if (!left) break;
    share.cents++;
    left--;
  }
  return {
    items: lines.map((line) => ({
      orderItemId: line.orderItemId,
      quantity: line.quantity,
      cents: shares.find((share) => share.key === line.orderItemId)!.cents,
    })),
    shippingCents: shares.find((share) => share.key === 'shipping')?.cents ?? 0,
    nominalCents: nominal,
  };
}

export const refundReasonLabels = {
  CUSTOMER_REQUEST: 'Demande du client',
  RETURN_RECEIVED: 'Retour reçu',
  DAMAGED: 'Article endommagé',
  MISSING_ITEM: 'Article manquant',
  OUT_OF_STOCK: 'Rupture après commande',
  DUPLICATE: 'Paiement en double',
  FRAUD: 'Fraude',
  OTHER: 'Autre',
} as const;

export type RefundReasonCode = keyof typeof refundReasonLabels;

/** Stripe only knows three reasons; the precise one stays in PostgreSQL. */
export function stripeReason(reason: RefundReasonCode) {
  if (reason === 'DUPLICATE') return 'duplicate' as const;
  if (reason === 'FRAUD') return 'fraudulent' as const;
  return 'requested_by_customer' as const;
}

const failureLabels: Record<string, string> = {
  PERMISSION_STRIPE_MANQUANTE: 'Permission Stripe manquante',
  STRIPE_NON_CONFIGURE: 'Stripe non configuré',
  STRIPE_INJOIGNABLE: 'Stripe injoignable',
  AUTHENTIFICATION_STRIPE: 'Clé Stripe refusée',
  VERIFICATION_STRIPE_REQUISE: 'À vérifier dans Stripe',
  REFUS_STRIPE: 'Refusé par Stripe',
  charge_already_refunded: 'Déjà remboursé côté Stripe',
  balance_insufficient: 'Solde Stripe insuffisant',
  insufficient_funds: 'Solde Stripe insuffisant',
  amount_too_large: 'Montant refusé par Stripe',
  charge_disputed: 'Paiement en litige',
  expired_or_canceled_card: 'Carte expirée ou annulée',
  lost_or_stolen_card: 'Carte perdue ou volée',
  declined: 'Refusé par la banque',
};

/** Why a refund failed or waits, in a few words for the order page. */
export function refundFailureLabel(code: string) {
  return failureLabels[code] ?? `Refusé par Stripe (${code})`;
}
