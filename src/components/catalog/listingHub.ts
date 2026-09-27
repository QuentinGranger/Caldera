// Transverse listings (/catalogue, /nouveautes, /precommandes, /en-stock):
// real aggregates, generated text, indexation and internal links.
import 'server-only';
import { cache } from 'react';
import type { CatalogFacets } from '@/lib/catalog/facets';
import type { CatalogScope } from '@/lib/catalog/params';
import {
  getCategories,
  getGames,
  toGameRef,
  type CatalogCategory,
} from '@/lib/catalog/taxonomy';
import { getPrisma } from '@/lib/db/prisma';
import { landingPath } from '@/lib/seo/facets';
import { decideListingIndexation } from '@/lib/seo/indexation';
import {
  listingText,
  type ListingKind,
  type MetadataText,
} from '@/lib/seo/metadata';
import {
  categoryHubPath,
  getLandingIndex,
  getScopeStats,
  getScopeWhere,
  type RegistryScope,
} from '@/lib/seo/registry';
import { sharedCache } from '@/lib/cache/catalogCache';
import type {
  GameRef,
  IndexDecision,
  ScopeStats,
  SeoLink,
  SeoLinkGroup,
  StatusSlug,
} from '@/lib/seo/types';
import { getScopeFacets } from './catalogLoad';

export interface ListingHubConfig {
  listing: ListingKind;
  path: string;
  /** Breadcrumb label. */
  label: string;
  /** Anchor used by the other listings. */
  anchor: string;
  /** Title of the empty state. */
  emptyTitle: string;
  status?: StatusSlug;
  /** Visible products needed to be indexable (docs/seo-architecture.md §4). */
  min: number;
}

export const LISTING_HUBS: Readonly<Record<ListingKind, ListingHubConfig>> = {
  catalogue: {
    listing: 'catalogue',
    path: '/catalogue',
    label: 'Catalogue',
    anchor: 'Tout le catalogue',
    emptyTitle: 'Aucun produit en ligne pour le moment',
    min: 1,
  },
  nouveautes: {
    listing: 'nouveautes',
    path: '/nouveautes',
    label: 'Nouveautés',
    anchor: 'Toutes les nouveautés',
    emptyTitle: 'Aucune nouveauté pour le moment',
    status: 'nouveautes',
    min: 2,
  },
  precommandes: {
    listing: 'precommandes',
    path: '/precommandes',
    label: 'Précommandes',
    anchor: 'Toutes les précommandes',
    emptyTitle: 'Aucune précommande ouverte pour le moment',
    status: 'precommandes',
    min: 2,
  },
  'en-stock': {
    listing: 'en-stock',
    path: '/en-stock',
    label: 'En stock',
    anchor: 'Tous les produits en stock',
    emptyTitle: 'Aucun produit en stock pour le moment',
    status: 'en-stock',
    min: 2,
  },
};

export const LISTING_KINDS = Object.keys(LISTING_HUBS) as ListingKind[];

/** Same scope for the product list (CatalogScope) and the aggregates (RegistryScope). */
export function listingScope(
  listing: ListingKind,
): CatalogScope & RegistryScope {
  const { status } = LISTING_HUBS[listing];
  return status ? { status } : {};
}

// ---------------------------------------------------------------------------
// Aggregates

export interface ScopeGame {
  game: GameRef;
  count: number;
}
export interface ScopeGames {
  /** Most products first, menu order on ties. */
  games: ScopeGame[];
  /** Multi-game products (no game). */
  gamelessCount: number;
}

const readScopeGames = cache(async (scopeKey: string): Promise<ScopeGames> => {
  const scope = JSON.parse(scopeKey) as RegistryScope;
  const [where, games] = await Promise.all([getScopeWhere(scope), getGames()]);
  const groups = await getPrisma().product.groupBy({
    by: ['gameId'],
    where,
    _count: { _all: true },
  });
  const counts = new Map(
    groups.map((group) => [group.gameId, group._count._all]),
  );
  return {
    games: games
      .flatMap((game) => {
        const count = counts.get(game.id) ?? 0;
        return count ? [{ game: toGameRef(game), count }] : [];
      })
      .sort((a, b) => b.count - a.count),
    gamelessCount: counts.get(null) ?? 0,
  };
});

