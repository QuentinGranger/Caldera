// Shared (cross-visitor) cache of public catalog data. Only catalog facts go
// here — never a cart, an order or anything tied to a visitor. Every write that
// changes a price, a stock or a reservation calls invalidateCatalogCache(), and
// checkout re-reads prices and stock from the database in any case.
import 'server-only';
import { revalidateTag, unstable_cache } from 'next/cache';
import { preordersEnabled } from '@/lib/catalog/preorders';

/** Separate aggregates when the launch gate changes between deployments. */
export const PREORDER_CACHE_KEY = preordersEnabled()
  ? 'preorders-on'
  : 'preorders-off';

/** Cache tag of every shared catalog entry. */
export const CATALOG_CACHE_TAG = 'catalog';

/**
 * Drops every catalog aggregate at once, after any write that changes a price,
 * a stock or a reservation. Outside a Next request (CLI scripts, DB tests)
 * there is no cache to drop: the 5-minute expiry still bounds staleness.
 */
export function invalidateCatalogCache() {
  try {
    revalidateTag(CATALOG_CACHE_TAG, { expire: 0 });
  } catch {
    // No incremental cache in this context.
  }
}

/**
 * unstable_cache shared across requests, falling back to a direct call where
 * Next provides no cache store (scripts, DB tests).
 */
export function sharedCache<Args extends string[], Result>(
  fn: (...args: Args) => Promise<Result>,
  keyParts: string[],
  revalidate: number,
) {
  const cached = unstable_cache(fn, [...keyParts, PREORDER_CACHE_KEY], {
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
