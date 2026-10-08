'use client';
import Image from 'next/image';
import { useId, useSyncExternalStore, ViewTransition } from 'react';
import {
  PRODUCT_MORPH,
  productTransitionName,
} from '@/lib/transitions/classes';
import { productTransitions } from '@/lib/transitions/runtime';

/**
 * A product card's image, which becomes the product page's image. Named
 * only while it is the one travelling: the card just clicked, or, on the
 * way back, the product's card in the listing (`returnTarget`: the main
 * grid only, where a product never shows twice). Never two at once.
 */
export function SharedProductImage({
  slug,
  returnTarget = false,
  src,
  alt,
  sizes,
}: {
  slug: string;
  returnTarget?: boolean;
  src: string;
  alt: string;
  sizes: string;
}) {
  const id = useId();
  const { activeCard, returnSlug } = useSyncExternalStore(
    productTransitions.subscribe,
    productTransitions.get,
    productTransitions.getServer,
  );
  const shared = activeCard === id || (returnTarget && returnSlug === slug);
  return (
    <ViewTransition
      name={shared ? productTransitionName(slug) : undefined}
      share={PRODUCT_MORPH}
      default="none"
    >
      <Image src={src} alt={alt} fill sizes={sizes} data-vt-product={id} />
    </ViewTransition>
  );
}
