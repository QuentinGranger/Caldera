import type { Metadata } from 'next';
import { permanentRedirect } from 'next/navigation';
import { connection } from 'next/server';
import type { ReactNode } from 'react';
import { listingMetadata } from '@/lib/catalog/metadata';
import { activeFilterCount } from '@/lib/catalog/params';
import type { MetadataImage } from '@/lib/seo/metadata';
import type { IndexDecision } from '@/lib/seo/types';
import {
  resolveCatalog,
  type CatalogLoad,
  type CatalogLoadInput,
} from './catalogLoad';
import { CatalogFilters } from './CatalogFilters';
import { CatalogToolbar } from './CatalogToolbar';
import { ActiveFilters } from './ActiveFilters';
import { CatalogGrid } from './CatalogGrid';
import { CatalogPagination } from './CatalogPagination';
import { CatalogQuickNav } from './CatalogQuickNav';
import { EmptyCatalog } from './EmptyCatalog';
import type { EmptyAction } from './EmptyState';
import styles from './Catalog.module.scss';

export {
  catalogItemListNode,
  catalogLoadPath,
  catalogRobots,
  getScopeFacets,
  resolveCatalog,
  type CatalogLoad,
  type CatalogLoadInput,
} from './catalogLoad';

/**
 * Parses the query, loads products and facets, and answers 308 to the
 * canonical query when the request differs (unknown slugs, invalid values,
 * page out of range). Tracking parameters (utm_*, gclid…) are ignored.
 */
export async function loadCatalog(
  input: CatalogLoadInput,
): Promise<CatalogLoad> {
  await connection();
  const { load, redirectTo } = await resolveCatalog(input);
  if (redirectTo !== null) permanentRedirect(redirectTo);
  return load;
}

export interface CatalogListingMetadataInput extends CatalogLoadInput {
  /** Title of the first page, without the brand suffix (layout template). */
  title: string;
  description: string;
  /** Decision of the unrefined first page; catalogRobots is applied here. */
  decision: IndexDecision;
  image?: MetadataImage | null;
}

/** generateMetadata of a listing: page suffix, robots and canonical. */
export async function catalogListingMetadata({
  title,
  description,
  decision,
  image,
  ...input
}: CatalogListingMetadataInput): Promise<Metadata> {
  const load = await loadCatalog(input);
  return listingMetadata({ state: load, title, description, decision, image });
}

/**
 * The products of a loaded listing, the same on every page: a row of ways
 * in (`nav`: the shop's aisles; the listing's families by default), the
 * exploration bar (count, search, filters drawer, order), the active
 * filters, the grid and its crawlable pagination. A scope without any
 * product and without refinement shows `emptyState` instead of the bar.
 * `interlude` opens a window between two rows (after the grid when it is
 * short); `widest` is the last way out of a search without result.
 */
export function CatalogResults({
  load,
  path,
  nav,
  emptyState,
  interlude,
  widest,
}: {
  load: CatalogLoad;
  path: string;
  nav?: ReactNode;
  emptyState: ReactNode;
  interlude?: ReactNode;
  widest?: EmptyAction;
}) {
  const { filters, facets, result, total } = load;
  const quickNav = nav ?? (
    <CatalogQuickNav facets={facets} filters={filters} path={path} />
  );
  return (
    <section
      className={styles.explorer}
      id="catalogue-resultats"
      aria-labelledby="catalogue-produits"
    >
      <h2 id="catalogue-produits" className={styles.srOnly}>
        Produits
      </h2>
      {quickNav}
      {!total && !load.hasRefinements ? (
        emptyState
      ) : (
        <>
          <CatalogToolbar
            filters={filters}
            path={path}
            total={total}
            filterControl={
              <CatalogFilters
                filters={filters}
                facets={facets}
                scope={load.scope}
                path={path}
                total={total}
              />
            }
          />
          {activeFilterCount(filters) > 0 && (
            <div className={styles.refinements}>
              {total > 0 && (
                <p className={styles.resultCount}>
                  {total}{' '}
                  {total > 1 ? 'produits correspondent' : 'produit correspond'}{' '}
                  à ces critères.
                </p>
              )}
              <ActiveFilters filters={filters} facets={facets} path={path} />
            </div>
          )}
          {result.products.length ? (
            <CatalogGrid
              products={result.products}
              interlude={load.hasRefinements ? undefined : interlude}
            />
          ) : (
            <EmptyCatalog filters={filters} path={path} widest={widest} />
          )}
          <CatalogPagination
            filters={filters}
            path={path}
            pageCount={load.pageCount}
            total={total}
            pageSize={result.pageSize}
          />
        </>
      )}
    </section>
  );
}
