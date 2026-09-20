'use client';
import { useId, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import {
  catalogUrl,
  sortLabels,
  type CatalogFilters,
  type CatalogSort,
} from '@/lib/catalog/params';
import styles from './Catalog.module.scss';
export function CatalogToolbar({
  filters,
  path,
  total,
}: {
  filters: CatalogFilters;
  path: string;
  total: number;
}) {
  const router = useRouter(),
    id = useId();
  const [pending, startTransition] = useTransition();
  const change = (patch: Partial<CatalogFilters>) =>
    startTransition(() =>
      router.push(catalogUrl(path, filters, patch), { scroll: false }),
    );
  return (
    <div className={styles.toolbar} aria-busy={pending}>
      <form
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
        <input
          key={filters.search}
          id={`${id}-search`}
          name="search"
          type="search"
          maxLength={120}
          defaultValue={filters.search}
          placeholder="Une carte, un coffret, une extension…"
        />
        <button
          type="submit"
          aria-disabled={pending}
          aria-label="Lancer la recherche"
        >
          <Search size={18} aria-hidden="true" />
        </button>
      </form>
      <div className={styles.sort}>
        <label htmlFor={`${id}-sort`}>Trier par</label>
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
      <p className={styles.srOnly} role="status">
        {pending
          ? 'Actualisation du catalogue…'
          : `${total} ${total > 1 ? 'produits' : 'produit'}`}
      </p>
    </div>
  );
}
