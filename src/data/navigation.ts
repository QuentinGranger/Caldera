// Header, mobile menu and footer links (docs/seo-architecture.md §7): the
// catalogue always, games and families from the landing index, listings only
// while indexable, then pages that always answer 200.
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
import { CATALOG_CACHE_TAG } from '@/lib/cache/catalogCache';

export interface NavLink {
  href: string;
  label: string;
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
  /** Games with an indexable hub, menu order; children: their families. */
  games: NavItem[];
  /** Indexable multi-game family hubs (« Accessoires pour tous les jeux »). */
  familyHubs: NavLink[];
  /** The same hubs by short name, under a « Par type de produit » title. */
  productTypes: NavLink[];
  /** /catalogue: always reachable, even before it has enough products to be indexed. */
  catalogue: NavLink;
  /** Nouveautés, Précommandes, En stock while indexable. */
  listings: NavLink[];
  extensions: NavLink;
  calendar: NavLink;
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
    { href: family.href, label: family.label },
    ...flattenFamilies(family.children),
  ]);
}

/** Pure part of getSiteNavigation. */
export function buildSiteNavigation(
  navigation: Navigation,
  listings: ReadonlySet<ListingKind>,
  content: { questions: boolean; news: boolean } = {
    questions: false,
    news: false,
  },
): SiteNavigation {
  const listing = (kind: ListingKind): NavLink => ({
    href: LISTING_HUBS[kind].path,
    label: LISTING_HUBS[kind].label,
  });
  return {
    games: navigation.games.map((game) => {
      const label = game.shortName?.trim() || game.name;
      const families = flattenFamilies(game.families);
      return {
        href: game.href,
        label,
        children: families.length
          ? [{ href: game.href, label: `Tout ${label}` }, ...families]
          : [],
      };
    }),
    familyHubs: navigation.categoryHubs.map((family) => ({
      href: family.href,
      label: family.label,
    })),
    productTypes: navigation.categoryHubs.map((family) => ({
      href: family.href,
      label: family.name,
    })),
    catalogue: {
      href: LISTING_HUBS.catalogue.path,
      label: 'Tout le catalogue',
    },
    listings: LISTING_ORDER.filter((kind) => listings.has(kind)).map(listing),
    extensions: { href: '/extensions', label: 'Extensions' },
    calendar: {
      href: '/calendrier-des-sorties',
      label: 'Calendrier des sorties',
    },
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
  ['site-navigation-listings'],
  { tags: [CATALOG_CACHE_TAG], revalidate: 3600 },
);

/** Menus of the current request; without the database, only fixed pages. */
export const getSiteNavigation = cache(async (): Promise<SiteNavigation> => {
  try {
    const [navigation, listings, content] = await Promise.all([
      getNavigation(),
      cachedListings(),
      getAllContent(),
    ]);
    return buildSiteNavigation(navigation, new Set(listings), {
      questions: content.some((entry) => entry.kind === 'question'),
      news: content.some((entry) => entry.kind === 'actualite'),
    });
  } catch {
    return buildSiteNavigation({ games: [], categoryHubs: [] }, new Set());
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
    { title: 'Sélections', links: [site.catalogue, ...site.listings] },
  ];
}

/** Desktop header: the shop, the main games, extensions, guides, universe. */
export function headerItems(site: SiteNavigation): NavItem[] {
  return [
    {
      href: site.catalogue.href,
      label: 'Boutique',
      children: [],
      groups: shopGroups(site),
    },
    ...site.games.slice(0, 2),
    {
      ...site.extensions,
      children: [
        { href: site.extensions.href, label: 'Toutes les extensions' },
        site.calendar,
      ],
    },
    {
      ...site.guides,
      children: [
        { href: site.guides.href, label: 'Tous les guides' },
        site.glossary,
        ...(site.questions ? [site.questions] : []),
        ...(site.news ? [site.news] : []),
      ],
    },
    { ...site.universe, children: [] },
  ];
}
