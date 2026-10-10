// Header, mobile menu and footer links (docs/seo-architecture.md §7): the
// catalogue always, the licence sold and families from the landing index,
// listings only while indexable, then pages that always answer 200.
import 'server-only';
import { getAllContent } from '@/lib/content';
import { unstable_cache } from 'next/cache';
import { cache } from 'react';
import {
  LISTING_HUBS,
  getIndexableListings,
} from '@/components/catalog/listingHub';
import {
  getNavigation,
  type Navigation,
  type NavigationFamily,
} from '@/lib/seo/links';
import type { ListingKind } from '@/lib/seo/metadata';
import {
  CATALOG_CACHE_TAG,
  PREORDER_CACHE_KEY,
} from '@/lib/cache/catalogCache';
import { preordersEnabled } from '@/lib/catalog/preorders';
import { isShopGame } from '@/lib/catalog/shopGame';
import {
  getExtensionsIndex,
  getReleaseCalendar,
} from '@/components/landing/releaseData';

export interface NavLink {
  href: string;
  label: string;
  /** Without the game's name, under a menu that already shows it. */
  shortLabel?: string;
}
export interface NavGroup {
  title: string;
  links: NavLink[];
}
/**
 * A menu entry; `children` open under it (families of a game, related pages),
 * `groups` open as a wider panel of titled columns (the shop).
 */
export interface NavItem extends NavLink {
  children: NavLink[];
  groups?: NavGroup[];
}
export interface SiteNavigation {
  /**
   * The licence sold (SHOP_GAME) once its hub is indexable; children: its
   * families. Other games of the catalogue stay out of the menus.
   */
  games: NavItem[];
  /**
   * Indexable multi-game family hubs the licence sold does not cover, by
   * short name (« Accessoires »).
   */
  productTypes: NavLink[];
  /**
   * Root families of the offer, by short name: the licence sold's page, else
   * the multi-game page (licence-free products only).
   */
  families: NavLink[];
  /** The catalogue target; only offered while it has visible products. */
  catalogue: NavLink;
  catalogueAvailable: boolean;
  /** Nouveautés, Précommandes, En stock while indexable. */
  listings: NavLink[];
  extensions: NavLink | null;
  calendar: NavLink | null;
  guides: NavLink;
  glossary: NavLink;
  /** Only once the section has published entries. */
  questions: NavLink | null;
  news: NavLink | null;
  universe: NavLink;
  delivery: NavLink;
  contact: NavLink;
  account: NavLink;
}

const LISTING_ORDER: readonly Exclude<ListingKind, 'catalogue'>[] = [
  'nouveautes',
  'precommandes',
  'en-stock',
];

/** A family then its descendants, depth first: menus show two levels. */
function flattenFamilies(families: readonly NavigationFamily[]): NavLink[] {
  return families.flatMap((family) => [
    { href: family.href, label: family.label, shortLabel: family.name },
    ...flattenFamilies(family.children),
  ]);
}

const familySlugs = (families: readonly NavigationFamily[]): string[] =>
  families.flatMap((family) => [family.slug, ...familySlugs(family.children)]);

/** One link per family, the first met: the licence sold's before the others. */
function rootFamilies(families: readonly NavigationFamily[]): NavLink[] {
  const links = new Map<string, NavLink>();
  for (const family of families)
    if (!links.has(family.slug))
      links.set(family.slug, { href: family.href, label: family.name });
  return [...links.values()];
}

/** Pure part of getSiteNavigation. */
export function buildSiteNavigation(
  navigation: Navigation,
  listings: ReadonlySet<ListingKind>,
  content: {
    questions: boolean;
    news: boolean;
    extensions?: boolean;
    calendar?: boolean;
  } = {
    questions: false,
    news: false,
  },
): SiteNavigation {
  const listing = (kind: ListingKind): NavLink => ({
    href: LISTING_HUBS[kind].path,
    label: LISTING_HUBS[kind].label,
  });
  const games = navigation.games.filter((game) => isShopGame([game.slug]));
  // A family the licence sold covers is reached through its menu; the
  // multi-game page only for the others (licence-free products).
  const covered = new Set(games.flatMap((game) => familySlugs(game.families)));
  return {
    games: games.map((game) => {
      const label = game.shortName?.trim() || game.name;
      const families = flattenFamilies(game.families);
      return {
        href: game.href,
        label,
        // The game itself first: menus show it as their main entry.
        children: families.length
          ? [{ href: game.href, label: `Tout ${label}` }, ...families]
          : [],
      };
    }),
    productTypes: navigation.categoryHubs
      .filter((family) => !covered.has(family.slug))
      .map((family) => ({ href: family.href, label: family.name })),
    families: rootFamilies([
      ...games.flatMap((game) => game.families),
      ...navigation.categoryHubs.filter(({ slug }) => !covered.has(slug)),
    ]),
    catalogueAvailable: listings.has('catalogue'),
    catalogue: {
      href: LISTING_HUBS.catalogue.path,
      label: 'Tout le catalogue',
    },
    listings: LISTING_ORDER.filter(
      (kind) =>
        listings.has(kind) && (kind !== 'precommandes' || preordersEnabled()),
    ).map(listing),
    extensions: content.extensions
      ? { href: '/extensions', label: 'Extensions' }
      : null,
    calendar: content.calendar
      ? {
          href: '/calendrier-des-sorties',
          label: 'Calendrier des sorties',
        }
      : null,
    guides: { href: '/guides', label: 'Guides' },
    glossary: { href: '/glossaire', label: 'Glossaire' },
    questions: content.questions
      ? { href: '/questions', label: 'Questions fréquentes' }
      : null,
    news: content.news ? { href: '/actualites', label: 'Actualités' } : null,
    universe: { href: '/univers', label: 'Univers' },
    delivery: { href: '/livraison', label: 'Livraison' },
    contact: { href: '/contact', label: 'Contact' },
    // Signed-in visitors are sent on to /compte: no redirect for crawlers.
    account: { href: '/compte/connexion', label: 'Mon compte' },
  };
}

