import type { ViewTransitionClassPerType } from 'react';
import { transitionType, type TransitionName } from './matrix';

/**
 * A <ViewTransition> class for some journeys only: every other transition,
 * typed or not (refresh, filters, Suspense), leaves the element alone.
 */
export function perTransition(
  classes: Partial<Record<TransitionName, string>>,
): ViewTransitionClassPerType {
  return {
    default: 'none',
    ...Object.fromEntries(
      Object.entries(classes).map(([name, value]) => [
        transitionType(name as TransitionName),
        value,
      ]),
    ),
  };
}

/** A product's image, from its card to its page and back. */
export const productTransitionName = (slug: string) =>
  `product-image-${slug.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
export const PRODUCT_MORPH = perTransition({
  product: 'caldera-product',
  'product-return': 'caldera-product',
});

/** The landscape of a hero, carried into and through the world. */
export const WORLD_HERO_NAME = 'caldera-world-hero';
export const WORLD_HERO = perTransition({
  'enter-world': 'caldera-world',
  'leave-world': 'caldera-world',
  descend: 'caldera-world',
  ascend: 'caldera-world',
  'chapter-forward': 'caldera-world',
  'chapter-back': 'caldera-world',
});

/** « CHRONIQUE 02 » turning into « CHRONIQUE 03 ». */
export const CHRONICLE_NUMBER_NAME = 'caldera-chronicle-number';
export const CHRONICLE_NUMBER = perTransition({
  'chapter-forward': 'caldera-chronicle',
  'chapter-back': 'caldera-chronicle',
});
