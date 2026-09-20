import type { ProductLanguage, ProductType } from '@/generated/prisma/client';

export const CATALOG_PAGE_SIZE = 12;
export const sortLabels = {
  recommended: 'Recommandé',
  newest: 'Nouveautés',
  'price-asc': 'Prix croissant',
  'price-desc': 'Prix décroissant',
  'name-asc': 'Nom A–Z',
} as const;
export const typeLabels: Record<ProductType, string> = {
  BOOSTER: 'Boosters',
  BLISTER: 'Blisters',
  TRIPACK: 'Tripacks',
  BUNDLE: 'Bundles',
  DISPLAY: 'Displays',
  ETB: 'Elite Trainer Box',
  COLLECTION_BOX: 'Coffrets',
  TIN: 'Tins',
  DECK: 'Decks',
  ACCESSORY: 'Accessoires',
  SINGLE_CARD: 'Cartes à l’unité',
  OTHER: 'Autres',
};
export const languageLabels: Record<ProductLanguage, string> = {
  FR: 'Français',
  EN: 'Anglais',
  JP: 'Japonais',
  DE: 'Allemand',
  ES: 'Espagnol',
  IT: 'Italien',
  OTHER: 'Autre',
};
export const stockLabels = {
  'in-stock': 'En stock',
  'low-stock': 'Dernières pièces',
  preorder: 'Précommande',
} as const;
export type CatalogSort = keyof typeof sortLabels;
export type StockFilter = keyof typeof stockLabels;
export type SearchParams = Record<string, string | string[] | undefined>;
export type CatalogFilters = {
  category: string[];
  type: ProductType[];
  set: string[];
  language: ProductLanguage[];
  availability: StockFilter[];
  minPrice?: string;
  maxPrice?: string;
  search: string;
  sort: CatalogSort;
  page: number;
};
export type MultiFilter =
  'category' | 'type' | 'set' | 'language' | 'availability';
export const multiFilters: MultiFilter[] = [
  'category',
  'type',
  'set',
  'language',
  'availability',
];
export type CatalogScope = {
  category?: string;
  set?: string;
  newArrival?: boolean;
  preorder?: boolean;
};
const first = (value: SearchParams[string]) =>
  Array.isArray(value) ? value[0] : value;
function values(value: SearchParams[string]) {
  return [
    ...new Set(
      (Array.isArray(value) ? value : [value ?? ''])
        .flatMap((v) => v.split(','))
        .map((v) => v.trim())
        .filter(Boolean),
    ),
  ]
    .slice(0, 40)
    .sort();
}
function members<T extends string>(
  value: SearchParams[string],
  labels: Record<T, string>,
): T[] {
  return values(value).filter((v): v is T => Object.hasOwn(labels, v));
}
function price(value: SearchParams[string]) {
  const input = first(value)?.trim().replace(',', '.');
  if (!input || !/^\d{1,8}(\.\d{1,2})?$/.test(input)) return undefined;
  const [whole = '0', fraction = ''] = input.split('.');
  return `${Number(whole)}.${fraction.padEnd(2, '0')}`;
}
export function parseCatalogParams(params: SearchParams): CatalogFilters {
  const requestedPage = first(params.page) ?? '';
  const page = /^\d+$/.test(requestedPage) ? Number(requestedPage) : 1;
  let minPrice = price(params.minPrice),
    maxPrice = price(params.maxPrice);
  // Entiers en centimes pour comparer les deux bornes, jamais un calcul monétaire flottant.
  if (
    minPrice &&
    maxPrice &&
    Number(minPrice.replace('.', '')) > Number(maxPrice.replace('.', ''))
  )
    [minPrice, maxPrice] = [maxPrice, minPrice];
  const sort = first(params.sort) ?? '';
  return {
    category: values(params.category).filter(
      (v) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v) && v.length <= 120,
    ),
    type: members(params.type, typeLabels),
    set: values(params.set).filter(
      (v) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v) && v.length <= 120,
    ),
    language: members(params.language, languageLabels),
    availability: members(params.availability, stockLabels),
    ...(minPrice ? { minPrice } : {}),
    ...(maxPrice ? { maxPrice } : {}),
    search: (first(params.search) ?? '')
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .trim()
      .slice(0, 120),
    sort: Object.hasOwn(sortLabels, sort)
      ? (sort as CatalogSort)
      : 'recommended',
    page: Number.isSafeInteger(page) && page > 0 ? Math.min(page, 100000) : 1,
  };
}
export function catalogQuery(filters: CatalogFilters) {
  const params = new URLSearchParams();
  for (const key of multiFilters)
    if (filters[key].length)
      params.set(key, [...filters[key]].sort().join(','));
  if (filters.minPrice) params.set('minPrice', filters.minPrice);
  if (filters.maxPrice) params.set('maxPrice', filters.maxPrice);
  if (filters.search) params.set('search', filters.search);
  if (filters.sort !== 'recommended') params.set('sort', filters.sort);
  if (filters.page > 1) params.set('page', String(filters.page));
  return params.toString();
}
export function catalogUrl(
  path: string,
  filters: CatalogFilters,
  patch: Partial<CatalogFilters> = {},
) {
  const next = { ...filters, ...patch, page: patch.page ?? 1 };
  const query = catalogQuery(next);
  return path + (query ? `?${query}` : '');
}
export function activeFilterCount(filters: CatalogFilters) {
  return (
    multiFilters.reduce((n, key) => n + filters[key].length, 0) +
    Number(Boolean(filters.minPrice || filters.maxPrice)) +
    Number(Boolean(filters.search))
  );
}
export function paginationPages(
  page: number,
  count: number,
): (number | 'gap')[] {
  const pages = [...new Set([1, page - 1, page, page + 1, count])]
    .filter((p) => p >= 1 && p <= count)
    .sort((a, b) => a - b);
  const result: (number | 'gap')[] = [];
  pages.forEach((p, i) => {
    if (i && p - pages[i - 1]! > 1) result.push('gap');
    result.push(p);
  });
  return result;
}
