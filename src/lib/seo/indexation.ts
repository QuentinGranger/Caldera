// Indexation rules (docs/seo-architecture.md §4). Pure: the routes compute the
// stats, these functions only decide. A decision is never noindex together with
// a canonical pointing to another URL.
import { indexationParent, landingKind, landingPath } from './facets';
import type { IndexDecision, LandingScope, ScopeStats } from './types';

export type IndexReason =
  | 'indexable'
  /** Page kept (200) but empty: noindex, follow. */
  | 'empty'
  | 'below-threshold'
  /** Same products as the parent: canonical to the parent, not in sitemaps. */
  | 'duplicate-of-parent'
  /** Filter combination without any product: the route answers 404. */
  | 'empty-combination'
  /** /categorie/{slug} holding a single game: canonical to /{game}/{category}. */
  | 'single-game'
  | 'filtered'
  | 'no-active-variant'
  | 'inactive-parent'
  /** ARCHIVED product: the route redirects (308) to its best parent. */
  | 'archived'
  /** DRAFT or unknown product: 404 once SlugRedirect has been checked. */
  | 'not-found';

export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

const ENTITY_MIN = 2;

function decision(
  index: boolean,
  reason: IndexReason,
  canonicalPath: string,
): IndexDecision {
  return { index, reason, canonicalPath };
}

/** True when the route must answer 404 instead of rendering the page. */
export function isNotFoundDecision(value: IndexDecision): boolean {
  return value.reason === 'empty-combination' || value.reason === 'not-found';
}

/** True when the canonical points to another URL than the page itself. */
export function isCrossCanonical(value: IndexDecision, selfPath: string) {
  return value.canonicalPath !== selfPath;
}

export interface LandingIndexationInput {
  scope: LandingScope;
  stats: ScopeStats;
  /** Stats of indexationParent(scope); required for every kind but game/set/category. */
  parentStats?: ScopeStats | null;
  /** Defaults to landingPath(indexationParent(scope)). */
  parentPath?: string;
  /**
   * For a set or category landing without product: true keeps a 200 noindex
   * page (upcoming set, release dates), false turns it into a 404.
   */
  entityExists?: boolean;
}

export function decideLandingIndexation({
  scope,
  stats,
  parentStats,
  parentPath,
  entityExists = true,
}: LandingIndexationInput): IndexDecision {
  const kind = landingKind(scope);
  const path = landingPath(scope);
  const count = stats.productCount;
  if (kind === 'game')
    return count >= 1
      ? decision(true, 'indexable', path)
      : decision(false, 'empty', path);
  if (kind === 'set' || kind === 'category') {
    if (count >= ENTITY_MIN) return decision(true, 'indexable', path);
    if (count > 0) return decision(false, 'below-threshold', path);
    return entityExists
      ? decision(false, 'empty', path)
      : decision(false, 'empty-combination', path);
  }
  if (count === 0) return decision(false, 'empty-combination', path);
  if (count < ENTITY_MIN) return decision(false, 'below-threshold', path);
  if (!parentStats)
    throw new Error(`parentStats is required for a ${kind} landing`);
  if (count >= parentStats.productCount) {
    const parent = indexationParent(scope);
    return decision(
      false,
      'duplicate-of-parent',
      parentPath ?? (parent ? landingPath(parent) : path),
    );
  }
  return decision(true, 'indexable', path);
}

export interface CategoryHubIndexationInput {
  /** /categorie/{slug} */
  path: string;
  stats: ScopeStats;
  distinctGames: number;
  hasGamelessProducts: boolean;
  /** /{game}/{category} of the only game, when distinctGames is 1. */
  singleGamePath?: string | null;
}

export function decideCategoryHubIndexation({
  path,
  stats,
  distinctGames,
  hasGamelessProducts,
  singleGamePath,
}: CategoryHubIndexationInput): IndexDecision {
  const count = stats.productCount;
  if (count === 0) return decision(false, 'empty', path);
  if (count < ENTITY_MIN) return decision(false, 'below-threshold', path);
  if (distinctGames >= 2 || hasGamelessProducts)
    return decision(true, 'indexable', path);
  if (distinctGames === 1 && singleGamePath)
    return decision(false, 'single-game', singleGamePath);
  return decision(false, 'below-threshold', path);
}

export interface ListingIndexationInput {
  path: string;
  stats: ScopeStats;
  /** Minimum product count: 2 by default, 1 for /catalogue. */
  min?: number;
  /** Filters, sort, search or price parameters present in the URL. */
  filtered?: boolean;
}

export function decideListingIndexation({
  path,
  stats,
  min = ENTITY_MIN,
  filtered = false,
}: ListingIndexationInput): IndexDecision {
  if (filtered) return filteredDecision(path);
  return stats.productCount >= min
    ? decision(true, 'indexable', path)
    : decision(false, stats.productCount ? 'below-threshold' : 'empty', path);
}

/**
 * Filtered, sorted, searched or price-bounded URLs: noindex, follow with a
 * self canonical (pass the full path, query included).
 */
export function filteredDecision(pathWithQuery: string): IndexDecision {
  return decision(false, 'filtered', pathWithQuery);
}

export interface ProductIndexationInput {
  status: ProductStatus;
  hasActiveVariant: boolean;
  /** /produit/{slug} */
  path: string;
  /** Category, set and game are all active. */
  parentsActive?: boolean;
}

export function decideProductIndexation({
  status,
  hasActiveVariant,
  path,
  parentsActive = true,
}: ProductIndexationInput): IndexDecision {
  if (status === 'DRAFT') return decision(false, 'not-found', path);
  if (status === 'ARCHIVED') return decision(false, 'archived', path);
  if (!parentsActive) return decision(false, 'inactive-parent', path);
  if (!hasActiveVariant) return decision(false, 'no-active-variant', path);
  return decision(true, 'indexable', path);
}

function withPage(path: string, page: number) {
  return `${path}${path.includes('?') ? '&' : '?'}page=${page}`;
}

/**
 * ?page=N (N ≥ 2): self canonical when the base page is indexable, noindex with
 * a self canonical otherwise. A base that duplicates its parent keeps pointing
 * to the parent's page N, which lists the same products.
 */
export function paginationDecision(
  base: IndexDecision,
  page: number,
): IndexDecision {
  if (!Number.isSafeInteger(page) || page < 2) return base;
  return {
    index: base.index,
    reason: base.reason,
    canonicalPath: withPage(base.canonicalPath, page),
  };
}
