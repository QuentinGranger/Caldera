// Delivery and return facts shown next to the purchase button: the same
// ShippingMethod rows and CGV values as the Offer markup (src/lib/seo/jsonld.ts).
import type { ShippingFact } from '@/lib/seo/shipping';
import { HANDLING_TIME, RETURN_POLICY } from '@/lib/seo/policies';
import type { ProductType } from '@/generated/prisma/client';
import { formatPrice } from '@/utils/formatPrice';

/** Serializable view of a shipping method, for the client purchase panel. */
export interface ShippingOptionView {
  code: string;
  name: string;
  /** Decimal string, « 4.90 ». */
  price: string;
  /** Decimal string: the amount of items from which the method is free. */
  freeFromAmount: string | null;
  /** « 2 à 4 jours ouvrés », when the carrier's transit time is known. */
  transit: string | null;
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
  return businessDays(min, max);
}

export function shippingOptionViews(
  facts: readonly ShippingFact[],
): ShippingOptionView[] {
  return facts.map((fact) => {
    const transit = transitTime(fact);
    return {
      code: fact.code,
      name: fact.name,
      price: fact.price,
      freeFromAmount: fact.freeFromAmount,
      transit,
      details: [
        Number(fact.price) > 0 ? formatPrice(fact.price) : 'offerte',
        ...(fact.freeFromAmount && Number(fact.price) > 0
          ? [`offerte dès ${formatPrice(fact.freeFromAmount)} d’achat`]
          : []),
        ...(transit ? [`livraison en ${transit}`] : []),
      ],
      destinations: fact.destinations.map((destination) => destination.name),
    };
  });
}

/** CGV art. 10.1: delivery in metropolitan France only. */
export const DELIVERY_ZONE_LABEL = 'France métropolitaine';
/** CGV art. 10.3, as a headline under the buy button. */
export const HANDLING_HEADLINE = `Expédition sous ${businessDays(
  HANDLING_TIME.minDays,
  HANDLING_TIME.maxDays,
)}`;

/** CGV art. 10.3. */
/** A preorder leaves with the whole order once the product is released. */
export const PREORDER_HANDLING_LABEL =
  'Précommande : expédition à partir de la date de sortie du produit.';
export const HANDLING_LABEL = `Commande préparée et expédiée sous ${businessDays(
  HANDLING_TIME.minDays,
  HANDLING_TIME.maxDays,
)} après confirmation du paiement.`;

/** CGV art. 12. */
export const RETURN_LABEL = `Droit de rétractation de ${RETURN_POLICY.days} jours à compter de la réception ; les frais de retour sont à votre charge.`;
export const RETURN_POLICY_PATH = RETURN_POLICY.path;

/** « 14 jours pour changer d’avis »: the right of withdrawal, never a promise of free returns. */
export const WITHDRAWAL_HEADLINE = `${RETURN_POLICY.days} jours`;
export const WITHDRAWAL_TEXT = 'pour changer d’avis';

/**
 * Sealed goods (CGV art. 3: « produits Pokémon JCC scellés »): the types sold
 * in their original packaging. Every variant is « Neuf »; only these are
 * also said to be sealed. Accessories, single cards and the rest are not.
 */
const SEALED_TYPES: readonly ProductType[] = [
  'BOOSTER',
  'BLISTER',
  'TRIPACK',
  'BUNDLE',
  'DISPLAY',
  'ETB',
  'COLLECTION_BOX',
  'TIN',
  'DECK',
];
export const isSealedProduct = (type: ProductType) =>
  SEALED_TYPES.includes(type);
