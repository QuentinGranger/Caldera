'use client';

import { useLayoutEffect } from 'react';
import { observeScrollScenes } from '@/lib/motion/observer';

/** Presentation only; never a second rendering of the server content. */
export function ScrollScenes() {
  useLayoutEffect(observeScrollScenes, []);
  return null;
}
