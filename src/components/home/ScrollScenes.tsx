'use client';

import { useLayoutEffect } from 'react';
import { observeScrollScenes } from '@/lib/motion/observer';
import { observeHomeJourney } from '@/lib/motion/journey';
import { observeHomeDepth } from '@/lib/motion/depth';

/** Presentation only; never a second rendering of the server content. */
export function ScrollScenes() {
  useLayoutEffect(() => {
    const scenes = observeScrollScenes();
    const journey = observeHomeJourney();
    const depth = observeHomeDepth();
    return () => {
      depth?.();
      journey?.();
      scenes?.();
    };
  }, []);
  return null;
}
