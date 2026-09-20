import Link from 'next/link';
import { Compass } from 'lucide-react';
import { catalogUrl, type CatalogFilters } from '@/lib/catalog/params';
import styles from './Catalog.module.scss';
export function EmptyCatalog({
  filters,
  path,
}: {
  filters: CatalogFilters;
  path: string;
}) {
  return (
    <section className={styles.empty}>
      <Compass size={36} strokeWidth={1} aria-hidden="true" />
      <h2>
        {filters.search
          ? `Aucun résultat pour « ${filters.search} »`
          : 'Aucune découverte pour ces critères'}
      </h2>
      <p>Nous n’avons trouvé aucun produit correspondant à ces critères.</p>
      <div>
        {filters.search && (
          <Link href={catalogUrl(path, filters, { search: '' })}>
            Réinitialiser la recherche
          </Link>
        )}
        <Link href={path}>Effacer les filtres</Link>
        <Link href="/catalogue">Voir tout le catalogue</Link>
      </div>
    </section>
  );
}
