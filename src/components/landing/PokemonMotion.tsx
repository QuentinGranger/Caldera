'use client';

import { useLayoutEffect } from 'react';
import { observeHomeDepth } from '@/lib/motion/depth';

/** Rebind after a filtered server render; never intercept scroll or navigation. */
export function PokemonMotion({ revision }: { revision: string }) {
  useLayoutEffect(() => {
    const root = document.querySelector<HTMLElement>('[data-pokemon-world]');
    if (!root) return;
    const dispose = observeHomeDepth(root);
    return () => dispose?.();
  }, [revision]);
  return null;
}
