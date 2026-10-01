// Internal linking (docs/seo-architecture.md §7). Every target comes from the
// landing index, so only indexable pages are ever linked.
import 'server-only';
import { unstable_cache } from 'next/cache';
import { cache } from 'react';
import type { Prisma } from '@/generated/prisma/client';
import { listProductsAvailableFirst } from '@/lib/catalog/queries';
import {
  getCategories,
  getGameSets,
  getGames,
  type CatalogCategory,
} from '@/lib/catalog/taxonomy';
import { getPrisma } from '@/lib/db/prisma';
import type { CatalogProduct } from '@/types/product';
import {
  LANGUAGE_IN_LABELS,
  LANGUAGE_LABELS,
  LANGUAGE_SLUGS,
  STATUS_LABELS,
  STATUS_SLUGS,
  isSupportedScope,
  landingKind,
  landingPath,
  type FacetLanguage,
} from './facets';
import {
  categoryDescendants,
  categoryHubPath,
  categoryLineage,
  getLandingIndex,
  type IndexedPage,
  type LandingIndex,
} from './registry';
import { CATALOG_CACHE_TAG } from '@/lib/cache/catalogCache';
import type {
  CategoryRef,
  GameRef,
  LandingScope,
  LanguageCode,
  SeoLink,
  SeoLinkGroup,
  SetRef,
  StatusSlug,
} from './types';

const MAX_LINKS = 12;
const FACET_LANGUAGES = Object.keys(LANGUAGE_SLUGS) as FacetLanguage[];

/** Facets of a landing under a game, by slug. */
interface Facets {
  set?: string;
  category?: string;
  language?: FacetLanguage;
  status?: StatusSlug;
}

/** Indexable pages (landings and /categorie hubs) by path. */
type IndexLookup = Map<string, IndexedPage>;
function indexLookup(index: LandingIndex): IndexLookup {
  return new Map(
    [...index.landings, ...index.categoryHubs].map((page) => [page.path, page]),
  );
}
const getIndexLookup = cache(async () => indexLookup(await getLandingIndex()));

/** The indexable landing of these facets, if any. */
function findLanding(
  lookup: IndexLookup,
  game: GameRef,
  facets: Facets,
  refs: {
    sets: ReadonlyMap<string, SetRef>;
    categories: ReadonlyMap<string, CategoryRef>;
  },
): IndexedPage | undefined {
  const set = facets.set ? refs.sets.get(facets.set) : undefined;
  const category = facets.category
    ? refs.categories.get(facets.category)
    : undefined;
  if ((facets.set && !set) || (facets.category && !category)) return;
  const scope: LandingScope = {
    game,
    ...(set ? { set } : {}),
    ...(category ? { category } : {}),
    ...(facets.language ? { language: facets.language } : {}),
    ...(facets.status ? { status: facets.status } : {}),
  };
  return isSupportedScope(scope) ? lookup.get(landingPath(scope)) : undefined;
}

// ---------------------------------------------------------------------------
// Anchors

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

/** Family status anchors keep the family first: « Boosters Pokémon en stock ». */
function statusAnchor(
  subject: string,
  status: StatusSlug,
  family?: { category: string; game: string },
): string {
  if (status === 'en-stock') return `${subject} en stock`;
  if (status === 'precommandes')
    return family ? `${subject} en précommande` : `Précommandes ${subject}`;
  return family
    ? `Nouveautés ${inSentence(family.category)} ${family.game}`
    : `Nouveautés ${subject}`;
}

/** « list » inside a titled group, « explicit » when the link stands alone. */
type Tone = 'list' | 'explicit';

interface Names {
  game: string;
  set?: string;
  category?: string;
}

function landingAnchor(facets: Facets, names: Names, tone: Tone): string {
  const { game, set = '', category = '' } = names;
  const language = facets.language ? LANGUAGE_IN_LABELS[facets.language] : '';
  const family = category ? `${category} ${game}` : '';
  if (facets.set && facets.category)
    return tone === 'explicit'
      ? `Les ${inSentence(category)} ${set}`
      : `${category} ${set}`;
  if (facets.set && facets.language) return `${set} ${language}`;
  if (facets.set && facets.status) return statusAnchor(set, facets.status);
  if (facets.set) return tone === 'explicit' ? `Voir l’extension ${set}` : set;
  if (facets.category && facets.language) return `${family} ${language}`;
  if (facets.category && facets.status)
    return statusAnchor(family, facets.status, { category, game });
  if (facets.category) return family;
  if (facets.language) return `Produits ${game} ${language}`;
  if (facets.status) return statusAnchor(game, facets.status);
  return `Tous les produits ${game}`;
}

