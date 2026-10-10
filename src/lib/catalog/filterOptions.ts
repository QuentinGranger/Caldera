import type { CatalogFacets } from './facets';
import {
  languageLabels,
  typeLabels,
  stockLabels,
  sortLabels,
  type CatalogSort,
  type CatalogFilters,
  type CatalogScope,
  type MultiFilter,
} from './params';

export interface FilterSection {
  key: MultiFilter;
  label: string;
  options: { value: string; label: string; count: number }[];
}

/** Keep choices that really narrow the base scope, and always allow removal of an active choice. */
export function catalogFilterSections(
  facets: CatalogFacets,
  filters: CatalogFilters,
  scope: CatalogScope,
): FilterSection[] {
  const sections: FilterSection[] = [
    {
      key: 'availability',
      label: 'Disponibilité',
      options: facets.availability.map(({ value, count }) => ({
        value,
        label: stockLabels[value],
        count,
      })),
    },
    {
      key: 'category',
      label: 'Catégorie',
      options: facets.categories.map((c) => ({
        value: c.slug,
        label: c.name,
        count: c.count,
      })),
    },
    {
      key: 'type',
      label: 'Type de produit',
      options: facets.types.map((value) => ({
        value,
        label: typeLabels[value],
        count: facets.counts.types[value] ?? 0,
      })),
    },
    {
      key: 'set',
      label: 'Extension',
      options: scope.set
        ? []
        : facets.sets.map((s) => ({
            value: s.slug,
            label: s.name,
            count: s.count,
          })),
    },
    {
      key: 'language',
      label: 'Langue',
      options: scope.language
        ? []
        : facets.languages.map((value) => ({
            value,
            label: languageLabels[value],
            count: facets.counts.languages[value] ?? 0,
          })),
    },
  ];
  const labels: Record<MultiFilter, Record<string, string>> = {
    availability: stockLabels,
    type: typeLabels,
    language: languageLabels,
    category: Object.fromEntries(
      facets.categories.map((c) => [c.slug, c.name]),
    ),
    set: Object.fromEntries(facets.sets.map((s) => [s.slug, s.name])),
  };
  return sections
    .map((section) => {
      const options = section.options.filter(
        (option) =>
          (filters[section.key] as string[]).includes(option.value) ||
          (option.count > 0 && option.count < facets.total),
      );
      for (const value of filters[section.key]) {
        if (!options.some((option) => option.value === value))
          options.push({
            value,
            label: labels[section.key][value] ?? value,
            count: 0,
          });
      }
      return { ...section, options };
    })
    .filter((section) => section.options.length > 0);
}

export function hasPriceFilter(
  facets: CatalogFacets,
  filters: Pick<CatalogFilters, 'minPrice' | 'maxPrice'>,
): boolean {
  return Boolean(
    filters.minPrice ||
    filters.maxPrice ||
    (facets.priceRange?.min != null &&
      facets.priceRange.max != null &&
      Number(facets.priceRange.min) < Number(facets.priceRange.max)),
  );
}

/** Keep a shared URL's current sort, but offer only meaningful alternatives. */
export function catalogSortOptions(
  facets: CatalogFacets,
  current: CatalogSort,
): CatalogSort[] {
  return (Object.keys(sortLabels) as CatalogSort[]).filter(
    (sort) =>
      sort === current ||
      (facets.total > 1 &&
        (!sort.startsWith('price-') || hasPriceFilter(facets, {}))),
  );
}
