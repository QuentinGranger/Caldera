// What the cart and the product page say of delivery, before the checkout:
// the lowest price asked and how far the items are from a free delivery. Every
// figure comes from the shipping methods (ShippingMethod, edited in the
// admin); nothing here sets a price or a threshold of its own.
import type { ShippingOptionView } from '@/lib/product/services';
import { formatPrice } from '@/utils/formatPrice';

type Offer = Pick<ShippingOptionView, 'name' | 'price' | 'freeFromAmount'>;

const toCents = (amount: string) => Math.round(Number(amount) * 100);
const fromCents = (cents: number) => (cents / 100).toFixed(2);

/** The lowest price among the methods, before any free threshold. */
export function lowestShippingPrice(offers: readonly Offer[]): string | null {
  if (!offers.length) return null;
  return fromCents(Math.min(...offers.map((offer) => toCents(offer.price))));
}

/** The method that becomes free first, with its threshold. Free ones are left out. */
function nearestThreshold(offers: readonly Offer[]) {
  const withThreshold = offers.filter(
    (offer) => offer.freeFromAmount !== null && toCents(offer.price) > 0,
  );
  if (!withThreshold.length) return null;
  return withThreshold.reduce((best, offer) =>
    toCents(offer.freeFromAmount!) < toCents(best.freeFromAmount!)
      ? offer
      : best,
  );
}

/** « Livraison dès 5,90 € », or « Livraison offerte » when a method costs nothing. */
export function shippingFromLabel(offers: readonly Offer[]): string | null {
  const lowest = lowestShippingPrice(offers);
  if (lowest === null) return null;
  return toCents(lowest) === 0
    ? 'Livraison offerte'
    : `Livraison dès ${formatPrice(lowest)}`;
}

/** « offerte dès 150,00 € d’achat », with the method when there are several. */
export function freeThresholdLabel(offers: readonly Offer[]): string | null {
  const offer = nearestThreshold(offers);
  if (!offer) return null;
  return `offerte dès ${formatPrice(offer.freeFromAmount!)} d’achat${
    offers.length > 1 ? ` avec ${offer.name}` : ''
  }`;
}

export type FreeShipping =
  | { state: 'reached'; label: string }
  | {
      state: 'toGo';
      label: string;
      /** « 42.10 »: what is missing, in euros. */
      remaining: string;
      /** From 0 to 1: how close the items are to the threshold. */
      ratio: number;
    };

/**
 * Where the items stand against the free delivery of the checkout: the same
 * rule (items total, after an items discount, against `freeFromAmount`).
 * Null when no method has a threshold.
 */
export function freeShipping(
  offers: readonly Offer[],
  itemsTotal: string,
): FreeShipping | null {
  const total = toCents(itemsTotal);
  const thresholds = offers.filter(
    (offer) => offer.freeFromAmount !== null && toCents(offer.price) > 0,
  );
  if (!thresholds.length) return null;
  const named = (offer: Offer) =>
    offers.length > 1 ? ` avec ${offer.name}` : '';
  const reached = thresholds
    .filter((offer) => total >= toCents(offer.freeFromAmount!))
    .sort((a, b) => toCents(a.freeFromAmount!) - toCents(b.freeFromAmount!))[0];
  if (reached)
    return {
      state: 'reached',
      label: `Livraison offerte${named(reached)}`,
    };
  const next = nearestThreshold(thresholds)!;
  const threshold = toCents(next.freeFromAmount!);
  return {
    state: 'toGo',
    label: `pour la livraison offerte${named(next)}`,
    remaining: fromCents(threshold - Math.max(0, total)),
    ratio: Math.min(1, Math.max(0, total / threshold)),
  };
}
