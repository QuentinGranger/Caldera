import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import {
  catalogUrl,
  paginationPages,
  type CatalogFilters,
} from '@/lib/catalog/params';
import styles from './Catalog.module.scss';
export function CatalogPagination({
  filters,
  path,
  pageCount,
}: {
  filters: CatalogFilters;
  path: string;
  pageCount: number;
}) {
  if (pageCount <= 1) return null;
  const href = (page: number) =>
    `${catalogUrl(path, filters, { page })}#catalogue-resultats`;
  return (
    <nav aria-label="Pagination du catalogue" className={styles.pagination}>
      {filters.page > 1 && (
        <Link href={href(filters.page - 1)} aria-label="Page précédente">
          <ArrowLeft size={16} />
        </Link>
      )}
      {paginationPages(filters.page, pageCount).map((page, i) =>
        page === 'gap' ? (
          <span key={`gap-${i}`} aria-hidden="true">
            …
          </span>
        ) : (
          <Link
            key={page}
            href={href(page)}
            aria-current={page === filters.page ? 'page' : undefined}
            aria-label={`Page ${page}`}
          >
            {page}
          </Link>
        ),
      )}
      {filters.page < pageCount && (
        <Link href={href(filters.page + 1)} aria-label="Page suivante">
          <ArrowRight size={16} />
        </Link>
      )}
    </nav>
  );
}
