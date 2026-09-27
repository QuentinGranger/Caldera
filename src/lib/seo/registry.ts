// Catalog registry (docs/seo-architecture.md §4 and §8): real aggregates of a
// scope and the list of indexable landings. The SQL facts below apply the same
// visibility rules as visibleProductWhere (src/lib/catalog/queries.ts).
import 'server-only';
import { unstable_cache } from 'next/cache';
import { cache } from 'react';
import { Prisma } from '@/generated/prisma/client';
import { visibleProductWhere } from '@/lib/catalog/queries';
import {
  getCategories,
  getGameSets,
  getGames,
  toCategoryRef,
  toGameRef,
  toSetRef,
} from '@/lib/catalog/taxonomy';
import { getPrisma } from '@/lib/db/prisma';
import {
  LANGUAGE_SLUGS,
  STATUS_SLUGS,
  indexationParent,
  isReservedRootSlug,
  landingKind,
  landingPath,
  parseLandingSegments,
  type FacetLanguage,
} from './facets';
import {
  decideCategoryHubIndexation,
  decideLandingIndexation,
} from './indexation';
import type {
  CategoryRef,
  GameRef,
  LandingKind,
  LandingScope,
  LanguageCode,
  ScopeStats,
  SetRef,
  StatusSlug,
} from './types';

/** Cache tag of every catalog aggregate: revalidateTag('catalog', 'max') after a write. */
export const CATALOG_CACHE_TAG = 'catalog';
const REVALIDATE_SECONDS = 3600;
// Stock and price aggregates shown in page text: never older than 5 minutes,
// and invalidated at once by admin writes and confirmed payments.
const AGGREGATE_REVALIDATE_SECONDS = 300;

/**
 * unstable_cache shared across requests, falling back to a direct call where
 * Next provides no cache store (scripts, DB tests).
 */
export function sharedCache<Args extends string[], Result>(
  fn: (...args: Args) => Promise<Result>,
  keyParts: string[],
  revalidate: number,
) {
  const cached = unstable_cache(fn, keyParts, {
    tags: [CATALOG_CACHE_TAG],
    revalidate,
  });
  return async (...args: Args): Promise<Result> => {
    try {
      return await cached(...args);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith('Invariant: incrementalCache missing')
      )
        return fn(...args);
      throw error;
    }
  };
}

// ---------------------------------------------------------------------------
// Category tree (pure)

export interface CategoryNode {
  id: string;
  parentId: string | null;
}

/** For each category: itself then its ancestors present in the list (cycle-safe). */
export function categoryLineage(
  categories: readonly CategoryNode[],
): Map<string, string[]> {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const lineage = new Map<string, string[]>();
  for (const category of categories) {
    const chain = [category.id];
    const visited = new Set(chain);
    let parentId = category.parentId;
    while (parentId && !visited.has(parentId)) {
      const parent = byId.get(parentId);
      if (!parent) break;
      visited.add(parentId);
      chain.push(parentId);
      parentId = parent.parentId;
    }
    lineage.set(category.id, chain);
  }
  return lineage;
}

/** Counts per category where a product counts for its category and every ancestor. */
export function aggregateOverTree(
  counts: Iterable<readonly [string, number]>,
  categories: readonly CategoryNode[],
): Map<string, number> {
  const lineage = categoryLineage(categories);
  const totals = new Map<string, number>();
  for (const [id, count] of counts)
    for (const ancestor of lineage.get(id) ?? [])
      totals.set(ancestor, (totals.get(ancestor) ?? 0) + count);
  return totals;
}

/** The category and all its descendants, in the order of `categories`. */
export function categoryDescendants(
  categories: readonly CategoryNode[],
  rootId: string,
): string[] {
  const lineage = categoryLineage(categories);
  return categories
    .filter((category) => lineage.get(category.id)?.includes(rootId))
    .map((category) => category.id);
}

// ---------------------------------------------------------------------------
// Scope

/** A landing scope, or a cross-game one (category hub, transverse listing). */
export interface RegistryScope {
  game?: Pick<GameRef, 'id'> | null;
  set?: Pick<SetRef, 'id'> | null;
  /** Includes the category's descendants. */
  category?: Pick<CategoryRef, 'id'> | null;
  language?: LanguageCode;
  status?: StatusSlug;
}

