import Link from 'next/link';
import { Search } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './Admin.module.scss';
export function FilterPanel({
  action,
  search,
  placeholder,
  activeCount,
  children,
}: {
  action: string;
  search: string;
  placeholder: string;
  activeCount: number;
  children: ReactNode;
}) {
  return (
    <form action={action} className={styles.filterPanel}>
      <div className={styles.filterPrimary}>
        <label>
          Rechercher
          <input
            type="search"
            name="search"
            defaultValue={search}
            placeholder={placeholder}
            maxLength={200}
          />
        </label>
        <button type="submit">
          <Search size={16} aria-hidden="true" />
          Rechercher
        </button>
        <Link href={action}>Réinitialiser</Link>
      </div>
      <details open={activeCount > 0}>
        <summary>
          Filtres & tri
          {activeCount > 0
            ? ` · ${activeCount} critère${activeCount > 1 ? 's' : ''} actif${activeCount > 1 ? 's' : ''}`
            : ''}
        </summary>
        <div className={styles.filterFields}>{children}</div>
        <div className={styles.actions}>
          <button type="submit" className={styles.secondaryButton}>
            Appliquer les filtres
          </button>
        </div>
      </details>
    </form>
  );
}
