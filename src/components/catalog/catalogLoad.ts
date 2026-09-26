// Listing data shared by every catalogue page: parsing, products, facets,
// canonical query and robots. Neither JSX nor next/navigation here, so the
// database tests import it; loadCatalog (CatalogPage.tsx) adds the redirect.
import 'server-only';
import { cache } from 'react';
import { getCatalogFacets, type CatalogFacets } from '@/lib/catalog/facets';
import {
  getCatalogProducts,
  type CatalogResult,
} from '@/lib/catalog/getCatalogProducts';
import {
  catalogDecision,
  catalogSelfPath,
  catalogStateFromFilters,
  splitTrackingParams,
} from '@/lib/catalog/metadata';
import {
  parseCatalogParams,
  type CatalogFilters,
  type CatalogScope,
  type SearchParams,
} from '@/lib/catalog/params';
import { itemListNode, type JsonLdNode } from '@/lib/seo/jsonld';
import type { IndexDecision } from '@/lib/seo/types';

export interface CatalogLoad {
  /** Listing path, without query. */
  path: string;
  scope: CatalogScope;
  /** Effective filters: unknown slugs removed, page bounded. */
  filters: CatalogFilters;
  result: CatalogResult;
  facets: CatalogFacets;
  /** Canonical query without « ? »; tracking parameters are never part of it. */
  query: string;
  page: number;
  pageCount: number;
  total: number;
  /** Filter, sort, search or price bounds active (the page does not count). */
  hasRefinements: boolean;
}

export interface CatalogLoadInput {
  path: string;
  searchParams: Promise<SearchParams> | SearchParams;
  scope: CatalogScope;
}

// React cache compares arguments by identity: scope and filters are keyed as
// JSON, so generateMetadata and the page share one read per request.
const readFacets = cache((scopeKey: string) =>
  getCatalogFacets(JSON.parse(scopeKey) as CatalogScope),
);
const readProducts = cache((scopeKey: string, filtersKey: string) =>
  getCatalogProducts(
    JSON.parse(filtersKey) as CatalogFilters,
    JSON.parse(scopeKey) as CatalogScope,
  ),
);

/** Facets of a scope, shared with loadCatalog within the request. */
export function getScopeFacets(scope: CatalogScope): Promise<CatalogFacets> {
  return readFacets(JSON.stringify(scope));
}

function sortedQuery(entries: Iterable<[string, string]>): string {
  const params = new URLSearchParams([...entries]);
  params.sort();
  return params.toString();
}

function requestEntries(params: SearchParams): [string, string][] {
  return Object.entries(params).flatMap(([key, value]) =>
    (Array.isArray(value) ? value : value === undefined ? [] : [value]).map(
      (entry): [string, string] => [key, entry],
    ),
  );
}

/**
 * Loads a listing and tells where its canonical URL is when the request
 * differs from it (unknown slugs, invalid values, page out of range…).
 * Tracking parameters are ignored and kept on that redirect.
 */
export async function resolveCatalog({
  path,
  searchParams,
  scope,
}: CatalogLoadInput): Promise<{
  load: CatalogLoad;
  redirectTo: string | null;
}> {
  const { listing, tracking } = splitTrackingParams(await searchParams);
  const requested = parseCatalogParams(listing);
  const scopeKey = JSON.stringify(scope);
  const [result, facets] = await Promise.all([
    readProducts(scopeKey, JSON.stringify(requested)),
    readFacets(scopeKey),
  ]);
  const filters = result.filters;
  const state = catalogStateFromFilters(path, filters);
  const load: CatalogLoad = {
    path,
    scope,
    filters,
    result,
    facets,
    query: state.query,
    page: result.page,
    pageCount: result.pageCount,
    total: result.total,
    hasRefinements: state.hasRefinements,
  };
  const canonical = sortedQuery(new URLSearchParams(state.query));
  if (sortedQuery(requestEntries(listing)) === canonical)
    return { load, redirectTo: null };
  const target = new URLSearchParams(state.query);
  for (const [key, value] of tracking) target.append(key, value);
  const query = target.toString();
  return { load, redirectTo: query ? `${path}?${query}` : path };
}

/** Path of the listing page itself: canonical query, ?page=N included. */
export function catalogLoadPath(load: CatalogLoad): string {
  return catalogSelfPath(load);
}

/**
 * Refinements: noindex with a self canonical, never combined with a canonical
 * to another URL. ?page=N: paginationDecision of `base` (the unrefined first page).
 */
export function catalogRobots(
  load: CatalogLoad,
  base: IndexDecision,
): IndexDecision {
  return catalogDecision(load, base);
}

/** ItemList of the products shown on this page, in display order. */
export function catalogItemListNode(load: CatalogLoad): JsonLdNode | null {
  const { products, page, pageSize } = load.result;
  if (!products.length) return null;
  return itemListNode(
    products.map((product) => ({
      path: `/produit/${encodeURIComponent(product.slug)}`,
      name: product.name,
    })),
    { startPosition: (page - 1) * pageSize + 1 },
  );
}
