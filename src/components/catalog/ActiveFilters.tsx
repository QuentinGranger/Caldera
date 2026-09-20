import Link from 'next/link';
import { X } from 'lucide-react';
import {
  catalogUrl,
  multiFilters,
  type CatalogFilters,
} from '@/lib/catalog/params';
import { languageLabels, typeLabels, stockLabels } from '@/lib/catalog/params';
import type { CatalogFacets } from '@/lib/catalog/facets';
import { formatPrice } from '@/utils/formatPrice';
import styles from './Catalog.module.scss';
export function ActiveFilters({
  filters,
  facets,
  path,
}: {
  filters: CatalogFilters;
  facets: CatalogFacets;
  path: string;
}) {
  const labels: Record<string, Record<string, string>> = {
    category: Object.fromEntries(
      facets.categories.map((c) => [c.slug, c.name]),
    ),
    set: Object.fromEntries(facets.sets.map((s) => [s.slug, s.name])),
    type: typeLabels,
    language: languageLabels,
    availability: stockLabels,
  };
  const chips = multiFilters.flatMap((key) =>
    filters[key].map((value) => ({
      label: labels[key]?.[value] ?? value,
      href: catalogUrl(path, filters, {
        [key]: filters[key].filter((v) => v !== value),
      }),
    })),
  );
  if (filters.search)
    chips.push({
      label: `Recherche : ${filters.search}`,
      href: catalogUrl(path, filters, { search: '' }),
    });
  if (filters.minPrice || filters.maxPrice)
    chips.push({
      label: `${filters.minPrice ? formatPrice(filters.minPrice) : '0 €'} – ${filters.maxPrice ? formatPrice(filters.maxPrice) : 'sans plafond'}`,
      href: catalogUrl(path, filters, {
        minPrice: undefined,
        maxPrice: undefined,
      }),
    });
  if (!chips.length) return null;
  return (
    <div className={styles.active} aria-label="Filtres actifs">
      {chips.map((chip) => (
        <Link
          key={chip.href}
          href={chip.href}
          aria-label={`Retirer le filtre ${chip.label}`}
        >
          {chip.label}
          <X size={13} aria-hidden="true" />
        </Link>
      ))}
      <Link className={styles.clear} href={path}>
        Tout effacer
      </Link>
    </div>
  );
}
