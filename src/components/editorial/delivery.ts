// /livraison: shipping methods from ShippingMethod and the delivery terms of
// the CGV (article 10). No figure comes from anywhere else.
import 'server-only';
import { cache } from 'react';
import { HANDLING_TIME } from '@/lib/seo/policies';
import { formatEuro, listFr, type MetadataText } from '@/lib/seo/metadata';
import { getShippingFacts, type ShippingFact } from '@/lib/seo/shipping';
import type { IndexDecision } from '@/lib/seo/types';
import { editorialDecision, fitSentences } from './editorial';

export const DELIVERY_PATH = '/livraison';
/** CGV art. 10.1. */
export const DELIVERY_ZONE = 'France métropolitaine';

/** CGV art. 10.3: « 1 à 2 jours ouvrés ». */
export function handlingLabel(): string {
  const { minDays, maxDays }: { minDays: number; maxDays: number } =
    HANDLING_TIME;
  return minDays === maxDays
    ? businessDays(minDays)
    : `${minDays} à ${businessDays(maxDays)}`;
}

function businessDays(count: number): string {
  return `${count} ${count > 1 ? 'jours ouvrés' : 'jour ouvré'}`;
}

/** Carrier transit time of a method, null when it is not stored. */
export function transitLabel(
  method: Pick<ShippingFact, 'estimatedMinDays' | 'estimatedMaxDays'>,
): string | null {
  const min = method.estimatedMinDays;
  const max = method.estimatedMaxDays;
  if (min === null && max === null) return null;
  if (min === null || max === null || min === max)
    return businessDays((min ?? max) as number);
  return `${Math.min(min, max)} à ${businessDays(Math.max(min, max))}`;
}

const isFree = (price: string) => Number(price) === 0;

/** « 4,90 € » or « Offerte ». */
export const priceLabel = (price: string) =>
  isFree(price) ? 'Offerte' : formatEuro(price);

/** Title and description built from the active methods and the CGV. */
export function deliveryText(methods: readonly ShippingFact[]): MetadataText {
  const handling = `Expédition sous ${handlingLabel()} après confirmation du paiement.`;
  if (!methods.length)
    return {
      title: 'Livraison et expédition',
      description: fitSentences([`Livraison en ${DELIVERY_ZONE}.`, handling]),
    };
  const cheapest = methods.reduce((best, method) =>
    Number(method.price) < Number(best.price) ? method : best,
  );
  const freeFrom = methods
    .filter((method) => method.freeFromAmount)
    .reduce<ShippingFact | null>(
      (best, method) =>
        !best || Number(method.freeFromAmount) < Number(best.freeFromAmount)
          ? method
          : best,
      null,
    );
  const sameThreshold = methods.every(
    (method) => method.freeFromAmount === freeFrom?.freeFromAmount,
  );
  const lead = freeFrom?.freeFromAmount
    ? `Livraison en ${DELIVERY_ZONE}, offerte dès ${formatEuro(freeFrom.freeFromAmount)} d’achat${
        sameThreshold ? '' : ` avec ${freeFrom.name}`
      }.`
    : `Livraison en ${DELIVERY_ZONE}.`;
  const price = isFree(cheapest.price)
    ? `${cheapest.name} : livraison offerte.`
    : methods.length > 1
      ? `Tarifs dès ${formatEuro(cheapest.price)}.`
      : `Tarif : ${formatEuro(cheapest.price)}.`;
  return {
    title: 'Livraison : modes, tarifs et délais',
    description: fitSentences([
      lead,
      price,
      handling,
      `Modes : ${listFr(methods.map((method) => method.name))}.`,
    ]),
  };
}

export interface DeliveryPage {
  methods: ShippingFact[];
  text: MetadataText;
  /** Noindex while no method is offered: the page then only restates the CGV. */
  decision: IndexDecision;
}

export const getDeliveryPage = cache(async (): Promise<DeliveryPage> => {
  const methods = await getShippingFacts();
  return {
    methods,
    text: deliveryText(methods),
    decision: editorialDecision(DELIVERY_PATH, methods.length > 0),
  };
});