/**
 * Visible products of a scope. `categories` is the active tree (getCategories);
 * getScopeWhere loads it.
 */
export function scopeWhere(
  scope: RegistryScope,
  categories: readonly CategoryNode[],
): Prisma.ProductWhereInput {
  const variant: Prisma.ProductVariantWhereInput = {
    isActive: true,
    ...(scope.language ? { language: scope.language } : {}),
  };
  const conditions: Prisma.ProductWhereInput[] = [
    visibleProductWhere,
    { variants: { some: variant } },
  ];
  if (scope.game) conditions.push({ gameId: scope.game.id });
  if (scope.set) conditions.push({ tcgSetId: scope.set.id });
  if (scope.category)
    conditions.push({
      categoryId: { in: categoryDescendants(categories, scope.category.id) },
    });
  if (scope.status === 'en-stock')
    conditions.push({
      preorder: false,
      variants: { some: { ...variant, availableQuantity: { gt: 0 } } },
    });
  else if (scope.status === 'precommandes') conditions.push({ preorder: true });
  else if (scope.status === 'nouveautes') conditions.push({ newArrival: true });
  return { AND: conditions };
}

export async function getScopeWhere(
  scope: RegistryScope,
): Promise<Prisma.ProductWhereInput> {
  return scopeWhere(scope, await getCategories());
}

// ---------------------------------------------------------------------------
// SQL facts: one row per visible product of the scope

interface FactFilter {
  gameId?: string;
  setId?: string;
  categoryIds?: string[];
  language?: LanguageCode;
  status?: StatusSlug;
}

function factFilter(
  scope: RegistryScope,
  categories: readonly CategoryNode[],
): FactFilter {
  return {
    ...(scope.game ? { gameId: scope.game.id } : {}),
    ...(scope.set ? { setId: scope.set.id } : {}),
    ...(scope.category
      ? { categoryIds: categoryDescendants(categories, scope.category.id) }
      : {}),
    ...(scope.language ? { language: scope.language } : {}),
    ...(scope.status ? { status: scope.status } : {}),
  };
}

/**
 * Visible products (ACTIVE, active category/set/game, at least one active
 * variant in the scope language) with their facts. In stock = not a preorder
 * and an active variant with availableQuantity > 0, as shown on the site.
 * `modified` covers every variant, inactive ones included.
 */
function productFactsSql(filter: FactFilter): Prisma.Sql {
  const base = filter.language
    ? Prisma.sql`(v."isActive" AND v."language" = ${filter.language}::"ProductLanguage")`
    : Prisma.sql`v."isActive"`;
  // The in-stock listing only shows and prices variants that are in stock.
  const active =
    filter.status === 'en-stock'
      ? Prisma.sql`(${base} AND v."availableQuantity" > 0)`
      : base;
  const conditions = [
    Prisma.sql`p."status" = 'ACTIVE'`,
    Prisma.sql`c."isActive"`,
    Prisma.sql`(p."tcgSetId" IS NULL OR s."isActive")`,
    Prisma.sql`(p."gameId" IS NULL OR g."isActive")`,
  ];
  if (filter.gameId)
    conditions.push(Prisma.sql`p."gameId" = ${filter.gameId}::uuid`);
  if (filter.setId)
    conditions.push(Prisma.sql`p."tcgSetId" = ${filter.setId}::uuid`);
  if (filter.categoryIds)
    conditions.push(
      Prisma.sql`p."categoryId" = ANY(${filter.categoryIds}::uuid[])`,
    );
  if (filter.status === 'precommandes')
    conditions.push(Prisma.sql`p."preorder"`);
  if (filter.status === 'nouveautes')
    conditions.push(Prisma.sql`p."newArrival"`);
  const inStock = Prisma.sql`(NOT p."preorder" AND BOOL_OR(${active} AND v."availableQuantity" > 0))`;
  return Prisma.sql`
    SELECT p."id", p."gameId", g."slug" AS "gameSlug", p."tcgSetId",
      p."categoryId", p."preorder", p."newArrival",
      ${inStock} AS "inStock",
      (p."preorder" AND BOOL_OR(${active} AND v."availableQuantity" > 0)) AS "preorderOpen",
      MIN(v."price") FILTER (WHERE ${active}) AS "minPrice",
      MAX(v."price") FILTER (WHERE ${active}) AS "maxPrice",
      ARRAY_AGG(DISTINCT v."language"::text) FILTER (WHERE ${active}) AS "languages",
      GREATEST(p."updatedAt", MAX(v."updatedAt")) AS "modified"
    FROM "Product" p
    JOIN "Category" c ON c."id" = p."categoryId"
    LEFT JOIN "TcgSet" s ON s."id" = p."tcgSetId"
    LEFT JOIN "Game" g ON g."id" = p."gameId"
    JOIN "ProductVariant" v ON v."productId" = p."id"
    WHERE ${Prisma.join(conditions, ' AND ')}
    GROUP BY p."id", g."id"
    HAVING BOOL_OR(${active})${
      filter.status === 'en-stock' ? Prisma.sql` AND ${inStock}` : Prisma.empty
    }`;
}

