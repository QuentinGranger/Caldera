import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import {
  catalogUrl,
  paginationPages,
  type CatalogFilters,
} from '@/lib/catalog/params';
import { PendingHint } from './PendingHint';
import styles from './Catalog.module.scss';

/**
 * Real pages, each with its own URL: crawlable, shareable, and the back
 * button returns to the same products at the same place.
 */
export function CatalogPagination({
  filters,
  path,
  pageCount,
  total,
  pageSize,
}: {
  filters: CatalogFilters;
  path: string;
  pageCount: number;
  total: number;
  pageSize: number;
}) {
  if (pageCount <= 1) return null;
  const href = (page: number) =>
    `${catalogUrl(path, filters, { page })}#catalogue-resultats`;
  const first = (filters.page - 1) * pageSize + 1;
  const last = Math.min(filters.page * pageSize, total);
  return (
    <nav aria-label="Pagination du catalogue" className={styles.pagination}>
      <p className={styles.range}>
        Produits {first}–{last} sur {total}
      </p>
      <div className={styles.pages}>
        {filters.page > 1 ? (
          <Link
            href={href(filters.page - 1)}
            className={styles.step}
            rel="prev"
            aria-label="Page précédente"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            <span>Précédente</span>
            <PendingHint />
          </Link>
        ) : (
          <span className={styles.stepPlaceholder} aria-hidden="true" />
        )}
        <ol>
          {paginationPages(filters.page, pageCount).map((page, i) =>
            page === 'gap' ? (
              <li key={`gap-${i}`} aria-hidden="true">
                …
              </li>
            ) : (
              <li key={page}>
                <Link
                  href={href(page)}
                  aria-current={page === filters.page ? 'page' : undefined}
                  aria-label={`Page ${page}`}
                >
                  {page}
                </Link>
              </li>
            ),
          )}
        </ol>
        {filters.page < pageCount ? (
          <Link
            href={href(filters.page + 1)}
            className={styles.step}
            rel="next"
            aria-label="Page suivante"
          >
            <span>Suivante</span>
            <ArrowRight size={16} aria-hidden="true" />
            <PendingHint />
          </Link>
        ) : (
          <span className={styles.stepPlaceholder} aria-hidden="true" />
        )}
      </div>
    </nav>
  );
}
