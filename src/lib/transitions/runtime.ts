import { addTransitionType } from 'react';
import {
  chooseTransition,
  transitionType,
  type TransitionName,
} from './matrix';
import { productSlug, routeKind, samePage } from './routes';
import { isPageJourney } from './navigation';

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
let lastClick: {
  path: string;
  transition: string | null;
  at: number;
  previewed: boolean;
} | null = null;
/** The journey of the navigation under way, for the page it leads to. */
let pendingArrival: {
  path: string;
  name: TransitionName | null;
  landscape: LandscapeSnapshot | null;
} | null = null;

type LandscapeSnapshot = {
  src: string;
  top: number;
  left: number;
  width: number;
  height: number;
  position: string;
  radius: string;
  filter: string;
};
let landscapeSnapshot: LandscapeSnapshot | null = null;
const landscapeListeners = new Set<() => void>();
function setLandscape(snapshot: LandscapeSnapshot | null) {
  if (landscapeSnapshot === snapshot) return;
  landscapeSnapshot = snapshot;
  for (const listener of landscapeListeners) listener();
}
export const landscapeTransitions = {
  subscribe(listener: () => void) {
    landscapeListeners.add(listener);
    return () => {
      landscapeListeners.delete(listener);
    };
  },
  get: () => landscapeSnapshot,
  getServer: () => null,
};

/** Retain only the already loaded decorative image, never text or controls. */
function captureLandscape(): LandscapeSnapshot | null {
  try {
    const landscape = document.querySelector<HTMLElement>(
      '[data-caldera-landscape]',
    );
    const image = landscape?.querySelector('img');
    if (!landscape || !image?.complete || !image.naturalWidth) return null;
    const rect = landscape.getBoundingClientRect();
    const headerBottom =
      document.querySelector('header')?.getBoundingClientRect().bottom ?? 0;
    if (
      !rect.width ||
      !rect.height ||
      rect.bottom <= headerBottom ||
      rect.top >= window.innerHeight
    )
      return null;
    const imageStyle = window.getComputedStyle(image);
    return {
      src: image.currentSrc || image.src,
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      position: imageStyle.objectPosition,
      radius: window.getComputedStyle(landscape).borderRadius,
      filter: imageStyle.filter,
    };
  } catch {
    return null;
  }
}

/*
 * Only the selected product image is captured. Never name the HTML,
 * main, header, footer or controls: a named ancestor excludes its descendants
 * from native hit-testing. Navigation remains live during the animation.
 */
let stageTimer: ReturnType<typeof setTimeout> | undefined;

export type JourneyAnimator = {
  depart(): void;
  arrive(name: TransitionName, duration: number, complete: () => void): void;
  reset(): void;
};
let animator: JourneyAnimator | null = null;

/** The renderer registers its animation library without coupling routing to it. */
export function installJourneyAnimator(next: JourneyAnimator) {
  animator = next;
  document.documentElement.dataset.calderaAnimator = 'gsap';
  return () => {
    resetPresentation();
    animator = null;
    delete document.documentElement.dataset.calderaAnimator;
  };
}

/** Arrival has its own short timeline, independent of network latency. */
export function arrivalDuration(name: TransitionName) {
  const duration =
    name === 'instant'
      ? 0
      : name === 'shop'
        ? 700
        : name === 'archive'
          ? 620
          : name === 'product' || name === 'product-return'
            ? 650
            : 900;
  return window.matchMedia('(max-width: 47.99rem)').matches
    ? Math.round(duration * 0.8)
    : duration;
}

