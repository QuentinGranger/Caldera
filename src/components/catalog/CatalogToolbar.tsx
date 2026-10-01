'use client';
import { useId, useRef, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDownUp, Search, X } from 'lucide-react';
import {
  catalogUrl,
  sortLabels,
  type CatalogFilters,
  type CatalogSort,
} from '@/lib/catalog/params';
import styles from './Catalog.module.scss';

/**
 * The exploration bar, held under the header while the products scroll:
 * how many products, the search, the filters and the order. On phones the
 * search opens from its button, so the bar stays on one line.
 */
export function CatalogToolbar({
  filters,
  path,
  total,
  filterControl,
}: {
  filters: CatalogFilters;
  path: string;
  total: number;
  /** The filters' button and drawer. */
  filterControl: ReactNode;
}) {
  const router = useRouter(),
    id = useId();
  const [pending, startTransition] = useTransition();
  const [searchOpen, setSearchOpen] = useState(Boolean(filters.search));
  const input = useRef<HTMLInputElement>(null);
  const change = (patch: Partial<CatalogFilters>) =>
    startTransition(() =>
      router.push(catalogUrl(path, filters, patch), { scroll: false }),
    );
  return (
    <div
      className={styles.toolbar}
      aria-busy={pending}
      data-search-open={searchOpen || undefined}
    >
      <p className={styles.total} role="status">
        {pending
          ? 'Actualisation…'
          : `${total} ${total > 1 ? 'produits' : 'produit'}`}
      </p>
      <form
        id={`${id}-form`}
        role="search"
        className={styles.search}
        onSubmit={(event) => {
          event.preventDefault();
          if (pending) return;
          const data = new FormData(event.currentTarget);
          change({ search: String(data.get('search') ?? '').trim() });
        }}
      >
        <label className={styles.srOnly} htmlFor={`${id}-search`}>
          Rechercher dans ce catalogue
        </label>
        <Search size={17} aria-hidden="true" />
        <input
          ref={input}
          key={filters.search}
          id={`${id}-search`}
          name="search"
          type="search"
          maxLength={120}
          defaultValue={filters.search}
          placeholder="Une carte, un coffret, une extension…"
        />
        <button type="submit" aria-disabled={pending}>
          Rechercher
        </button>
      </form>
      <button
        type="button"
        className={styles.searchToggle}
        aria-expanded={searchOpen}
        aria-controls={`${id}-form`}
        aria-label={searchOpen ? 'Fermer la recherche' : 'Rechercher'}
        onClick={() => {
          setSearchOpen(!searchOpen);
          if (!searchOpen) requestAnimationFrame(() => input.current?.focus());
        }}
      >
        {searchOpen ? (
          <X size={18} aria-hidden="true" />
        ) : (
          <Search size={18} aria-hidden="true" />
        )}
      </button>
      {filterControl}
      <div className={styles.sort}>
        <label htmlFor={`${id}-sort`}>
          <ArrowDownUp size={15} aria-hidden="true" />
          <span>Trier</span>
        </label>
        <select
          id={`${id}-sort`}
          value={filters.sort}
          aria-disabled={pending}
          onChange={(event) =>
            !pending && change({ sort: event.target.value as CatalogSort })
          }
        >
          {Object.entries(sortLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
