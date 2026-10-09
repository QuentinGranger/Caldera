'use client';

import { useLayoutEffect } from 'react';
import { observeScrollScenes } from '@/lib/motion/observer';
import { observeHomeJourney } from '@/lib/motion/journey';

/** Presentation only; never a second rendering of the server content. */
export function ScrollScenes() {
  useLayoutEffect(() => {
    const scenes = observeScrollScenes();
    const journey = observeHomeJourney();
    return () => {
      journey?.();
      scenes?.();
    };
  }, []);
  return null;
}