// ---------------------------------------------------------------------------
// Link context of a game

type SetInfo = SetRef;

function gameContext(
  game: GameRef,
  lookup: IndexLookup,
  sets: readonly SetRef[],
  categories: readonly CategoryRef[],
) {
  const refs = {
    sets: new Map(sets.map((set) => [set.slug, set])),
    categories: new Map(categories.map((c) => [c.slug, c])),
  };
  const find = (facets: Facets) => findLanding(lookup, game, facets, refs);
  /** Zero or one link: the landing is indexable or it is left out. */
  const to = (facets: Facets, tone: Tone = 'list'): SeoLink[] => {
    const page = find(facets);
    if (!page) return [];
    const label = landingAnchor(
      facets,
      {
        game: game.name,
        set: facets.set ? refs.sets.get(facets.set)?.name : undefined,
        category: facets.category
          ? refs.categories.get(facets.category)?.name
          : undefined,
      },
      tone,
    );
    return [{ href: page.path, label, count: page.productCount }];
  };
  return { find, to };
}

function linkGroups(
  groups: readonly { title: string; links: readonly SeoLink[] }[],
  exclude: readonly string[] = [],
): SeoLinkGroup[] {
  const excluded = new Set(exclude);
  return groups.flatMap((group) => {
    const seen = new Set<string>();
    const links = group.links
      .filter((link) => {
        if (excluded.has(link.href) || seen.has(link.href)) return false;
        seen.add(link.href);
        return true;
      })
      .slice(0, MAX_LINKS);
    return links.length ? [{ title: group.title, links }] : [];
  });
}

/** Newer then older indexable neighbour by release date, then the same series. */
function neighbourSets(
  current: string,
  sets: readonly SetInfo[],
  isIndexable: (slug: string) => boolean,
): SetInfo[] {
  const index = sets.findIndex((set) => set.slug === current);
  if (index < 0) return [];
  const series = sets[index]?.series;
  const newer = sets
    .slice(0, index)
    .reverse()
    .find((set) => isIndexable(set.slug));
  const older = sets.slice(index + 1).find((set) => isIndexable(set.slug));
  const sameSeries = series
    ? sets.filter(
        (set) =>
          set.slug !== current &&
          set.series === series &&
          isIndexable(set.slug),
      )
    : [];
  return [newer, older, ...sameSeries]
    .filter((set): set is SetInfo => Boolean(set))
    .filter(
      (set, position, all) =>
        all.findIndex((other) => other.slug === set.slug) === position,
    )
    .slice(0, 6);
}

// ---------------------------------------------------------------------------
// Public API

/** /{game}: sets (newest first), families, languages and statuses. */
export async function getGameHubLinks(game: GameRef): Promise<SeoLinkGroup[]> {
  const [lookup, sets, categories] = await Promise.all([
    getIndexLookup(),
    getGameSets(game.id),
    getCategories(),
  ]);
  const { to } = gameContext(game, lookup, sets, categories);
  return linkGroups([
    {
      title: `Extensions ${game.name}`,
      links: sets.flatMap((set) => to({ set: set.slug })),
    },
    {
      title: `Familles de produits ${game.name}`,
      links: categories.flatMap((c) => to({ category: c.slug })),
    },
    {
      title: `${game.name} par langue`,
      links: FACET_LANGUAGES.flatMap((language) => to({ language })),
    },
    {
      title: `Disponibilité des produits ${game.name}`,
      links: STATUS_SLUGS.flatMap((status) => to({ status })),
    },
  ]);
}

export interface GameHubShortcuts {
  /** Families with an indexable landing, labelled by name alone. */
  formats: SeoLink[];
  /** « Français », « Anglais »… */
  languages: SeoLink[];
  /** Status landings of the game, by status; absent when not indexable. */
  statuses: Partial<Record<StatusSlug, SeoLink>>;
}

