import Link from 'next/link';
import { ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react';
import type { ReactNode } from 'react';
import type { SearchParams } from '@/lib/admin/queries';
import { adminListHref } from '@/lib/admin/list-url';
import styles from './Admin.module.scss';
export function FilterPanel({
  action,
  search,
  placeholder,
  activeCount = 0,
  keep = {},
  params,
  criteria = [],
  children,
}: {
  action: string;
  search: string;
  placeholder: string;
  activeCount?: number;
  /** The current view (a tab), kept through a new search. */
  keep?: Record<string, string>;
  params?: SearchParams;
  /** Human-readable names for the selected criteria, excluding the view tabs. */
  criteria?: { name: string; label: string }[];
  /** The filters; none: the search alone. */
  children?: ReactNode;
}) {
  const selected = [
    ...(search ? [{ name: 'search', label: `Recherche : ${search}` }] : []),
    ...criteria,
  ];
  return (
    <form
      key={JSON.stringify(params ?? { search, activeCount, keep })}
      action={action}
      className={styles.filterPanel}
    >
      <div className={styles.filterPrimary}>
        <label className={styles.filterSearch}>
          Rechercher
          <span>
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              name="search"
              defaultValue={search}
              placeholder={placeholder}
              maxLength={200}
            />
          </span>
        </label>
        <button type="submit">
          <Search size={16} aria-hidden="true" />
          Rechercher
        </button>
        {(search || activeCount > 0) && <Link href={action}>Tout effacer</Link>}
      </div>
      {Object.entries(keep).map(
        ([name, value]) =>
          value && <input key={name} type="hidden" name={name} value={value} />,
      )}
      {children && (
        <details open={activeCount > 0}>
          <summary>
            <SlidersHorizontal size={16} aria-hidden="true" />
            Filtres & tri
            {activeCount > 0 && (
              <b className={styles.tabCount}>{activeCount}</b>
            )}
            <ChevronDown size={15} aria-hidden="true" />
          </summary>
          <div className={styles.filterFields}>{children}</div>
          <div className={styles.actions}>
            <button type="submit" className={styles.secondaryButton}>
              Appliquer les filtres
            </button>
          </div>
        </details>
      )}
      {params && selected.length > 0 && (
        <nav className={styles.activeFilters} aria-label="Filtres actifs">
          {selected.map(({ name, label }) => (
            <Link
              key={name}
              href={adminListHref(action, params, { [name]: undefined })}
              aria-label={`Retirer le filtre ${label}`}
            >
              <span>{label}</span>
              <X size={13} aria-hidden="true" />
            </Link>
          ))}
        </nav>
      )}
    </form>
  );
}
