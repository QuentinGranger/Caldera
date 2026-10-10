import Link from 'next/link';
import {
  catalogUrl,
  typeLabels,
  type CatalogFilters,
} from '@/lib/catalog/params';
import type { CatalogFacets } from '@/lib/catalog/facets';
import { ChipRow } from './ChipRow';
import { PendingHint } from './PendingHint';
import styles from './Catalog.module.scss';

/** The filters a row of chips can stand for, with their words. */
const ROWS = {
  type: { all: 'Tout', label: 'Types de produits' },
  set: { all: 'Toutes les extensions', label: 'Extensions' },
} as const;

/**
 * One filter of the listing at a glance (its product types by default, or its
 * sets), to narrow it in one tap without opening the filters: the same
 * query parameter as the drawer, so both always agree. Only options with
 * products; the other filters stay.
 */
export function CatalogQuickNav({
  facets,
  filters,
  path,
  facet = 'type',
}: {
  facets: CatalogFacets;
  filters: CatalogFilters;
  path: string;
  facet?: keyof typeof ROWS;
}) {
  const candidates = (
    facet === 'set'
      ? facets.sets
      : facets.types.map((type) => ({
          slug: type,
          name: typeLabels[type],
          count: facets.counts.types[type] ?? 0,
        }))
  ).filter(
    (option) =>
      (option.count > 0 && option.count < facets.total) ||
      (filters[facet] as string[]).includes(option.slug),
  );
  const options = candidates
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'fr'))
    .filter(
      (option, index) =>
        index < 6 || (filters[facet] as string[]).includes(option.slug),
    );
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
                    <span className={styles.srOnly}>
                      {entry.count === 1 ? ' produit' : ' produits'}
                    </span>
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