/** Native capabilities are needed only for optional product-image morphs. */
export function canAnimateJourney() {
  return (
    typeof document.startViewTransition === 'function' &&
    typeof CSS !== 'undefined' &&
    typeof CSS.supports === 'function' &&
    CSS.supports('view-transition-class', 'caldera') &&
    CSS.supports('selector(:active-view-transition-type(caldera-product))') &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function resetPresentation() {
  clearTimeout(stageTimer);
  stageTimer = undefined;
  animator?.reset();
  setLandscape(null);
  delete document.documentElement.dataset.calderaArrival;
  delete document.documentElement.dataset.calderaMotion;
  document.documentElement.style.removeProperty('--caldera-chrome-bottom');
  document.documentElement.style.removeProperty('--caldera-journey-budget');
  document.documentElement.style.removeProperty('--caldera-fog-opacity');
  document.documentElement.style.removeProperty('--caldera-fog-transform');
}

function stage(on: boolean) {
  resetPresentation();
  if (!on) return;
  measureChrome();
  document.documentElement.dataset.calderaMotion = 'departing';
  animator?.depart();
  // A failed navigation eventually releases the scene; the page stays usable.
  stageTimer = setTimeout(resetPresentation, 4000);
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
  measureChrome();
}
function measureChrome() {
  const header = document.querySelector('header');
  document.documentElement.style.setProperty(
    '--caldera-chrome-bottom',
    `${Math.max(0, Math.ceil(header?.getBoundingClientRect().bottom ?? 0))}px`,
  );
}

export function beginNavigation(url: string, navigation: string) {
  try {
    if (typeof window === 'undefined') return;
    const target = new URL(url, window.location.href);
    if (target.origin !== window.location.origin) return;
    // Back/forward: the address bar already shows the destination.
    const from = currentPath ?? window.location.pathname;
    if (
      navigation === 'traverse' ||
      !isPageJourney({
        from: new URL(from, window.location.origin),
        to: target,
      }) ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setActiveCard(null);
      setReturnSlug(null);
      pendingArrival = { path: target.pathname, name: null, landscape: null };
      return stage(false);
    }
    const click =
      lastClick &&
      Date.now() - lastClick.at < 1500 &&
      sameDestination(lastClick.path, target.pathname)
        ? lastClick
        : null;
    lastClick = null;
    if (!click) setActiveCard(null);
    // Leaving a product for its listing: its card receives the image, if
    // it is in sight (React leaves an element off screen out of it).
    const journey = chooseTransition({
      from,
      to: target.pathname,
      override: click?.transition ?? null,
    });
    setReturnSlug(
      journey === 'product-return' && routeKind(from) === 'PRODUCT'
        ? productSlug(from)
        : null,
    );
    // The capture-phase click already started the scene. Do not restart it
    // when React dispatches the navigation a moment later.
    if (!click?.previewed) {
      pendingArrival = {
        path: target.pathname,
        name: journey,
        landscape: journey && journey !== 'instant' ? captureLandscape() : null,
      };
      stage(journey !== null && journey !== 'instant');
    }
    // Native snapshots are reserved for the shared product image. A browser
    // callback is not evidence that a decorative capture painted anything.
    if (
      (journey === 'product' || journey === 'product-return') &&
      canAnimateJourney()
    )
      addTransitionType(transitionType(journey));
  } catch {
    // Never in the way of a navigation.
    resetPresentation();
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

/** Animate real decorative DOM at commit in every engine. The stage is keyed
 * by pathname, so consecutive journeys restart even when they have the same
 * type. No native callback can prematurely suppress or remove the entrance. */
export function presentArrival(pathname: string) {
  notePath(pathname);
  const previousLandscape = pendingArrival?.landscape ?? null;
  const arrival = takeArrival(pathname);
  if (arrival === undefined) {
    // Redirects or intermediate commits must not leave a loading scene behind.
    if (pendingArrival) resetPresentation();
    return;
  }
  if (
    !arrival ||
    arrival === 'instant' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
    return resetPresentation();
  const budget = arrivalDuration(arrival);
  const fog = document.querySelector('.caldera-veil__mineral');
  const fogStyle = fog ? window.getComputedStyle(fog) : null;
  setLandscape(previousLandscape);
  const root = document.documentElement;
  root.style.setProperty('--caldera-fog-opacity', fogStyle?.opacity || '0');
  root.style.setProperty(
    '--caldera-fog-transform',
    fogStyle?.transform || 'translate3d(-10%, 8%, 0)',
  );
  root.style.setProperty('--caldera-journey-budget', `${budget}ms`);
  root.dataset.calderaArrival = arrival;
  root.dataset.calderaMotion = 'live';
  clearTimeout(stageTimer);
  // Even a slow route gets a complete entrance when its content actually lands.
  const complete = () => {
    resetPresentation();
    setActiveCard(null);
    setReturnSlug(null);
  };
  if (animator) {
    animator.arrive(arrival, budget, complete);
    // GSAP owns completion; this timer only releases an interrupted renderer.
    stageTimer = setTimeout(complete, budget + 160);
  } else {
    stageTimer = setTimeout(complete, budget);
  }
}

/** Remembers the link that starts a navigation, before React handles it. */
export function noteClick(event: MouseEvent) {
  if (event.defaultPrevented) return;
  const link = (event.target as Element | null)?.closest?.('a[href]');
  if (!(link instanceof HTMLAnchorElement)) return;
  const url = new URL(link.href);
  if (
    !isPageJourney({
      from: new URL(window.location.href),
      to: url,
      button: event.button,
      modified:
        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey,
      target: link.target,
      download: link.hasAttribute('download'),
    })
  )
    return;
  lastClick = {
    path: url.pathname,
    transition: link.dataset.transition ?? null,
    at: Date.now(),
    previewed: true,
  };
  const journey = chooseTransition({
    from: currentPath ?? window.location.pathname,
    to: url.pathname,
    override: lastClick.transition,
  });
  const animated =
    journey !== null &&
    journey !== 'instant' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  pendingArrival = {
    path: url.pathname,
    name: animated ? journey : null,
    landscape: animated ? captureLandscape() : null,
  };
  // Feedback starts in this click handler, before router scheduling or fetches.
  stage(animated);
  // A product card: its image becomes the product page's image.
  const card = link.closest('[data-product-card]');
  const image = card?.querySelector<HTMLImageElement>('img[data-vt-product]');
  const id =
    url.pathname.startsWith('/produit/') &&
    card &&
    image?.complete &&
    image.naturalWidth > 0
      ? (image.getAttribute('data-vt-product') ?? null)
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
