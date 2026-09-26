// Listing URL state and robots (docs/seo-architecture.md §4): a listing is
// indexable only without refinement; ?page=N follows its base page. Pure module.
import type { Metadata } from 'next';
import { filteredDecision, paginationDecision } from '@/lib/seo/indexation';
import {
  buildMetadata,
  paginatedText,
  truncateAtWord,
  type MetadataImage,
  type MetadataText,
} from '@/lib/seo/metadata';
import type { IndexDecision } from '@/lib/seo/types';
import {
  activeFilterCount,
  catalogQuery,
  parseCatalogParams,
  type CatalogFilters,
  type SearchParams,
} from './params';

const TRACKING_KEYS: ReadonlySet<string> = new Set([
  'gclid',
  'fbclid',
  'msclkid',
  'dclid',
  'gbraid',
  'wbraid',
  '_gl',
  'mc_cid',
  'mc_eid',
]);

/** Campaign parameters: never read, never redirected, never canonical. */
export function isTrackingParam(key: string): boolean {
  const name = key.toLowerCase();
  return name.startsWith('utm_') || TRACKING_KEYS.has(name);
}

/** Splits the request parameters into listing parameters and tracking ones. */
export function splitTrackingParams(params: SearchParams): {
  listing: SearchParams;
  tracking: [string, string][];
} {
  const listing: SearchParams = {};
  const tracking: [string, string][] = [];
  for (const [key, value] of Object.entries(params)) {
    if (!isTrackingParam(key)) listing[key] = value;
    else
      for (const entry of Array.isArray(value) ? value : [value ?? ''])
        tracking.push([key, entry]);
  }
  return { listing, tracking };
}

/** Filters, sort, search or price bounds: everything but the page. */
export function hasCatalogRefinements(filters: CatalogFilters): boolean {
  return activeFilterCount(filters) > 0 || filters.sort !== 'recommended';
}

/** Effective state of a listing URL, once normalized. */
export interface CatalogUrlState {
  /** Listing path, without query. */
  path: string;
  /** Canonical query without « ? »; tracking parameters are never part of it. */
  query: string;
  page: number;
  hasRefinements: boolean;
}

export function catalogStateFromFilters(
  path: string,
  filters: CatalogFilters,
): CatalogUrlState {
  return {
    path,
    query: catalogQuery(filters),
    page: filters.page,
    hasRefinements: hasCatalogRefinements(filters),
  };
}

/** Parameters only: the page itself redirects when the database disagrees. */
export function catalogStateFromParams(
  path: string,
  params: SearchParams = {},
): CatalogUrlState {
  return catalogStateFromFilters(
    path,
    parseCatalogParams(splitTrackingParams(params).listing),
  );
}

/** Path of the page itself, canonical query included. */
export function catalogSelfPath(
  state: Pick<CatalogUrlState, 'path' | 'query'>,
) {
  return state.query ? `${state.path}?${state.query}` : state.path;
}

const withoutQuery = (path: string) => path.split('?')[0] ?? path;

/**
 * Refined listing: noindex, follow with a self canonical (its own normalized
 * URL), never a canonical to another page. Otherwise ?page=N follows the base
 * decision (paginationDecision). Idempotent on its own output.
 */
export function catalogDecision(
  state: CatalogUrlState,
  base: IndexDecision,
): IndexDecision {
  if (state.hasRefinements) return filteredDecision(catalogSelfPath(state));
  return paginationDecision(
    { ...base, canonicalPath: withoutQuery(base.canonicalPath) },
    state.page,
  );
}

/** paginatedText, applied once even when the caller already did it. */
export function listingPageText(
  text: MetadataText,
  page: number,
): MetadataText {
  if (text.title.endsWith(` – page ${page}`)) return text;
  return paginatedText(text, page);
}

export interface ListingMetadataInput {
  state: CatalogUrlState;
  /** Title and description of page 1, without the brand suffix. */
  title: string;
  description: string;
  /** Decision of the unrefined first page. */
  decision: IndexDecision;
  image?: MetadataImage | null;
}

export function listingMetadata({
  state,
  title,
  description,
  decision,
  image,
}: ListingMetadataInput): Metadata {
  const robots = catalogDecision(state, decision);
  const text = listingPageText(
    { title, description: truncateAtWord(description) },
    state.page,
  );
  return buildMetadata({
    title: text.title,
    description: text.description,
    path: catalogSelfPath(state),
    index: robots.index,
    canonicalPath: robots.canonicalPath,
    image,
  });
}

/**
 * Compatibility wrapper for the routes without scope statistics: the first
 * page is indexable, refinements are not.
 */
export function catalogMetadata(
  title: string,
  description: string,
  path: string,
  params: SearchParams = {},
): Metadata {
  return listingMetadata({
    state: catalogStateFromParams(path, params),
    title,
    description,
    decision: { index: true, reason: 'indexable', canonicalPath: path },
  });
}
