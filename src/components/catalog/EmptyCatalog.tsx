import Link from 'next/link';
import { Compass } from 'lucide-react';
import { hasCatalogRefinements } from '@/lib/catalog/metadata';
import { catalogUrl, type CatalogFilters } from '@/lib/catalog/params';
import styles from './Catalog.module.scss';

/**
 * No product for this search or these filters: say so plainly, then the
 * ways back, the widest last.
 */
export function EmptyCatalog({
  filters,
  path,
}: {
  filters: CatalogFilters;
  path: string;
}) {
  const refined = hasCatalogRefinements(filters);
  // Filters other than the search itself.
  const filtered =
    refined && catalogUrl(path, filters, { search: '' }) !== path;
  return (
    <section className={styles.empty} aria-labelledby="catalogue-vide">
      <Compass size={34} strokeWidth={1.2} aria-hidden="true" />
      <h2 id="catalogue-vide">
        {filters.search
          ? `Aucun résultat pour « ${filters.search} »`
          : refined
            ? 'Aucun produit ne correspond à cette exploration'
            : 'Aucun produit disponible pour le moment'}
      </h2>
      <p>
        {filters.search
          ? 'Vérifiez l’orthographe, essayez un nom d’extension ou un type de produit.'
          : refined
            ? 'Retirez un filtre, ou repartez de toute la sélection.'
            : 'Cette sélection ne contient aucun produit en ligne aujourd’hui.'}
      </p>
      <div className={styles.emptyActions}>
        {filters.search && (
          <Link href={catalogUrl(path, filters, { search: '' })}>
            Réinitialiser la recherche
          </Link>
        )}
        {filtered && <Link href={path}>Réinitialiser les filtres</Link>}
        {path !== '/catalogue' && (
          <Link href="/catalogue">Voir tout le catalogue</Link>
        )}
      </div>
    </section>
  );
}
