import {
  Children,
  cloneElement,
  isValidElement,
  ViewTransition,
  type ReactNode,
  type ReactElement,
} from 'react';
import { perTransition } from '@/lib/transitions/classes';
import { TRANSITIONS } from '@/lib/transitions/matrix';

const layers = Array.from({ length: 6 }, (_, index) =>
  perTransition(
    Object.fromEntries(
      TRANSITIONS.filter((name) => name !== 'instant').map((name) => [
        name,
        `caldera-layer-${index}`,
      ]),
    ),
  ),
);

/**
 * No DOM wrapper, no client bundle, no initially hidden content. React
 * captures each layer at full opacity, then animates its native snapshot.
 * CSS entrance animations are enabled only when no native capture takes over.
 * Automatic names keep separate headers/sections from sharing an identity.
 * Only text participates: links, CTA groups and form controls remain live
 * because native hit-testing excludes named transition participants.
 */
export function ArrivalLayers({ children }: { children: ReactNode }) {
  return Children.map(children, (child, index) =>
    !isValidElement(child) ||
    !['p', 'h1', 'h2'].includes(String(child.type)) ? (
      child
    ) : (
      <ViewTransition
        enter={layers[Math.min(index, layers.length - 1)]}
        exit={layers[Math.min(index, layers.length - 1)]}
        update={layers[Math.min(index, layers.length - 1)]}
        default="none"
      >
        {cloneElement(
          child as ReactElement<{ 'data-caldera-layer'?: number }>,
          { 'data-caldera-layer': Math.min(index, layers.length - 1) },
        )}
      </ViewTransition>
    ),
  );
}
