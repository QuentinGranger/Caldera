import { universeChapters } from '@/data/universe';

/**
 * What a page is, for the motion of arriving at it. Pure: shared by the
 * router hook (src/instrumentation-client.ts), the components and the tests.
 */
export type RouteKind =
  | 'HOME'
  | 'SHOP'
  | 'PRODUCT'
  | 'COLLECTION'
  | 'EDITORIAL'
  | 'UNIVERSE'
  | 'CHRONICLE'
  | 'ACCOUNT'
  | 'UTILITY';

/** The chronicles in reading order: 01 Origines … 05 Horizons inconnus. */
export const CHRONICLE_ORDER: readonly string[] = universeChapters.map(
  (chapter) => chapter.slug,
);

const FIRST_SEGMENT: Readonly<Record<string, RouteKind>> = {
  produit: 'PRODUCT',
  catalogue: 'SHOP',
  nouveautes: 'SHOP',
  'en-stock': 'SHOP',
  precommandes: 'SHOP',
  extensions: 'COLLECTION',
  categorie: 'COLLECTION',
  'calendrier-des-sorties': 'COLLECTION',
  guides: 'EDITORIAL',
  actualites: 'EDITORIAL',
  glossaire: 'EDITORIAL',
  questions: 'EDITORIAL',
  compte: 'ACCOUNT',
  favoris: 'ACCOUNT',
  panier: 'ACCOUNT',
  commande: 'ACCOUNT',
  alertes: 'ACCOUNT',
  newsletter: 'ACCOUNT',
  checkout: 'UTILITY',
  admin: 'UTILITY',
  cgv: 'UTILITY',
  'mentions-legales': 'UTILITY',
  confidentialite: 'UTILITY',
  livraison: 'UTILITY',
  retractation: 'UTILITY',
  contact: 'UTILITY',
  'en-construction': 'UTILITY',
  media: 'UTILITY',
  api: 'UTILITY',
};

function segments(pathname: string) {
  return pathname.split(/[?#]/)[0]!.split('/').filter(Boolean);
}

export function routeKind(pathname: string): RouteKind {
  const [first, second] = segments(pathname);
  if (!first) return 'HOME';
  if (first === 'univers')
    return second && CHRONICLE_ORDER.includes(second)
      ? 'CHRONICLE'
      : 'UNIVERSE';
  // Anything else at the root is a game's aisle (/pokemon, /pokemon/boosters).
  return FIRST_SEGMENT[first] ?? 'COLLECTION';
}

/** Position of a chronicle in the reading order, -1 elsewhere. */
export function chronicleIndex(pathname: string) {
  const [first, second] = segments(pathname);
  return first === 'univers' && second ? CHRONICLE_ORDER.indexOf(second) : -1;
}

/** The product a /produit/… path shows, null elsewhere. */
export function productSlug(pathname: string) {
  const [first, second] = segments(pathname);
  return first === 'produit' && second ? decodeURIComponent(second) : null;
}

/** Same page, other query or fragment: never a page transition. */
export function samePage(from: string, to: string) {
  const path = (value: string) =>
    `/${segments(value).join('/')}`.replace(/\/+$/, '') || '/';
  return path(from) === path(to);
}