const LANGUAGE_ORDER: readonly LanguageCode[] = [
  'FR',
  'EN',
  'JP',
  'DE',
  'ES',
  'IT',
  'OTHER',
];
function sortLanguages(values: Iterable<string>): LanguageCode[] {
  const present = new Set(values);
  return LANGUAGE_ORDER.filter((language) => present.has(language));
}
function isFacetLanguage(value: string): value is FacetLanguage {
  return Object.hasOwn(LANGUAGE_SLUGS, value);
}

type DecimalValue = { toFixed(digits: number): string } | number | string;
function priceString(value: DecimalValue | null): string | null {
  if (value === null) return null;
  if (typeof value === 'string') return Number(value).toFixed(2);
  return value.toFixed(2);
}

// ---------------------------------------------------------------------------
// Scope aggregates

interface AggregateRow {
  productCount: number;
  inStockCount: number;
  preorderCount: number;
  newArrivalCount: number;
  minPrice: DecimalValue | null;
  maxPrice: DecimalValue | null;
  lastModified: Date | null;
  distinctGames: number;
  hasGameless: boolean;
  gameSlugs: string[];
  languages: string[];
}

// Cached as JSON: decimals as strings, the date as epoch milliseconds.
const cachedAggregate = sharedCache(
  async (key: string) => {
    const row = await queryAggregate(key);
    return {
      ...row,
      minPrice: priceString(row.minPrice),
      maxPrice: priceString(row.maxPrice),
      lastModified: row.lastModified ? row.lastModified.getTime() : null,
    };
  },
  ['scope-aggregate'],
  AGGREGATE_REVALIDATE_SECONDS,
);

// React cache compares arguments by identity: the filter is keyed as JSON.
const aggregateByKey = cache(async (key: string): Promise<AggregateRow> => {
  const row = await cachedAggregate(key);
  return {
    ...row,
    lastModified: row.lastModified === null ? null : new Date(row.lastModified),
  };
});

async function queryAggregate(key: string) {
  const filter = JSON.parse(key) as FactFilter;
  const [row] = await getPrisma().$queryRaw<AggregateRow[]>`
    WITH facts AS (${productFactsSql(filter)})
    SELECT COUNT(*)::int AS "productCount",
      (COUNT(*) FILTER (WHERE "inStock"))::int AS "inStockCount",
      -- Only preorders that can still be ordered are announced as such.
      (COUNT(*) FILTER (WHERE "preorderOpen"))::int AS "preorderCount",
      (COUNT(*) FILTER (WHERE "newArrival"))::int AS "newArrivalCount",
      MIN("minPrice") AS "minPrice",
      MAX("maxPrice") AS "maxPrice",
      MAX("modified") AS "lastModified",
      COUNT(DISTINCT "gameId")::int AS "distinctGames",
      COALESCE(BOOL_OR("gameId" IS NULL), false) AS "hasGameless",
      COALESCE(ARRAY_AGG(DISTINCT "gameSlug") FILTER (WHERE "gameSlug" IS NOT NULL), '{}') AS "gameSlugs",
      COALESCE((SELECT ARRAY_AGG(DISTINCT l) FROM facts, UNNEST(facts."languages") l), '{}') AS "languages"
    FROM facts`;
  if (!row) throw new Error('Scope aggregate returned no row');
  return row;
}