/**
 * /{game}: its families, languages and statuses as short shortcuts, under a
 * heading that already names the game. Only indexable landings.
 */
export async function getGameHubShortcuts(
  game: GameRef,
): Promise<GameHubShortcuts> {
  const [lookup, sets, categories] = await Promise.all([
    getIndexLookup(),
    getGameSets(game.id),
    getCategories(),
  ]);
  const { find } = gameContext(game, lookup, sets, categories);
  const link = (page: IndexedPage | undefined, label: string): SeoLink[] =>
    page ? [{ href: page.path, label, count: page.productCount }] : [];
  return {
    formats: categories.flatMap((category) =>
      link(find({ category: category.slug }), category.name),
    ),
    languages: FACET_LANGUAGES.flatMap((language) =>
      link(find({ language }), capitalizeFr(LANGUAGE_LABELS[language])),
    ),
    statuses: Object.fromEntries(
      STATUS_SLUGS.flatMap((status) =>
        link(find({ status }), STATUS_LABELS[status]).map((entry) => [
          status,
          entry,
        ]),
      ),
    ),
  };
}

function capitalizeFr(text: string): string {
  return text.charAt(0).toLocaleUpperCase('fr-FR') + text.slice(1);
}

/** Links of a facet landing: children, neighbours and parents, never itself. */
export async function getLandingLinks(
  scope: LandingScope,
): Promise<SeoLinkGroup[]> {
  const kind = landingKind(scope);
  if (kind === 'game') return getGameHubLinks(scope.game);
  const [lookup, sets, categories] = await Promise.all([
    getIndexLookup(),
    getGameSets(scope.game.id),
    getCategories(),
  ]);
  const { find, to } = gameContext(scope.game, lookup, sets, categories);
  const game = scope.game.name;
  const set = scope.set;
  const category = scope.category;
  const language = scope.language;
  const status = scope.status;
  const otherSets = sets.filter((s) => s.slug !== set?.slug);
  const children = category
    ? categories.filter((c) => c.parentId === category.id)
    : [];
  const self = landingPath(scope);
  const inLanguage = language ? LANGUAGE_IN_LABELS[language] : '';

  if (kind === 'set' && set)
    return linkGroups(
      [
        {
          title: `Familles de l’extension ${set.name}`,
          links: categories.flatMap((c) =>
            to({ set: set.slug, category: c.slug }),
          ),
        },
        {
          title: `${set.name} par langue`,
          links: FACET_LANGUAGES.flatMap((l) =>
            to({ set: set.slug, language: l }),
          ),
        },
        {
          title: `Disponibilité de l’extension ${set.name}`,
          links: STATUS_SLUGS.flatMap((s) => to({ set: set.slug, status: s })),
        },
        {
          title: `Autres extensions ${game}`,
          links: neighbourSets(
            set.slug,
            sets,
            (slug) => find({ set: slug }) !== undefined,
          ).flatMap((s) => to({ set: s.slug }, 'explicit')),
        },
      ],
      [self],
    );
  if (kind === 'category' && category)
    return linkGroups(
      [
        {
          title: `Dans les ${inSentence(category.name)} ${game}`,
          links: children.flatMap((c) => to({ category: c.slug })),
        },
        {
          title: `${category.name} par extension`,
          links: sets.flatMap((s) =>
            to({ set: s.slug, category: category.slug }),
          ),
        },
        {
          title: `${category.name} ${game} par langue`,
          links: FACET_LANGUAGES.flatMap((l) =>
            to({ category: category.slug, language: l }),
          ),
        },
        {
          title: `Disponibilité des ${inSentence(category.name)} ${game}`,
          links: STATUS_SLUGS.flatMap((s) =>
            to({ category: category.slug, status: s }),
          ),
        },
      ],
      [self],
    );
  if (kind === 'language' && language)
    return linkGroups(
      [
        {
          title: `Familles ${inLanguage}`,
          links: categories.flatMap((c) => to({ category: c.slug, language })),
        },
        {
          title: `Extensions ${inLanguage}`,
          links: sets.flatMap((s) => to({ set: s.slug, language })),
        },
        {
          title: `${game} dans d’autres langues`,
          links: FACET_LANGUAGES.flatMap((l) => to({ language: l })),
        },
      ],
      [self],
    );
  if (kind === 'status' && status)
    return linkGroups(
      [
        {
          title: 'Par famille',
          links: categories.flatMap((c) => to({ category: c.slug, status })),
        },
        {
          title: 'Par extension',
          links: sets.flatMap((s) => to({ set: s.slug, status })),
        },
        {
          title: `Disponibilité des produits ${game}`,
          links: STATUS_SLUGS.flatMap((s) => to({ status: s })),
        },
      ],
      [self],
    );
  if (kind === 'set-category' && set && category)
    return linkGroups(
      [
        {
          title: 'Voir aussi',
          links: [
            ...to({ set: set.slug }, 'explicit'),
            ...to({ category: category.slug }),
          ],
        },
        {
          title: `Autres familles de ${set.name}`,
          links: categories.flatMap((c) =>
            to({ set: set.slug, category: c.slug }),
          ),
        },
        {
          title: `${category.name} des autres extensions`,
          links: otherSets.flatMap((s) =>
            to({ set: s.slug, category: category.slug }),
          ),
        },
      ],
      [self],
    );
  if ((kind === 'set-language' || kind === 'set-status') && set)
    return linkGroups(
      [
        {
          title: 'Voir aussi',
          links: [
            ...to({ set: set.slug }, 'explicit'),
            ...(language ? to({ language }) : []),
            ...(status ? to({ status }) : []),
          ],
        },
        {
          title: language
            ? `${set.name} dans d’autres langues`
            : `Disponibilité de l’extension ${set.name}`,
          links: language
            ? FACET_LANGUAGES.flatMap((l) => to({ set: set.slug, language: l }))
            : STATUS_SLUGS.flatMap((s) => to({ set: set.slug, status: s })),
        },
        {
          title: `Familles de l’extension ${set.name}`,
          links: categories.flatMap((c) =>
            to({ set: set.slug, category: c.slug }),
          ),
        },
      ],
      [self],
    );
  if (category)
    return linkGroups(
      [
        {
          title: 'Voir aussi',
          links: [
            ...to({ category: category.slug }),
            ...(language ? to({ language }) : []),
            ...(status ? to({ status }) : []),
          ],
        },
        {
          title: `Dans les ${inSentence(category.name)} ${game}`,
          links: children.flatMap((c) =>
            to({ category: c.slug, language, status }),
          ),
        },
        {
          title: language
            ? `${category.name} ${game} dans d’autres langues`
            : `Disponibilité des ${inSentence(category.name)} ${game}`,
          links: language
            ? FACET_LANGUAGES.flatMap((l) =>
                to({ category: category.slug, language: l }),
              )
            : STATUS_SLUGS.flatMap((s) =>
                to({ category: category.slug, status: s }),
              ),
        },
      ],
      [self],
    );
  return [];
}

