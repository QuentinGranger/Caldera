// Promotional discounts in integer cents. Pure module: shared by the checkout,
// the order creation, the administration and the unit tests.

export type PromotionKind = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING';

export type PromotionRule = {
  id: string;
  code: string;
  label: string;
  type: PromotionKind;
  percentOff: number | null;
  amountOffCents: number | null;
  minimumSubtotalCents: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
  maxRedemptions: number | null;
  maxPerCustomer: number | null;
  gameId: string | null;
  /** The chosen category and all its sub-categories; null: every category. */
  categoryIds: ReadonlySet<string> | null;
};

export type PromotionLine = {
  id: string;
  unitCents: number;
  quantity: number;
  gameId: string | null;
  categoryId: string;
};

/** Uses already counted (RESERVED or CONSUMED): overall and for this e-mail. */
export type PromotionUsage = { total: number; customer: number };

export type PromotionResult =
  | {
      ok: true;
      /** Discount per eligible line; the lines not listed get nothing. */
      items: { id: string; cents: number }[];
      itemsCents: number;
      shippingCents: number;
    }
  | { ok: false; reason: string };

/** Stripe refuses a payment under 0.50 €. */
export const MINIMUM_PAYABLE_CENTS = 50;
export const MAX_PERCENT_OFF = 90;

const CODE = /^[A-Z0-9][A-Z0-9-]{1,30}[A-Z0-9]$/;

/** What the customer typed, as stored: upper case, no spaces; null if impossible. */
export function normalizePromotionCode(input: unknown) {
  if (typeof input !== 'string') return null;
  const code = input.normalize('NFKC').replace(/\s+/g, '').toUpperCase();
  return CODE.test(code) ? code : null;
}

const euros = (cents: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
    .format(cents / 100)
    .replace(/ /g, ' ');

const day = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'Europe/Paris',
});

/**
 * Splits `total` in proportion to `weights`; the cents left by rounding go to
 * the largest remainders, so the parts always add up exactly.
 */
export function splitCents(total: number, weights: readonly number[]) {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!sum) return weights.map(() => 0);
  const shares = weights.map((weight, index) => {
    const exact = (weight * total) / sum;
    return { index, cents: Math.floor(exact), rest: exact - Math.floor(exact) };
  });
  let left = total - shares.reduce((a, share) => a + share.cents, 0);
  for (const share of [...shares].sort(
    (a, b) => b.rest - a.rest || a.index - b.index,
  )) {
    if (!left) break;
    share.cents++;
    left--;
  }
  return shares.map((share) => share.cents);
}

function eligible(rule: PromotionRule, line: PromotionLine) {
  return (
    (!rule.gameId || line.gameId === rule.gameId) &&
    (!rule.categoryIds || rule.categoryIds.has(line.categoryId))
  );
}

/**
 * Whether the code applies now and how much it takes off. `shippingCents` is
 * null while no delivery is chosen: the minimum payable is checked once it is.
 */
export function evaluatePromotion(
  rule: PromotionRule,
  {
    lines,
    shippingCents,
    usage,
    now = new Date(),
  }: {
    lines: readonly PromotionLine[];
    shippingCents: number | null;
    usage: PromotionUsage;
    now?: Date;
  },
): PromotionResult {
  if (!rule.isActive)
    return { ok: false, reason: 'Ce code n’est pas valable.' };
  if (rule.startsAt && rule.startsAt > now)
    return {
      ok: false,
      reason: `Ce code sera valable à partir du ${day.format(rule.startsAt)}.`,
    };
  if (rule.endsAt && rule.endsAt <= now)
    return { ok: false, reason: 'Ce code a expiré.' };
  if (rule.maxRedemptions !== null && usage.total >= rule.maxRedemptions)
    return { ok: false, reason: 'Ce code a atteint sa limite d’utilisation.' };
  if (rule.maxPerCustomer !== null && usage.customer >= rule.maxPerCustomer)
    return { ok: false, reason: 'Vous avez déjà utilisé ce code.' };
  const targets = lines.filter((line) => eligible(rule, line));
  if (!targets.length)
    return {
      ok: false,
      reason: 'Ce code ne s’applique à aucun article de votre panier.',
    };
  const weights = targets.map((line) => line.unitCents * line.quantity);
  const base = weights.reduce((a, b) => a + b, 0);
  if (rule.minimumSubtotalCents !== null && base < rule.minimumSubtotalCents)
    return {
      ok: false,
      reason: `Ce code est valable dès ${euros(rule.minimumSubtotalCents)} d’articles${
        rule.gameId || rule.categoryIds ? ' concernés' : ''
      }.`,
    };
  let itemsCents = 0;
  if (rule.type === 'PERCENTAGE')
    itemsCents = Math.round((base * (rule.percentOff ?? 0)) / 100);
  else if (rule.type === 'FIXED_AMOUNT')
    itemsCents = Math.min(rule.amountOffCents ?? 0, base);
  const shipping =
    rule.type === 'FREE_SHIPPING' ? Math.max(0, shippingCents ?? 0) : 0;
  const itemsTotal = lines.reduce(
    (sum, line) => sum + line.unitCents * line.quantity,
    0,
  );
  if (
    shippingCents !== null &&
    itemsTotal - itemsCents + shippingCents - shipping < MINIMUM_PAYABLE_CENTS
  )
    return {
      ok: false,
      reason: `Le montant restant à payer doit atteindre au moins ${euros(MINIMUM_PAYABLE_CENTS)}.`,
    };
  const parts = splitCents(itemsCents, weights);
  return {
    ok: true,
    items: targets.map((line, index) => ({
      id: line.id,
      cents: parts[index]!,
    })),
    itemsCents,
    shippingCents: shipping,
  };
}

/** Short description for lists: « −10 % », « −5,00 € », « Livraison offerte ». */
export function describePromotion(rule: {
  type: PromotionKind;
  percentOff: number | null;
  amountOffCents: number | null;
}) {
  if (rule.type === 'PERCENTAGE') return `−${rule.percentOff} %`;
  if (rule.type === 'FIXED_AMOUNT')
    return `−${euros(rule.amountOffCents ?? 0)}`;
  return 'Livraison offerte';
}
