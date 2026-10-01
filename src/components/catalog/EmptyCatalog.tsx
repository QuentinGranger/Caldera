import { hasCatalogRefinements } from '@/lib/catalog/metadata';
import { catalogUrl, type CatalogFilters } from '@/lib/catalog/params';
import { EmptyState, type EmptyAction } from './EmptyState';

/** The shop's widest list: every product. */
export const ALL_PRODUCTS: EmptyAction = {
  href: '/catalogue',
  label: 'Voir tous les produits',
};

/**
 * No product for this search or these filters: say so plainly, then the
 * ways back, the widest last (`widest`: the whole aisle, or the catalogue).
 */
export function EmptyCatalog({
  filters,
  path,
  widest = ALL_PRODUCTS,
}: {
  filters: CatalogFilters;
  path: string;
  widest?: EmptyAction;
}) {
  const refined = hasCatalogRefinements(filters);
  // Filters other than the search itself.
  const filtered =
    refined && catalogUrl(path, filters, { search: '' }) !== path;
  const actions: EmptyAction[] = [
    ...(filters.search
      ? [
          {
            href: catalogUrl(path, filters, { search: '' }),
            label: 'Réinitialiser la recherche',
          },
        ]
      : []),
    ...(filtered ? [{ href: path, label: 'Réinitialiser les filtres' }] : []),
    ...(widest.href !== path ? [widest] : []),
  ];
  return (
    <EmptyState
      title={
        filters.search
          ? `Aucun résultat pour « ${filters.search} »`
          : refined
            ? 'Aucun produit trouvé'
            : 'Aucun produit disponible pour le moment'
      }
      text={
        filters.search
          ? 'Vérifiez l’orthographe, essayez un nom d’extension ou un type de produit.'
          : refined
            ? 'Retirez un filtre, ou repartez de toute la sélection.'
            : 'Cette sélection ne contient aucun produit en ligne aujourd’hui.'
      }
      actions={actions}
    />
  );
}