async function aggregateScope(
  scope: RegistryScope,
  categories?: readonly CategoryNode[],
): Promise<AggregateRow> {
  const tree = categories ?? (scope.category ? await getCategories() : []);
  return aggregateByKey(JSON.stringify(factFilter(scope, tree)));
}

function toScopeStats(row: AggregateRow): ScopeStats {
  return {
    productCount: row.productCount,
    inStockCount: row.inStockCount,
    preorderCount: row.preorderCount,
    newArrivalCount: row.newArrivalCount,
    minPrice: priceString(row.minPrice),
    maxPrice: priceString(row.maxPrice),
    languages: sortLanguages(row.languages),
    lastModified: row.lastModified,
  };
}

/** Real aggregates of the visible products of a scope. */
export async function getScopeStats(scope: RegistryScope): Promise<ScopeStats> {
  return toScopeStats(await aggregateScope(scope));
}

export interface CategoryHubStats {
  stats: ScopeStats;
  distinctGames: number;
  hasGamelessProducts: boolean;
  /** Slug of the only game, when distinctGames is 1. */
  singleGameSlug: string | null;
}

/** /categorie/{slug}: null when the category is unknown or hidden. */
export async function getCategoryHubStats(
  categorySlug: string,
): Promise<CategoryHubStats | null> {
  const categories = await getCategories();
  const category = categories.find((c) => c.slug === categorySlug);
  if (!category) return null;
  const row = await aggregateScope({ category }, categories);
  return {
    stats: toScopeStats(row),
    distinctGames: row.distinctGames,
    hasGamelessProducts: row.hasGameless,
    singleGameSlug: row.distinctGames === 1 ? (row.gameSlugs[0] ?? null) : null,
  };
}

// ---------------------------------------------------------------------------
// Scope breakdown

export interface BreakdownSet {
  id: string;
  slug: string;
  name: string;
  code: string | null;
  series: string | null;
  releaseDate: Date | null;
  gameId: string | null;
  count: number;
}
export interface BreakdownCategory extends CategoryRef {
  /** Products of the category and of its descendants. */
  count: number;
}
export interface ScopeBreakdown {
  productCount: number;
  /** Newest release first. */
  sets: BreakdownSet[];
  /** Taxonomy order, ancestors of the scope category included; count > 0. */
  categories: BreakdownCategory[];
  /** A product counts once per language of its active variants. */
  languages: { language: LanguageCode; count: number }[];
  statuses: { status: StatusSlug; count: number }[];
}

interface BreakdownRow {
  dimension: 'total' | 'set' | 'category' | 'language' | 'status';
  key: string;
  count: number;
}

/** Pure part of getScopeBreakdown, exported for tests. */
export function breakdownFromRows(
  rows: readonly BreakdownRow[],
  categories: readonly CategoryRef[],
  sets: readonly Omit<BreakdownSet, 'count'>[],
): ScopeBreakdown {
  const of = (dimension: BreakdownRow['dimension']) =>
    rows.filter((row) => row.dimension === dimension);
  const setCounts = new Map(of('set').map((row) => [row.key, row.count]));
  const treeCounts = aggregateOverTree(
    of('category').map((row) => [row.key, row.count] as const),
    categories,
  );
  const languageCounts = new Map(
    of('language').map((row) => [row.key, row.count]),
  );
  const statusCounts = new Map(of('status').map((row) => [row.key, row.count]));
  const byRelease = (a: Omit<BreakdownSet, 'count'>, b: typeof a) =>
    (b.releaseDate?.getTime() ?? -Infinity) -
      (a.releaseDate?.getTime() ?? -Infinity) ||
    a.name.localeCompare(b.name, 'fr') ||
    a.id.localeCompare(b.id);
  return {
    productCount: of('total')[0]?.count ?? 0,
    sets: sets
      .filter((set) => (setCounts.get(set.id) ?? 0) > 0)
      .sort(byRelease)
      .map((set) => ({ ...set, count: setCounts.get(set.id) ?? 0 })),
    categories: categories
      .filter((category) => (treeCounts.get(category.id) ?? 0) > 0)
      .map((category) => ({
        ...toCategoryRef(category),
        count: treeCounts.get(category.id) ?? 0,
      })),
    languages: sortLanguages(languageCounts.keys()).map((language) => ({
      language,
      count: languageCounts.get(language) ?? 0,
    })),
    statuses: STATUS_SLUGS.map((status) => ({
      status,
      count: statusCounts.get(status) ?? 0,
    })),
  };
}

