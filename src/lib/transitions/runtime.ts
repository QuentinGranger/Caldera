import { addTransitionType } from 'react';
import {
  chooseTransition,
  transitionType,
  type TransitionName,
} from './matrix';
import { productSlug, routeKind, samePage } from './routes';

/*
 * The browser side of the transition engine. Next.js calls
 * beginNavigation() inside the very React transition of each navigation
 * (link, router.push/replace, back/forward: src/instrumentation-client.ts),
 * so the type added here reaches React and the CSS. Nothing here may throw
 * or delay a navigation: at worst, a page arrives without its animation.
 *
 * Back/forward never animate: React applies them at once, inside the
 * browser's popstate, so that the browser restores the scroll position
 * exactly (and a phone's own swipe animation is never doubled).
 */

let currentPath: string | null = null;
let lastClick: { path: string; transition: string | null; at: number } | null =
  null;
/** The journey of the navigation under way, for the page it leads to. */
let pendingArrival: { path: string; name: TransitionName | null } | null = null;

/*
 * The page as the stage. React animates only its <ViewTransition>
 * boundaries and hides the rest of the page, unless <html> carries its own
 * view-transition-name inline. It does so for a journey only, until shortly
 * after it lands: filters, back/forward, an `instant` page, every other
 * update stays as React keeps it, still. Set through the CSSOM, never as an
 * HTML attribute (strict CSP).
 */
let stageTimer: ReturnType<typeof setTimeout> | undefined;
function stage(on: boolean) {
  clearTimeout(stageTimer);
  document.documentElement.style.viewTransitionName = on ? 'root' : '';
  // A navigation that never lands releases the stage all the same.
  if (on) releaseStage(10_000);
}
/** The journey has landed: its transition is over well within 1.5 s. */
export function releaseStage(after = 1500) {
  clearTimeout(stageTimer);
  stageTimer = setTimeout(() => {
    document.documentElement.style.viewTransitionName = '';
  }, after);
}

const decode = (path: string) => {
  try {
    return decodeURI(path);
  } catch {
    return path;
  }
};
const sameDestination = (a: string, b: string) =>
  samePage(decode(a), decode(b));

/** The page on screen, once React has committed it. */
export function notePath(pathname: string) {
  currentPath = pathname;
}

export function beginNavigation(url: string, navigation: string) {
  try {
    if (typeof window === 'undefined') return;
    const target = new URL(url, window.location.href);
    if (target.origin !== window.location.origin) return;
    // Back/forward: the address bar already shows the destination.
    const from = currentPath ?? window.location.pathname;
    if (sameDestination(from, target.pathname)) return stage(false);
    if (navigation === 'traverse') {
      setActiveCard(null);
      setReturnSlug(null);
      pendingArrival = { path: target.pathname, name: null };
      return stage(false);
    }
    const click =
      lastClick &&
      Date.now() - lastClick.at < 1500 &&
      sameDestination(lastClick.path, target.pathname)
        ? lastClick
        : null;
    // Leaving a product for its listing: its card receives the image, if
    // it is in sight (React leaves an element off screen out of it).
    setReturnSlug(routeKind(from) === 'PRODUCT' ? productSlug(from) : null);
    const name = chooseTransition({
      from,
      to: target.pathname,
      override: click?.transition ?? null,
    });
    pendingArrival = { path: target.pathname, name };
    stage(name !== null && name !== 'instant');
    if (name) addTransitionType(transitionType(name));
  } catch {
    // Never in the way of a navigation.
  }
}

/**
 * The journey that led to `pathname`, once: null when it arrived without
 * one, undefined when no navigation of ours led there (first visit).
 */
export function takeArrival(pathname: string) {
  const pending = pendingArrival;
  if (!pending || !sameDestination(pending.path, pathname)) return undefined;
  pendingArrival = null;
  return pending.name;
}

/** Remembers the link that starts a navigation, before React handles it. */
export function noteClick(event: MouseEvent) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return;
  const link = (event.target as Element | null)?.closest?.('a[href]');
  if (!(link instanceof HTMLAnchorElement)) return;
  if ((link.target && link.target !== '_self') || link.hasAttribute('download'))
    return;
  const url = new URL(link.href);
  if (url.origin !== window.location.origin) return;
  lastClick = {
    path: url.pathname,
    transition: link.dataset.transition ?? null,
    at: Date.now(),
  };
  // A product card: its image becomes the product page's image.
  const card = link.closest('[data-product-card]');
  const id =
    url.pathname.startsWith('/produit/') && card
      ? (card
          .querySelector('[data-vt-product]')
          ?.getAttribute('data-vt-product') ?? null)
      : null;
  setActiveCard(id);
}

/* Shared product image: one name at a time, never two cards together. */

type ProductState = { activeCard: string | null; returnSlug: string | null };
let productState: ProductState = { activeCard: null, returnSlug: null };
const listeners = new Set<() => void>();

function update(next: Partial<ProductState>) {
  const merged = { ...productState, ...next };
  if (
    merged.activeCard === productState.activeCard &&
    merged.returnSlug === productState.returnSlug
  )
    return;
  productState = merged;
  for (const listener of listeners) listener();
}
function setActiveCard(id: string | null) {
  update({ activeCard: id });
}
function setReturnSlug(slug: string | null) {
  update({ returnSlug: slug });
}

/** Server render and hydration: no shared name, nothing to mismatch. */
const SERVER_STATE: ProductState = { activeCard: null, returnSlug: null };

export const productTransitions = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  get: () => productState,
  getServer: () => SERVER_STATE,
};
