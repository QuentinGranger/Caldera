import Link from 'next/link';
import { Compass } from 'lucide-react';
import { hasCatalogRefinements } from '@/lib/catalog/metadata';
import { catalogUrl, type CatalogFilters } from '@/lib/catalog/params';
import styles from './Catalog.module.scss';
export function EmptyCatalog({
  filters,
  path,
}: {
  filters: CatalogFilters;
  path: string;
}) {
  const refined = hasCatalogRefinements(filters);
  return (
    <section className={styles.empty}>
      <Compass size={36} strokeWidth={1} aria-hidden="true" />
      <h2>
        {filters.search
          ? `Aucun résultat pour « ${filters.search} »`
          : refined
            ? 'Aucune découverte pour ces critères'
            : 'Aucun produit disponible pour le moment'}
      </h2>
      <p>
        {refined
          ? 'Nous n’avons trouvé aucun produit correspondant à ces critères.'
          : 'Cette sélection ne contient aucun produit en ligne aujourd’hui.'}
      </p>
      <div>
        {filters.search && (
          <Link href={catalogUrl(path, filters, { search: '' })}>
            Réinitialiser la recherche
          </Link>
        )}
        {refined && <Link href={path}>Effacer les filtres</Link>}
        {path !== '/catalogue' && (
          <Link href="/catalogue">Voir tout le catalogue</Link>
        )}
      </div>
    </section>
  );
}