/** Visible products of a scope by game. */
export function getScopeGames(scope: RegistryScope): Promise<ScopeGames> {
  return readScopeGames(JSON.stringify(scope));
}

export interface PresentFamily {
  slug: string;
  name: string;
  count: number;
}

/**
 * Most specific families of the facets (no child of theirs is present), most
 * products first, taxonomy order on ties.
 */
export function presentFamilies(
  facets: Pick<CatalogFacets, 'categories'>,
  categories: readonly Pick<CatalogCategory, 'id' | 'slug' | 'parentId'>[],
): PresentFamily[] {
  const present = new Set(facets.categories.map((category) => category.slug));
  const withPresentChild = new Set(
    categories
      .filter((category) => category.parentId && present.has(category.slug))
      .map((category) => category.parentId),
  );
  const ids = new Map(
    categories.map((category) => [category.slug, category.id]),
  );
  return facets.categories
    .filter((category) => !withPresentChild.has(ids.get(category.slug) ?? ''))
    .map(({ slug, name, count }) => ({ slug, name, count }))
    .sort((a, b) => b.count - a.count);
}

// Four catalogue-wide counts used by many pages: shared across requests.
const cachedListingCounts = sharedCache(
  () =>
    Promise.all(
      LISTING_KINDS.map(async (listing) =>
        getPrisma().product.count({
          where: await getScopeWhere(listingScope(listing)),
        }),
      ),
    ),
  ['listing-counts'],
  300,
);

const readListingCounts = cache(async () => {
  const counts = await cachedListingCounts();
  return new Map(
    LISTING_KINDS.map((listing, index) => [listing, counts[index] ?? 0]),
  );
});

const countStats = (productCount: number): ScopeStats => ({
  productCount,
  inStockCount: 0,
  preorderCount: 0,
  newArrivalCount: 0,
  minPrice: null,
  maxPrice: null,
  languages: [],
  lastModified: null,
});

/** Indexable transverse listings with their product count. */
export async function getIndexableListings(): Promise<
  Map<ListingKind, number>
> {
  const counts = await readListingCounts();
  const indexable = new Map<ListingKind, number>();
  for (const listing of LISTING_KINDS) {
    const { path, min } = LISTING_HUBS[listing];
    const count = counts.get(listing) ?? 0;
    if (decideListingIndexation({ path, stats: countStats(count), min }).index)
      indexable.set(listing, count);
  }
  return indexable;
}

// ---------------------------------------------------------------------------
// Hub

export interface ListingHub {
  config: ListingHubConfig;
  stats: ScopeStats;
  games: ScopeGames;
  families: PresentFamily[];
  /** H1: the subject of the listing (games included when there are one or two). */
  heading: string;
  /** Title and description of the first page, without the brand suffix. */
  text: MetadataText;
  /** Decision of the unrefined first page. */
  decision: IndexDecision;
}

/** Everything the listing states comes from these aggregates. */
export const getListingHub = cache(
  async (listing: ListingKind): Promise<ListingHub> => {
    const config = LISTING_HUBS[listing];
    const scope = listingScope(listing);
    const [stats, games, facets, categories] = await Promise.all([
      getScopeStats(scope),
      getScopeGames(scope),
      getScopeFacets(scope),
      getCategories(),
    ]);
    const families = presentFamilies(facets, categories);
    // listingText names two games at most: beyond, naming some would mislead.
    const gameNames =
      games.games.length <= 2 ? games.games.map(({ game }) => game.name) : [];
    return {
      config,
      stats,
      games,
      families,
      heading: listingText({ listing, stats, gameNames }).title,
      text: listingText({
        listing,
        stats,
        gameNames,
        availableCategoryNames: families.map((family) => family.name),
      }),
      decision: decideListingIndexation({
        path: config.path,
        stats,
        min: config.min,
      }),
    };
  },
);

// ---------------------------------------------------------------------------
// Internal links: only pages of the landing index or indexable listings

const MAX_LINKS = 12;

/** « Boosters » → « boosters » inside a sentence; keeps « ETB ». */
function inSentence(name: string): string {
  const [first = '', ...rest] = name.split(' ');
  if (
    /\p{Lu}/u.test(first.slice(1)) ||
    rest.some((word) => /\p{Lu}/u.test(word))
  )
    return name;
  return first.charAt(0).toLocaleLowerCase('fr-FR') + name.slice(1);
}

