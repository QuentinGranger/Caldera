import type { ReactNode } from 'react';
import { connection } from 'next/server';
import { redirect } from 'next/navigation';
import { Container } from '@/components/ui/Container/Container';
import {
  Breadcrumb,
  type BreadcrumbItem,
} from '@/components/ui/Breadcrumb/Breadcrumb';
import { getCatalogProducts } from '@/lib/catalog/getCatalogProducts';
import { getCatalogFacets } from '@/lib/catalog/facets';
import {
  catalogQuery,
  parseCatalogParams,
  type CatalogScope,
  type SearchParams,
} from '@/lib/catalog/params';
import { CatalogHeader } from './CatalogHeader';
import { CatalogFilters } from './CatalogFilters';
import { CatalogToolbar } from './CatalogToolbar';
import { ActiveFilters } from './ActiveFilters';
import { CatalogGrid } from './CatalogGrid';
import { CatalogPagination } from './CatalogPagination';
import { EmptyCatalog } from './EmptyCatalog';
import styles from './Catalog.module.scss';
export async function CatalogPage({
  title,
  description,
  path,
  searchParams,
  scope = {},
  breadcrumb,
  children,
}: {
  title: string;
  description?: string | null;
  path: string;
  searchParams: Promise<SearchParams>;
  scope?: CatalogScope;
  breadcrumb: BreadcrumbItem[];
  children?: ReactNode;
}) {
  await connection();
  const raw = await searchParams;
  const filters = parseCatalogParams(raw);
  const [result, facets] = await Promise.all([
    getCatalogProducts(filters, scope),
    getCatalogFacets(scope),
  ]);
  filters.page = result.page;
  const canonical = catalogQuery(filters);
  const actual = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    for (const v of Array.isArray(value)
      ? value
      : value === undefined
        ? []
        : [value])
      actual.append(key, v);
  }
  actual.sort();
  const normalized = new URLSearchParams(canonical);
  normalized.sort();
  if (actual.toString() !== normalized.toString())
    redirect(path + (canonical ? `?${canonical}` : ''));
  return (
    <main id="contenu" tabIndex={-1} className={styles.main}>
      <Container>
        <Breadcrumb items={breadcrumb} />
        <CatalogHeader
          title={title}
          description={description}
          total={result.total}
        />
        {children}
        <div className={styles.layout} id="catalogue-resultats">
          <CatalogFilters
            filters={filters}
            facets={facets}
            scope={scope}
            path={path}
          />
          <div className={styles.results}>
            <CatalogToolbar
              filters={filters}
              path={path}
              total={result.total}
            />
            <ActiveFilters filters={filters} facets={facets} path={path} />
            {result.products.length ? (
              <CatalogGrid products={result.products} />
            ) : (
              <EmptyCatalog filters={filters} path={path} />
            )}
            <CatalogPagination
              filters={filters}
              path={path}
              pageCount={result.pageCount}
            />
          </div>
        </div>
      </Container>
    </main>
  );
}