// Four product counts: shared by every page, refreshed with the catalogue.
const cachedListings = unstable_cache(
  async (): Promise<ListingKind[]> => [
    ...(await getIndexableListings()).keys(),
  ],
  ['site-navigation-listings', PREORDER_CACHE_KEY],
  { tags: [CATALOG_CACHE_TAG], revalidate: 3600 },
);

const cachedReleaseSections = unstable_cache(
  async () => {
    const [extensions, calendar] = await Promise.all([
      getExtensionsIndex(),
      getReleaseCalendar(),
    ]);
    return {
      extensions: extensions.total > 0,
      calendar: calendar.upcoming.length + calendar.recent.length > 0,
    };
  },
  ['site-navigation-release-sections', PREORDER_CACHE_KEY],
  { tags: [CATALOG_CACHE_TAG], revalidate: 300 },
);

/** Menus of the current request; without the database, only fixed pages. */
export const getSiteNavigation = cache(async (): Promise<SiteNavigation> => {
  try {
    const [navigation, listings, content, releases] = await Promise.all([
      getNavigation(),
      cachedListings(),
      getAllContent(),
      cachedReleaseSections(),
    ]);
    return buildSiteNavigation(navigation, new Set(listings), {
      // The shop's FAQ is always there, card questions or not.
      questions: true,
      news: content.some((entry) => entry.kind === 'actualite'),
      ...releases,
    });
  } catch {
    return buildSiteNavigation({ games: [], categoryHubs: [] }, new Set(), {
      questions: true,
      news: false,
    });
  }
});

/** The shop as titled columns: by game, by product type, selections. */
export function shopGroups(site: SiteNavigation): NavGroup[] {
  return [
    ...(site.games.length
      ? [
          {
            title: 'Par jeu',
            links: site.games.map(({ href, label }) => ({ href, label })),
          },
        ]
      : []),
    ...(site.productTypes.length
      ? [{ title: 'Par type de produit', links: site.productTypes }]
      : []),
    ...(site.catalogueAvailable
      ? [{ title: 'Sélections', links: [site.catalogue, ...site.listings] }]
      : []),
  ];
}

/**
 * Desktop header: the compact storefront navigation from the original design,
 * under the rule of every other menu. A game, a product family or a listing
 * shows only once its page exists and is indexable, so an empty catalogue
 * (production before opening) never links to a 404.
 */
export function headerItems(site: SiteNavigation): NavItem[] {
  const pokemon = site.games.find((game) =>
    game.label.toLocaleLowerCase('fr').includes('pokémon'),
  );
  const shown = (links: readonly NavLink[], href: string, label: string) =>
    links.some((link) => link.href === href)
      ? [{ href, label, children: [] }]
      : [];

  return [
    // The catalogue leads only while there are products to explore.
    ...(pokemon
      ? [pokemon]
      : site.catalogueAvailable
        ? [{ href: site.catalogue.href, label: 'Catalogue', children: [] }]
        : []),
    ...shown(site.listings, '/nouveautes', 'Nouveautés'),
    ...shown(site.productTypes, '/categorie/scelles', 'Scellés'),
    ...shown(site.productTypes, '/categorie/cartes', 'Cartes'),
    ...shown(site.productTypes, '/categorie/accessoires', 'Accessoires'),
    ...(site.extensions
      ? [{ href: site.extensions.href, label: 'Collections', children: [] }]
      : []),
    { ...site.universe, children: [] },
  ];
}