/** Structural subset of ProductDetail. */
export interface ProductLinkInput {
  game: Pick<GameRef, 'id' | 'slug' | 'name'> | null;
  tcgSet: { slug: string; name: string } | null;
  categoryInfo: { slug: string; name: string };
  variants?: readonly { language: LanguageCode }[];
}

/**
 * Product page: set, set + family, family of the game (nearest indexable
 * ancestor), languages and game hub; family hubs for a game-less product.
 */
export async function getProductLinks(
  product: ProductLinkInput,
): Promise<SeoLinkGroup[]> {
  const [lookup, categories] = await Promise.all([
    getIndexLookup(),
    getCategories(),
  ]);
  const category = categories.find((c) => c.slug === product.categoryInfo.slug);
  const byId = new Map(categories.map((c) => [c.id, c]));
  const lineage = category
    ? (categoryLineage(categories).get(category.id) ?? [])
        .map((id) => byId.get(id))
        .filter((c): c is CatalogCategory => Boolean(c))
    : [];
  const title = 'Autour de ce produit';
  if (!product.game) {
    const hub = lineage
      .map((c) => ({ c, hub: lookup.get(categoryHubPath(c.slug)) }))
      .find(({ hub }) => hub);
    return linkGroups([
      {
        title,
        links: hub?.hub
          ? [
              {
                href: hub.hub.path,
                label: `${hub.c.name} pour tous les jeux`,
                count: hub.hub.productCount,
              },
            ]
          : [],
      },
    ]);
  }
  const game = product.game;
  const sets = await getGameSets(game.id);
  const { to } = gameContext(game, lookup, sets, categories);
  // The nearest ancestor with an indexable landing, if any.
  const nearest = (facets: Omit<Facets, 'category'>, tone: Tone = 'list') =>
    lineage
      .map((c) => to({ ...facets, category: c.slug }, tone))
      .find((links) => links.length) ?? [];
  const set = product.tcgSet?.slug;
  const languages = [
    ...new Set((product.variants ?? []).map((v) => v.language)),
  ].filter((l): l is FacetLanguage => Object.hasOwn(LANGUAGE_SLUGS, l));
  return linkGroups([
    {
      title,
      links: [
        ...(set ? to({ set }, 'explicit') : []),
        ...(set ? nearest({ set }, 'explicit') : []),
        ...nearest({}),
        ...languages.flatMap((language) => {
          const inFamily = nearest({ language });
          return inFamily.length ? inFamily : to({ language });
        }),
        ...to({}),
      ],
    },
  ]);
}

