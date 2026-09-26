// Delivery and return facts shown next to the purchase button: the same
// ShippingMethod rows and CGV values as the Offer markup (src/lib/seo/jsonld.ts).
import type { ShippingFact } from '@/lib/seo/shipping';
import { HANDLING_TIME, RETURN_POLICY } from '@/lib/seo/policies';
import { formatPrice } from '@/utils/formatPrice';

/** Serializable view of a shipping method, for the client purchase panel. */
export interface ShippingOptionView {
  code: string;
  name: string;
  /** « 5,90 € », « offerte dès 150,00 € d’achat », « 2 à 4 jours ouvrés ». */
  details: string[];
  destinations: string[];
}

/** « 1 jour ouvré », « 2 à 4 jours ouvrés », « 3 jours ouvrés ». */
export function businessDays(min: number, max: number): string {
  const unit = max > 1 ? 'jours ouvrés' : 'jour ouvré';
  return min === max ? `${max} ${unit}` : `${min} à ${max} ${unit}`;
}

function transitTime(fact: Pick<ShippingFact, 'minDays' | 'maxDays'>) {
  const { minDays: min, maxDays: max } = fact;
  if (!Number.isInteger(min) || !Number.isInteger(max)) return null;
  if (min === null || max === null || min < 0 || max < min) return null;
  return `livraison en ${businessDays(min, max)}`;
}

export function shippingOptionViews(
  facts: readonly ShippingFact[],
): ShippingOptionView[] {
  return facts.map((fact) => {
    const transit = transitTime(fact);
    return {
      code: fact.code,
      name: fact.name,
      details: [
        Number(fact.price) > 0 ? formatPrice(fact.price) : 'offerte',
        ...(fact.freeFromAmount && Number(fact.price) > 0
          ? [`offerte dès ${formatPrice(fact.freeFromAmount)} d’achat`]
          : []),
        ...(transit ? [transit] : []),
      ],
      destinations: fact.destinations.map((destination) => destination.name),
    };
  });
}

/** CGV art. 10.3. */
export const HANDLING_LABEL = `Commande préparée et expédiée sous ${businessDays(
  HANDLING_TIME.minDays,
  HANDLING_TIME.maxDays,
)} après confirmation du paiement.`;

/** CGV art. 12. */
export const RETURN_LABEL = `Droit de rétractation de ${RETURN_POLICY.days} jours à compter de la réception ; les frais de retour sont à votre charge.`;
export const RETURN_POLICY_PATH = RETURN_POLICY.path;