const breakdownByKey = cache((key: string) => cachedBreakdown(key));

const cachedBreakdown = sharedCache(
  (key: string) => queryBreakdown(key),
  ['scope-breakdown'],
  AGGREGATE_REVALIDATE_SECONDS,
);

function queryBreakdown(key: string) {
  const filter = JSON.parse(key) as FactFilter;
  return getPrisma().$queryRaw<BreakdownRow[]>`
    WITH facts AS (${productFactsSql(filter)})
    SELECT 'total' AS "dimension", '' AS "key", COUNT(*)::int AS "count" FROM facts
    UNION ALL
    SELECT 'set', "tcgSetId"::text, COUNT(*)::int FROM facts
      WHERE "tcgSetId" IS NOT NULL GROUP BY "tcgSetId"
    UNION ALL
    SELECT 'category', "categoryId"::text, COUNT(*)::int FROM facts
      GROUP BY "categoryId"
    UNION ALL
    SELECT 'language', l, COUNT(*)::int FROM facts, UNNEST(facts."languages") l
      GROUP BY l
    UNION ALL
    SELECT 'status', 'en-stock', COUNT(*)::int FROM facts WHERE "inStock"
    UNION ALL
    SELECT 'status', 'precommandes', COUNT(*)::int FROM facts WHERE "preorder"
    UNION ALL
    SELECT 'status', 'nouveautes', COUNT(*)::int FROM facts WHERE "newArrival"`;
}

/** Product counts of a scope by set, category (whole tree), language and status. */
export async function getScopeBreakdown(
  scope: RegistryScope,
): Promise<ScopeBreakdown> {
  const categories = await getCategories();
  const rows = await breakdownByKey(
    JSON.stringify(factFilter(scope, categories)),
  );
  const setIds = rows
    .filter((row) => row.dimension === 'set')
    .map((row) => row.key);
  const sets = setIds.length
    ? await getPrisma().tcgSet.findMany({
        where: { id: { in: setIds } },
        select: {
          id: true,
          slug: true,
          name: true,
          code: true,
          series: true,
          releaseDate: true,
          gameId: true,
        },
      })
    : [];
  return breakdownFromRows(rows, categories, sets);
}

// ---------------------------------------------------------------------------
// Landing index (sitemaps, internal links, navigation)

/** Visible products sharing the same facets, from one grouped query. */
export interface FactGroup {
  gameId: string | null;
  tcgSetId: string | null;
  categoryId: string;
  preorder: boolean;
  newArrival: boolean;
  inStock: boolean;
  languages: string[];
  count: number;
  lastModified: Date | null;
}

/** Status facets a group belongs to. */
export function groupStatuses(
  group: Pick<FactGroup, 'inStock' | 'preorder' | 'newArrival'>,
): StatusSlug[] {
  return STATUS_SLUGS.filter((status) =>
    status === 'en-stock'
      ? group.inStock
      : status === 'precommandes'
        ? group.preorder
        : group.newArrival,
  );
}

interface FacetKey {
  set?: string;
  category?: string;
  language?: FacetLanguage;
  status?: StatusSlug;
}
function facetKey({ set, category, language, status }: FacetKey): string {
  return [set ?? '', category ?? '', language ?? '', status ?? ''].join('|');
}

/** Counts of every allowed facet combination of a game (see facets.ts). */
export interface LandingCounter {
  facets: FacetKey;
  productCount: number;
  inStockCount: number;
  preorderCount: number;
  newArrivalCount: number;
  languages: Set<LanguageCode>;
  lastModified: Date | null;
}