export interface ContentFacets {
  /** Slugs from the content front-matter. */
  games?: readonly string[];
  categories?: readonly string[];
  sets?: readonly string[];
}

export interface ContentLinks {
  /** Visible products matching every given facet, purchasable ones first. */
  products: CatalogProduct[];
  /** Indexable landings of these facets. */
  landings: SeoLink[];
}

/** Guides and glossary terms: products and landings matching the front-matter. */
export async function getContentLinks(
  facets: ContentFacets,
  { limit = 8 }: { limit?: number } = {},
): Promise<ContentLinks> {
  const wanted = {
    games: new Set(facets.games ?? []),
    categories: new Set(facets.categories ?? []),
    sets: new Set(facets.sets ?? []),
  };
  const [games, categories, lookup, sets] = await Promise.all([
    getGames(),
    getCategories(),
    getIndexLookup(),
    wanted.sets.size
      ? getPrisma().tcgSet.findMany({
          where: { slug: { in: [...wanted.sets] }, isActive: true },
          select: {
            id: true,
            slug: true,
            name: true,
            code: true,
            series: true,
            releaseDate: true,
            gameId: true,
          },
          orderBy: [
            { releaseDate: { sort: 'desc', nulls: 'last' } },
            { name: 'asc' },
          ],
        })
      : Promise.resolve([]),
  ]);
  const gameList = games.filter((game) => wanted.games.has(game.slug));
  const categoryList = categories.filter((c) => wanted.categories.has(c.slug));
  const gamesById = new Map(games.map((game) => [game.id, game]));
  const setList = sets.filter(
    (set) =>
      set.gameId &&
      gamesById.has(set.gameId) &&
      (!gameList.length || gameList.some((game) => game.id === set.gameId)),
  );
  // A facet given but unknown matches nothing: never widen to the whole catalogue.
  const unresolved =
    (wanted.games.size > 0 && !gameList.length) ||
    (wanted.categories.size > 0 && !categoryList.length) ||
    (wanted.sets.size > 0 && !setList.length);
  const conditions: Prisma.ProductWhereInput[] = [];
  if (gameList.length)
    conditions.push({ gameId: { in: gameList.map((game) => game.id) } });
  if (setList.length)
    conditions.push({ tcgSetId: { in: setList.map((set) => set.id) } });
  if (categoryList.length)
    conditions.push({
      categoryId: {
        in: [
          ...new Set(
            categoryList.flatMap((c) => categoryDescendants(categories, c.id)),
          ),
        ],
      },
    });
  const products =
    conditions.length && !unresolved
      ? await listProductsAvailableFirst({ AND: conditions }, limit)
      : [];

  const landings: SeoLink[] = [];
  const push = (
    entry: { path: string; productCount: number } | undefined,
    label: string,
  ) => {
    if (entry && !landings.some((link) => link.href === entry.path))
      landings.push({ href: entry.path, label, count: entry.productCount });
  };
  const refs = {
    sets: new Map(setList.map((set) => [set.slug, set])),
    categories: new Map(categories.map((c) => [c.slug, c])),
  };
  const find = (game: GameRef, facets: Facets) =>
    findLanding(lookup, game, facets, refs);
  for (const set of setList) {
    const game = gamesById.get(set.gameId ?? '');
    if (!game) continue;
    for (const c of categoryList)
      push(
        find(game, { set: set.slug, category: c.slug }),
        `Les ${inSentence(c.name)} ${set.name}`,
      );
    push(find(game, { set: set.slug }), `Voir l’extension ${set.name}`);
  }
  const targetGames = gameList.length
    ? gameList
    : setList.flatMap((set) => {
        const game = gamesById.get(set.gameId ?? '');
        return game ? [game] : [];
      });
  for (const c of categoryList) {
    if (targetGames.length)
      for (const game of targetGames)
        push(find(game, { category: c.slug }), `${c.name} ${game.name}`);
    else if (lookup.has(categoryHubPath(c.slug)))
      push(lookup.get(categoryHubPath(c.slug)), `${c.name} pour tous les jeux`);
    else
      for (const game of games)
        push(find(game, { category: c.slug }), `${c.name} ${game.name}`);
  }
  for (const game of gameList)
    push(find(game, {}), `Tous les produits ${game.name}`);
  return { products, landings };
}

