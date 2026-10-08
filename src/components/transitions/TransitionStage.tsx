'use client';
import { usePathname } from 'next/navigation';
import { useEffect, useLayoutEffect, ViewTransition } from 'react';
import { perTransition } from '@/lib/transitions/classes';
import { TRANSITIONS } from '@/lib/transitions/matrix';
import {
  noteClick,
  notePath,
  finishPresentation,
  resetPresentation,
  takeArrival,
} from '@/lib/transitions/runtime';

/**
 * The veil: one empty, fixed element whose identity changes with the page.
 * It is what makes React run a View Transition on each navigation; the page
 * keeps its controls live; individual landscapes/text travel above it, while
 * the veil carries the shadow of volcanic rock or the mist of the world.
 * `instant` gets no veil class: React then runs no transition at all.
 */
const VEIL = perTransition(
  Object.fromEntries(
    TRANSITIONS.filter((name) => name !== 'instant').map((name) => [
      name,
      `veil-${name}`,
    ]),
  ),
);

export function TransitionStage() {
  const pathname = usePathname();
  // In the commit of the new page, before capture: select the snapshot
  // choreography in _transitions.scss. The live content stays visible.
  // A first visit or a reload is left alone: it renders at once, as before.
  useLayoutEffect(() => {
    notePath(pathname);
    const arrival = takeArrival(pathname);
    if (arrival === undefined) return;
    const root = document.documentElement;
    if (arrival && arrival !== 'instant') root.dataset.calderaArrival = arrival;
    else delete root.dataset.calderaArrival;
  }, [pathname]);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onPreference = () => {
      if (preference.matches) resetPresentation();
    };
    document.addEventListener('click', noteClick, true);
    preference.addEventListener('change', onPreference);
    window.addEventListener('pagehide', resetPresentation);
    return () => {
      document.removeEventListener('click', noteClick, true);
      preference.removeEventListener('change', onPreference);
      window.removeEventListener('pagehide', resetPresentation);
      resetPresentation();
    };
  }, []);
  return (
    <ViewTransition
      key={pathname}
      name="caldera-veil"
      share={VEIL}
      default="none"
      onShare={finishPresentation}
      onEnter={finishPresentation}
    >
      <div className="caldera-veil" aria-hidden="true" />
    </ViewTransition>
  );
}
