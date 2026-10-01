import Link from 'next/link';
import { catalogUrl, type CatalogFilters } from '@/lib/catalog/params';
import type { CatalogFacets } from '@/lib/catalog/facets';
import { PendingHint } from './PendingHint';
import styles from './Catalog.module.scss';

/**
 * The families of the listing at a glance, to narrow it in one tap without
 * opening the filters. Only families with products; the other filters stay.
 */
export function CatalogQuickNav({
  facets,
  filters,
  path,
}: {
  facets: CatalogFacets;
  filters: CatalogFilters;
  path: string;
}) {
  if (facets.categories.length < 2) return null;
  const only = filters.category.length === 1 ? filters.category[0] : null;
  const entries = [
    {
      key: 'all',
      label: 'Tout',
      href: catalogUrl(path, filters, { category: [] }),
      current: filters.category.length === 0,
      count: null,
    },
    ...facets.categories.map((category) => ({
      key: category.slug,
      label: category.name,
      href: catalogUrl(path, filters, { category: [category.slug] }),
      current: only === category.slug,
      count: category.count,
    })),
  ];
  return (
    <nav className={styles.quickNav} aria-label="Familles de produits">
      <ul>
        {entries.map((entry) => (
          <li key={entry.key}>
            <Link
              href={entry.href}
              scroll={false}
              aria-current={entry.current ? 'true' : undefined}
            >
              {entry.label}
              {entry.count !== null && (
                <>
                  {' '}
                  <span className={styles.quickCount}>
                    {entry.count}
                    <span className={styles.srOnly}> produits</span>
                  </span>
                </>
              )}
              <PendingHint />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
