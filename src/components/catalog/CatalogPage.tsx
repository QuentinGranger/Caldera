import type { Metadata } from 'next';
import { permanentRedirect } from 'next/navigation';
import { connection } from 'next/server';
import type { ReactNode } from 'react';
import { Container } from '@/components/ui/Container/Container';
import {
  Breadcrumb,
  type BreadcrumbItem,
} from '@/components/ui/Breadcrumb/Breadcrumb';
import { JsonLd } from '@/components/seo/JsonLd';
import { listingMetadata } from '@/lib/catalog/metadata';
import {
  activeFilterCount,
  type CatalogScope,
  type SearchParams,
} from '@/lib/catalog/params';
import { collectionPageNode, graph } from '@/lib/seo/jsonld';
import type { MetadataImage } from '@/lib/seo/metadata';
import type { IndexDecision, SeoLinkGroup } from '@/lib/seo/types';
import {
  catalogItemListNode,
  catalogLoadPath,
  resolveCatalog,
  type CatalogLoad,
  type CatalogLoadInput,
} from './catalogLoad';
import { CatalogHeader } from './CatalogHeader';
import { CatalogFilters } from './CatalogFilters';
import { CatalogLinks } from './CatalogLinks';
import { CatalogToolbar } from './CatalogToolbar';
import { ActiveFilters } from './ActiveFilters';
import { CatalogGrid } from './CatalogGrid';
import { CatalogPagination } from './CatalogPagination';
import { EmptyCatalog } from './EmptyCatalog';
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
 * Filters, toolbar, active filters, grid and crawlable pagination of a loaded
 * listing, then its internal links. A scope without any product and without
 * refinement shows `emptyState` (the default empty message otherwise) and no
 * filter.
 */
export function CatalogResults({
  load,
  path,
  emptyState,
  linkGroups,
}: {
  load: CatalogLoad;
  path: string;
  emptyState?: ReactNode;
  linkGroups?: SeoLinkGroup[];
}) {
  const { filters, facets, result, total } = load;
  const links = linkGroups?.length ? (
    <CatalogLinks groups={linkGroups} />
  ) : null;
  if (!total && !load.hasRefinements)
    return (
      <>
        {emptyState ?? <EmptyCatalog filters={filters} path={path} />}
        {links}
      </>
    );
  return (
    <>
      <div className={styles.layout} id="catalogue-resultats">
        <CatalogFilters
          filters={filters}
          facets={facets}
          scope={load.scope}
          path={path}
        />
        <div className={styles.results}>
          <h2 className={styles.srOnly}>Produits</h2>
          <CatalogToolbar filters={filters} path={path} total={total} />
          {total > 0 && activeFilterCount(filters) > 0 && (
            <p className={styles.resultCount}>
              {total}{' '}
              {total > 1 ? 'produits correspondent' : 'produit correspond'} à
              ces critères.
            </p>
          )}
          <ActiveFilters filters={filters} facets={facets} path={path} />
          {result.products.length ? (
            <CatalogGrid products={result.products} />
          ) : (
            <EmptyCatalog filters={filters} path={path} />
          )}
          <CatalogPagination
            filters={filters}
            path={path}
            pageCount={load.pageCount}
          />
        </div>
      </div>
      {links}
    </>
  );
}

export async function CatalogPage({
  title,
  description,
  path,
  searchParams,
  scope = {},
  breadcrumb,
  children,
  structuredData = true,
}: {
  title: string;
  description?: string | null;
  path: string;
  searchParams: Promise<SearchParams>;
  scope?: CatalogScope;
  breadcrumb: BreadcrumbItem[];
  children?: ReactNode;
  /** CollectionPage + ItemList of the products shown. */
  structuredData?: boolean;
}) {
  const load = await loadCatalog({ path, searchParams, scope });
  return (
    <main id="contenu" tabIndex={-1} className={styles.main}>
      <Container>
        <Breadcrumb items={breadcrumb} currentPath={path} />
        <CatalogHeader
          title={title}
          description={description}
          total={load.total}
        />
        {children}
        <CatalogResults load={load} path={path} />
      </Container>
      {structuredData && (
        <JsonLd
          data={graph(
            collectionPageNode({
              path: catalogLoadPath(load),
              name: title,
              description,
              mainEntity: catalogItemListNode(load),
            }),
          )}
        />
      )}
    </main>
  );
}
