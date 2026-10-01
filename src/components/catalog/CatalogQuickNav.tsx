import Link from 'next/link';
import { catalogUrl, type CatalogFilters } from '@/lib/catalog/params';
import type { CatalogFacets } from '@/lib/catalog/facets';
import { ChipRow } from './ChipRow';
import { PendingHint } from './PendingHint';
import styles from './Catalog.module.scss';

/** The filters a row of chips can stand for, with their words. */
const ROWS = {
  category: { all: 'Tout', label: 'Familles de produits' },
  set: { all: 'Toutes les extensions', label: 'Extensions' },
} as const;

/**
 * One filter of the listing at a glance (its families by default, or its
 * sets), to narrow it in one tap without opening the filters: the same
 * query parameter as the drawer, so both always agree. Only options with
 * products; the other filters stay.
 */
export function CatalogQuickNav({
  facets,
  filters,
  path,
  facet = 'category',
}: {
  facets: CatalogFacets;
  filters: CatalogFilters;
  path: string;
  facet?: keyof typeof ROWS;
}) {
  const options = facet === 'set' ? facets.sets : facets.categories;
  if (options.length < 2) return null;
  const chosen = filters[facet];
  const only = chosen.length === 1 ? chosen[0] : null;
  const entries = [
    {
      key: 'all',
      label: ROWS[facet].all,
      href: catalogUrl(path, filters, { [facet]: [] }),
      current: chosen.length === 0,
      count: null,
    },
    ...options.map((option) => ({
      key: option.slug,
      label: option.name,
      href: catalogUrl(path, filters, { [facet]: [option.slug] }),
      current: only === option.slug,
      count: option.count,
    })),
  ];
  return (
    <nav className={styles.quickNav} aria-label={ROWS[facet].label}>
      <ChipRow key={only ?? 'all'}>
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
      </ChipRow>
    </nav>
  );
}