export function countGameLandings(
  groups: readonly FactGroup[],
  input: {
    gameId: string;
    /** Active sets of the game. */
    setIds: ReadonlySet<string>;
    /** categoryLineage of the active categories. */
    lineage: ReadonlyMap<string, readonly string[]>;
  },
): Map<string, LandingCounter> {
  const counters = new Map<string, LandingCounter>();
  const add = (facets: FacetKey, group: FactGroup) => {
    const key = facetKey(facets);
    let counter = counters.get(key);
    if (!counter) {
      counter = {
        facets,
        productCount: 0,
        inStockCount: 0,
        preorderCount: 0,
        newArrivalCount: 0,
        languages: new Set(),
        lastModified: null,
      };
      counters.set(key, counter);
    }
    counter.productCount += group.count;
    if (group.inStock) counter.inStockCount += group.count;
    if (group.preorder) counter.preorderCount += group.count;
    if (group.newArrival) counter.newArrivalCount += group.count;
    const languages = facets.language ? [facets.language] : group.languages;
    for (const language of sortLanguages(languages))
      counter.languages.add(language);
    if (
      group.lastModified &&
      (!counter.lastModified || group.lastModified > counter.lastModified)
    )
      counter.lastModified = group.lastModified;
  };
  for (const group of groups) {
    if (group.gameId !== input.gameId) continue;
    const set =
      group.tcgSetId && input.setIds.has(group.tcgSetId)
        ? group.tcgSetId
        : undefined;
    const categories = input.lineage.get(group.categoryId) ?? [];
    const languages = group.languages.filter(isFacetLanguage);
    const statuses = groupStatuses(group);
    add({}, group);
    if (set) add({ set }, group);
    for (const category of categories) add({ category }, group);
    for (const language of languages) add({ language }, group);
    for (const status of statuses) add({ status }, group);
    if (set) {
      for (const category of categories) add({ set, category }, group);
      for (const language of languages) add({ set, language }, group);
      for (const status of statuses) add({ set, status }, group);
    }
    for (const category of categories) {
      for (const language of languages) add({ category, language }, group);
      for (const status of statuses) add({ category, status }, group);
    }
  }
  return counters;
}

function counterStats(counter: LandingCounter | undefined): ScopeStats {
  // Prices are not aggregated here: the indexation rules only read counts.
  return {
    productCount: counter?.productCount ?? 0,
    inStockCount: counter?.inStockCount ?? 0,
    preorderCount: counter?.preorderCount ?? 0,
    newArrivalCount: counter?.newArrivalCount ?? 0,
    minPrice: null,
    maxPrice: null,
    languages: sortLanguages(counter?.languages ?? []),
    lastModified: counter?.lastModified ?? null,
  };
}

/** An indexable page of the index. */
export interface IndexedPage {
  path: string;
  productCount: number;
  /** Latest product or variant change; never the current date. */
  lastModified: Date | null;
}
export interface IndexedLanding extends IndexedPage {
  kind: LandingKind;
}

const KIND_ORDER: readonly LandingKind[] = [
  'game',
  'set',
  'category',
  'language',
  'status',
  'set-category',
  'set-language',
  'set-status',
  'category-language',
  'category-status',
];