// ---------------------------------------------------------------------------
// Navigation

export interface NavigationFamily {
  slug: string;
  name: string;
  /** Descriptive anchor, e.g. « Boosters Pokémon ». */
  label: string;
  href: string;
  count: number;
  children: NavigationFamily[];
}
export interface NavigationGame {
  slug: string;
  name: string;
  shortName: string | null;
  href: string;
  count: number;
  families: NavigationFamily[];
}
export interface Navigation {
  /** Active games whose hub is indexable, in their menu order. */
  games: NavigationGame[];
  /** Indexable multi-game family hubs (/categorie/{slug}). */
  categoryHubs: NavigationFamily[];
}

function familyTree(
  categories: readonly CatalogCategory[],
  target: (
    category: CatalogCategory,
  ) => { path: string; productCount: number } | undefined,
  label: (category: CatalogCategory) => string,
): NavigationFamily[] {
  const nodes = new Map<string, NavigationFamily>();
  for (const category of categories) {
    const entry = target(category);
    if (entry)
      nodes.set(category.id, {
        slug: category.slug,
        name: category.name,
        label: label(category),
        href: entry.path,
        count: entry.productCount,
        children: [],
      });
  }
  const lineage = categoryLineage(categories);
  const roots: NavigationFamily[] = [];
  for (const category of categories) {
    const node = nodes.get(category.id);
    if (!node) continue;
    // Nearest listed ancestor; a family whose parents are not listed goes up.
    const parentId = (lineage.get(category.id) ?? [])
      .slice(1)
      .find((id) => nodes.has(id));
    const parent = parentId ? nodes.get(parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

/** Pure part of getNavigation, exported for scripts and tests. */
export function buildNavigation(
  index: LandingIndex,
  games: readonly (GameRef & { shortName: string | null })[],
  categories: readonly CatalogCategory[],
): Navigation {
  const lookup = indexLookup(index);
  const refs = {
    sets: new Map<string, SetRef>(),
    categories: new Map(categories.map((c) => [c.slug, c])),
  };
  return {
    games: games.flatMap((game) => {
      const hub = findLanding(lookup, game, {}, refs);
      if (!hub) return [];
      return [
        {
          slug: game.slug,
          name: game.name,
          shortName: game.shortName,
          href: hub.path,
          count: hub.productCount,
          families: familyTree(
            categories,
            (c) => findLanding(lookup, game, { category: c.slug }, refs),
            (c) => `${c.name} ${game.name}`,
          ),
        },
      ];
    }),
    categoryHubs: familyTree(
      categories,
      (c) => lookup.get(categoryHubPath(c.slug)),
      (c) => `${c.name} pour tous les jeux`,
    ),
  };
}

const cachedNavigation = unstable_cache(
  async (): Promise<Navigation> => {
    const [index, games, categories] = await Promise.all([
      getLandingIndex(),
      getGames(),
      getCategories(),
    ]);
    return buildNavigation(index, games, categories);
  },
  ['seo-navigation'],
  { tags: [CATALOG_CACHE_TAG], revalidate: 3600 },
);
/** Header and footer menus: active games and families with indexable pages. */
export const getNavigation = cache((): Promise<Navigation> =>
  cachedNavigation(),
);
