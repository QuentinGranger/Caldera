'use client';
import { usePathname } from 'next/navigation';
import { useEffect, useLayoutEffect, ViewTransition } from 'react';
import { perTransition } from '@/lib/transitions/classes';
import { TRANSITIONS } from '@/lib/transitions/matrix';
import {
  noteClick,
  notePath,
  releaseStage,
  takeArrival,
} from '@/lib/transitions/runtime';

/**
 * The veil: one empty, fixed element whose identity changes with the page.
 * It is what makes React run a View Transition on each navigation; the page
 * itself (outside any boundary) moves as the document root, and the veil's
 * own layer carries the shadow of volcanic rock or the mist of the world.
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
  // In the commit of the new page, before it is painted or captured: its
  // hero, title and content rise in layers (data-arrive, _transitions.scss).
  // A first visit or a reload is left alone: it renders at once, as before.
  useLayoutEffect(() => {
    notePath(pathname);
    const arrival = takeArrival(pathname);
    if (arrival === undefined) return;
    releaseStage();
    const root = document.documentElement;
    if (arrival && arrival !== 'instant') root.dataset.calderaArrival = arrival;
    else delete root.dataset.calderaArrival;
  }, [pathname]);
  useEffect(() => {
    document.addEventListener('click', noteClick, true);
    return () => document.removeEventListener('click', noteClick, true);
  }, []);
  return (
    <ViewTransition
      key={pathname}
      name="caldera-veil"
      share={VEIL}
      default="none"
    >
      <div className="caldera-veil" aria-hidden="true" />
    </ViewTransition>
  );
}