/** Indexable landings of one game, each checked to resolve back to itself. */
export function indexGameLandings(input: {
  game: GameRef;
  groups: readonly FactGroup[];
  /** Active sets of the game. */
  sets: readonly SetRef[];
  /** Active categories (whole ancestor chain active). */
  categories: readonly CategoryRef[];
}): IndexedLanding[] {
  const { game } = input;
  if (isReservedRootSlug(game.slug)) return [];
  const setsById = new Map(input.sets.map((set) => [set.id, set]));
  const categoriesById = new Map(input.categories.map((c) => [c.id, c]));
  const lookup = {
    sets: new Map(input.sets.map((set) => [set.slug, set])),
    categories: new Map(input.categories.map((c) => [c.slug, c])),
  };
  const counters = countGameLandings(input.groups, {
    gameId: game.id,
    setIds: new Set(setsById.keys()),
    lineage: categoryLineage(input.categories),
  });
  const entries: IndexedLanding[] = [];
  for (const counter of counters.values()) {
    const { facets } = counter;
    const set = facets.set ? setsById.get(facets.set) : undefined;
    const category = facets.category
      ? categoriesById.get(facets.category)
      : undefined;
    const scope: LandingScope = {
      game,
      ...(set ? { set } : {}),
      ...(category ? { category } : {}),
      ...(facets.language ? { language: facets.language } : {}),
      ...(facets.status ? { status: facets.status } : {}),
    };
    const kind = landingKind(scope);
    const path = landingPath(scope);
    const parent = indexationParent(scope);
    const parentCounter = parent
      ? counters.get(
          facetKey({
            set: parent.set?.id,
            category: parent.category?.id,
            language: parent.language,
            status: parent.status,
          }),
        )
      : undefined;
    const decision = decideLandingIndexation({
      scope,
      stats: counterStats(counter),
      parentStats: parent ? counterStats(parentCounter) : null,
    });
    if (!decision.index) continue;
    // A slug shared by two dimensions would resolve to another landing.
    if (kind !== 'game') {
      const parsed = parseLandingSegments(path.split('/').slice(2), lookup);
      if (
        parsed.type !== 'ok' ||
        parsed.scope.set?.id !== set?.id ||
        parsed.scope.category?.id !== category?.id ||
        parsed.scope.language !== facets.language ||
        parsed.scope.status !== facets.status
      )
        continue;
    }
    entries.push({
      path,
      kind,
      productCount: counter.productCount,
      lastModified: counter.lastModified,
    });
  }
  return entries.sort(
    (a, b) =>
      KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
      a.path.localeCompare(b.path),
  );
}

export function categoryHubPath(slug: string): string {
  return `/categorie/${encodeURIComponent(slug)}`;
}

/** Visible products of one game (or game-less) in one category. */
export type CategoryGroup = Pick<
  FactGroup,
  'gameId' | 'categoryId' | 'count' | 'lastModified'
>;

/** Indexable /categorie/{slug} hubs (several games or game-less products). */
export function indexCategoryHubs(input: {
  groups: readonly CategoryGroup[];
  categories: readonly CategoryRef[];
  games: readonly GameRef[];
}): IndexedPage[] {
  const lineage = categoryLineage(input.categories);
  const gamesById = new Map(input.games.map((game) => [game.id, game]));
  const hubs = new Map<
    string,
    {
      count: number;
      lastModified: Date | null;
      games: Set<string>;
      gameless: boolean;
    }
  >();
  for (const group of input.groups) {
    for (const id of lineage.get(group.categoryId) ?? []) {
      const hub = hubs.get(id) ?? {
        count: 0,
        lastModified: null,
        games: new Set<string>(),
        gameless: false,
      };
      hub.count += group.count;
      if (group.gameId) hub.games.add(group.gameId);
      else hub.gameless = true;
      if (
        group.lastModified &&
        (!hub.lastModified || group.lastModified > hub.lastModified)
      )
        hub.lastModified = group.lastModified;
      hubs.set(id, hub);
    }
  }
  return input.categories.flatMap((category) => {
    const hub = hubs.get(category.id);
    if (!hub) return [];
    const path = categoryHubPath(category.slug);
    const [onlyGame] = hub.games;
    const single = hub.games.size === 1 && onlyGame && gamesById.get(onlyGame);
    const decision = decideCategoryHubIndexation({
      path,
      stats: {
        ...counterStats(undefined),
        productCount: hub.count,
        lastModified: hub.lastModified,
      },
      distinctGames: hub.games.size,
      hasGamelessProducts: hub.gameless,
      singleGamePath: single ? landingPath({ game: single, category }) : null,
    });
    return decision.index && decision.canonicalPath === path
      ? [{ path, productCount: hub.count, lastModified: hub.lastModified }]
      : [];
  });
}

