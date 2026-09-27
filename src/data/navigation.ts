// Header, mobile menu and footer links (docs/seo-architecture.md §7): games and
// families from the landing index, listings only while indexable, then pages
// that always answer 200.
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
/** A menu entry; `children` open under it (families of a game, related pages). */
export interface NavItem extends NavLink {
  children: NavLink[];
}
export interface SiteNavigation {
  /** Games with an indexable hub, menu order; children: their families. */
  games: NavItem[];
  /** Indexable multi-game family hubs. */
  familyHubs: NavLink[];
  /** /catalogue while indexable. */
  catalogue: NavLink | null;
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
    games: navigation.games.map((game) => ({
      href: game.href,
      label: game.shortName?.trim() || game.name,
      children: flattenFamilies(game.families),
    })),
    familyHubs: navigation.categoryHubs.map((family) => ({
      href: family.href,
      label: family.label,
    })),
    catalogue: listings.has('catalogue')
      ? { href: LISTING_HUBS.catalogue.path, label: 'Tout le catalogue' }
      : null,
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

/** Desktop header: games, indexable listings, extensions and guides. */
export function headerItems(site: SiteNavigation): NavItem[] {
  const shop: NavItem[] = site.games.length
    ? site.games.slice(0, 3)
    : site.catalogue
      ? [{ ...site.catalogue, children: [] }]
      : [];
  return [
    ...shop,
    ...site.listings.map((link) => ({ ...link, children: [] })),
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
  ];
}