function statusAnchor(status: StatusSlug, game: string, family?: string) {
  const subject = family ? `${family} ${game}` : game;
  if (status === 'en-stock') return `${subject} en stock`;
  if (status === 'precommandes')
    return family ? `${subject} en précommande` : `Précommandes ${game}`;
  return family
    ? `Nouveautés ${inSentence(family)} ${game}`
    : `Nouveautés ${game}`;
}

function group(title: string, links: readonly SeoLink[]): SeoLinkGroup {
  const seen = new Set<string>();
  return {
    title,
    links: links
      .filter((link) => !seen.has(link.href) && seen.add(link.href))
      .slice(0, MAX_LINKS),
  };
}

const GROUP_TITLES: Record<ListingKind, { games: string; families: string }> = {
  catalogue: {
    games: 'Le catalogue par jeu',
    families: 'Le catalogue par famille',
  },
  nouveautes: {
    games: 'Nouveautés par jeu',
    families: 'Nouveautés par famille',
  },
  precommandes: {
    games: 'Précommandes par jeu',
    families: 'Précommandes par famille',
  },
  'en-stock': {
    games: 'En stock par jeu',
    families: 'En stock par famille',
  },
};

export interface ListingHubLinks {
  /** Groups shown under the grid; empty for an empty listing. */
  groups: SeoLinkGroup[];
  /** Links of the empty state: other listings and game hubs. */
  fallback: SeoLink[];
  /** Target of each game named in the intro, when indexable. */
  gameTargets: Map<string, string>;
  /** /catalogue is indexable (breadcrumb link). */
  catalogueIndexable: boolean;
}

export async function getListingHubLinks(
  hub: ListingHub,
): Promise<ListingHubLinks> {
  const { listing, status } = hub.config;
  const [index, listings, games, categories] = await Promise.all([
    getLandingIndex(),
    getIndexableListings(),
    getGames(),
    getCategories(),
  ]);
  const counts = new Map(
    [...index.landings, ...index.categoryHubs].map((page) => [
      page.path,
      page.productCount,
    ]),
  );
  const link = (href: string, label: string): SeoLink[] => {
    const count = counts.get(href);
    return count === undefined ? [] : [{ href, label, count }];
  };
  const gameRefs = games.map(toGameRef);
  const gameHubs = gameRefs.flatMap((game) =>
    link(landingPath({ game }), `Tous les produits ${game.name}`),
  );
  const otherListings = LISTING_KINDS.filter(
    (other) => other !== listing && listings.has(other),
  ).map((other) => ({
    href: LISTING_HUBS[other].path,
    label: LISTING_HUBS[other].anchor,
    count: listings.get(other),
  }));

  const gameTargets = new Map<string, string>();
  for (const game of gameRefs) {
    const path = landingPath(status ? { game, status } : { game });
    if (counts.has(path)) gameTargets.set(game.id, path);
  }

  const titles = GROUP_TITLES[listing];
  const byGame = status
    ? gameRefs.flatMap((game) =>
        link(landingPath({ game, status }), statusAnchor(status, game.name)),
      )
    : gameHubs;
  // A multi-game family hub stands for its game landings.
  const byFamily = categories.flatMap((category) => {
    if (!status) {
      const hub = link(
        categoryHubPath(category.slug),
        `${category.name} pour tous les jeux`,
      );
      if (hub.length) return hub;
    }
    return gameRefs.flatMap((game) =>
      status
        ? link(
            landingPath({ game, category, status }),
            statusAnchor(status, game.name, category.name),
          )
        : link(
            landingPath({ game, category }),
            `${category.name} ${game.name}`,
          ),
    );
  });
  const empty = hub.stats.productCount === 0;
  return {
    groups: empty
      ? []
      : [
          group(titles.games, byGame),
          group(titles.families, byFamily),
          group('Autres sélections', otherListings),
        ].filter((entry) => entry.links.length),
    fallback: group('', [...otherListings, ...gameHubs]).links,
    gameTargets,
    catalogueIndexable: listings.has('catalogue'),
  };
}