/** Uncached: indexable landings of one active game (scripts, cache fill). */
export async function loadGameLandings(
  gameId: string,
): Promise<IndexedLanding[]> {
  const [games, categories, sets, groups] = await Promise.all([
    getGames(),
    getCategories(),
    getGameSets(gameId),
    getPrisma().$queryRaw<FactGroup[]>`
      WITH facts AS (${productFactsSql({ gameId })})
      SELECT "gameId"::text AS "gameId", "tcgSetId"::text AS "tcgSetId",
        "categoryId"::text AS "categoryId", "preorder", "newArrival",
        "inStock", "languages", COUNT(*)::int AS "count",
        MAX("modified") AS "lastModified"
      FROM facts
      GROUP BY "gameId", "tcgSetId", "categoryId", "preorder", "newArrival",
        "inStock", "languages"`,
  ]);
  const game = games.find((candidate) => candidate.id === gameId);
  if (!game) return [];
  return indexGameLandings({
    game: toGameRef(game),
    groups,
    sets: sets.map(toSetRef),
    categories: categories.map(toCategoryRef),
  });
}

/** Uncached: indexable /categorie/{slug} hubs. */
export async function loadCategoryHubs(): Promise<IndexedPage[]> {
  const [games, categories, groups] = await Promise.all([
    getGames(),
    getCategories(),
    getPrisma().$queryRaw<CategoryGroup[]>`
      WITH facts AS (${productFactsSql({})})
      SELECT "gameId"::text AS "gameId", "categoryId"::text AS "categoryId",
        COUNT(*)::int AS "count", MAX("modified") AS "lastModified"
      FROM facts
      GROUP BY "gameId", "categoryId"`,
  ]);
  return indexCategoryHubs({
    groups,
    categories: categories.map(toCategoryRef),
    games: games.map(toGameRef),
  });
}

export interface LandingIndex {
  /** Game hubs and facet landings, game by game. */
  landings: IndexedPage[];
  categoryHubs: IndexedPage[];
}

/** Uncached equivalent of getLandingIndex (scripts). */
export async function loadLandingIndex(): Promise<LandingIndex> {
  const games = await getGames();
  const [landings, categoryHubs] = await Promise.all([
    Promise.all(games.map((game) => loadGameLandings(game.id))),
    loadCategoryHubs(),
  ]);
  return { landings: landings.flat(), categoryHubs };
}

// unstable_cache stores JSON (2 MB per entry): compact tuples, one entry per
// game, dates as epoch milliseconds.
type CachedPage = [
  path: string,
  productCount: number,
  lastModified: number | null,
];
const pack = (pages: readonly IndexedPage[]): CachedPage[] =>
  pages.map((page) => [
    page.path,
    page.productCount,
    page.lastModified?.getTime() ?? null,
  ]);
const unpack = (rows: readonly CachedPage[]): IndexedPage[] =>
  rows.map(([path, productCount, time]) => ({
    path,
    productCount,
    lastModified: time === null ? null : new Date(time),
  }));
const cacheOptions = {
  tags: [CATALOG_CACHE_TAG],
  revalidate: REVALIDATE_SECONDS,
};
const cachedGameLandings = unstable_cache(
  async (gameId: string) => pack(await loadGameLandings(gameId)),
  ['seo-game-landings'],
  cacheOptions,
);
const cachedCategoryHubs = unstable_cache(
  async () => pack(await loadCategoryHubs()),
  ['seo-category-hubs'],
  cacheOptions,
);

/** Every indexable landing and hub: cached (tag "catalog", 1 h), once per request. */
export const getLandingIndex = cache(async (): Promise<LandingIndex> => {
  const games = await getGames();
  const [landings, categoryHubs] = await Promise.all([
    Promise.all(games.map((game) => cachedGameLandings(game.id))),
    cachedCategoryHubs(),
  ]);
  return {
    landings: landings.flatMap(unpack),
    categoryHubs: unpack(categoryHubs),
  };
});

export interface SitemapEntry {
  path: string;
  /** Latest product or variant change; never the current date. */
  lastModified: Date | null;
}
const toSitemapEntry = ({ path, lastModified }: IndexedPage): SitemapEntry => ({
  path,
  lastModified,
});

/** Game hubs and facet landings to list in the sitemap (indexable only). */
export async function listIndexableLandings(): Promise<SitemapEntry[]> {
  return (await getLandingIndex()).landings.map(toSitemapEntry);
}

/** Indexable /categorie/{slug} hubs, for the sitemap. */
export async function listIndexableCategoryHubs(): Promise<SitemapEntry[]> {
  return (await getLandingIndex()).categoryHubs.map(toSitemapEntry);
}
