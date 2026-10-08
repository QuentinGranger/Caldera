import { chronicleIndex, routeKind, samePage, type RouteKind } from './routes';

/**
 * The motion languages of Caldera. Each one is a transition type given to
 * React (`caldera-<name>`): the CSS of src/styles/base/_transitions.scss
 * choreographs the page, the veil and the shared elements from it.
 *
 *   souffle          a major move across the site: the page breathes out, a
 *                    shadow of volcanic rock passes, the new page rises
 *   shop             the shop: fast, precise, immediate
 *   archive          reading: a light fade, the title at once
 *   product          a product card becomes the product page (shared image)
 *   product-return   the product goes back into its collection
 *   enter-world      the shop is left behind: the camera walks into Caldera
 *   descend          from the universe into a chronicle
 *   ascend           from a chronicle back to the universe
 *   chapter-forward  to the next chronicle: travel forward
 *   chapter-back     to the previous one: travel back
 *   leave-world      the expedition ends: the shop comes back, sharp
 *   instant          checkout, account settings, legal pages: no show
 */
export const TRANSITIONS = [
  'souffle',
  'shop',
  'archive',
  'product',
  'product-return',
  'enter-world',
  'descend',
  'ascend',
  'chapter-forward',
  'chapter-back',
  'leave-world',
  'instant',
] as const;
export type TransitionName = (typeof TRANSITIONS)[number];

export const TYPE_PREFIX = 'caldera-';
export const transitionType = (name: TransitionName) =>
  `${TYPE_PREFIX}${name}` as const;

export function isTransitionName(value: unknown): value is TransitionName {
  return (TRANSITIONS as readonly unknown[]).includes(value);
}

/** The name carried by React transition types, if one of ours. */
export function transitionFromTypes(types: readonly string[]) {
  for (const type of types) {
    const name = type.startsWith(TYPE_PREFIX)
      ? type.slice(TYPE_PREFIX.length)
      : null;
    if (isTransitionName(name)) return name;
  }
  return null;
}

const WORLD: readonly RouteKind[] = ['UNIVERSE', 'CHRONICLE'];
const STORE: readonly RouteKind[] = [
  'HOME',
  'SHOP',
  'COLLECTION',
  'PRODUCT',
  'ACCOUNT',
];

/**
 * The transition matrix.
 *
 *   same page (query, anchor)          none: filters and anchors stay still
 *   … ↔ UTILITY                        instant
 *   CHRONICLE → next CHRONICLE         chapter-forward
 *   CHRONICLE → previous CHRONICLE     chapter-back
 *   UNIVERSE → CHRONICLE               descend
 *   CHRONICLE → UNIVERSE               ascend
 *   HOME, shop, guides → UNIVERSE…     enter-world
 *   UNIVERSE… → anything else          leave-world
 *   … → PRODUCT                        product
 *   PRODUCT → shop, collection, home   product-return
 *   … → EDITORIAL, EDITORIAL → …       archive
 *   HOME → shop, within the shop       shop
 *   anything else                      souffle
 *
 * `override`: a link may ask for its own (data-transition on the <a>).
 */
export function chooseTransition({
  from,
  to,
  override = null,
}: {
  from: string;
  to: string;
  override?: string | null;
}): TransitionName | null {
  if (samePage(from, to)) return null;
  if (isTransitionName(override)) return override;
  const source = routeKind(from);
  const target = routeKind(to);
  if (source === 'UTILITY' || target === 'UTILITY') return 'instant';
  if (source === 'CHRONICLE' && target === 'CHRONICLE')
    return chronicleIndex(to) > chronicleIndex(from)
      ? 'chapter-forward'
      : 'chapter-back';
  if (source === 'UNIVERSE' && target === 'CHRONICLE') return 'descend';
  if (source === 'CHRONICLE' && target === 'UNIVERSE') return 'ascend';
  if (!WORLD.includes(source) && WORLD.includes(target)) return 'enter-world';
  if (WORLD.includes(source) && !WORLD.includes(target)) return 'leave-world';
  if (target === 'PRODUCT') return 'product';
  if (source === 'PRODUCT' && ['SHOP', 'COLLECTION', 'HOME'].includes(target))
    return 'product-return';
  if (source === 'EDITORIAL' || target === 'EDITORIAL') return 'archive';
  if (STORE.includes(source) && STORE.includes(target) && target !== 'HOME')
    return 'shop';
  return 'souffle';
}
