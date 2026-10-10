import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  catalogFilterSections,
  hasPriceFilter,
  catalogSortOptions,
} from '../src/lib/catalog/filterOptions';
import { parseCatalogParams } from '../src/lib/catalog/params';
import type { CatalogFacets } from '../src/lib/catalog/facets';

const examples: CatalogFacets = {
  total: 3,
  categories: [{ slug: 'scelles', name: 'Produits scellés', count: 3 }],
  types: ['BOOSTER', 'COLLECTION_BOX', 'ETB'],
  languages: ['FR'],
  sets: [],
  availability: [],
  priceRange: null,
  counts: {
    types: { BOOSTER: 1, COLLECTION_BOX: 1, ETB: 1 },
    languages: { FR: 3 },
  },
};

test('exemples : seuls les types distincts permettent d’affiner, sans prix ni disponibilité', () => {
  const filters = parseCatalogParams({});
  const sections = catalogFilterSections(examples, filters, {});
  assert.deepEqual(
    sections.map((s) => s.key),
    ['type'],
  );
  assert.equal(hasPriceFilter(examples, filters), false);
  assert.deepEqual(
    catalogFilterSections(
      {
        ...examples,
        total: 1,
        types: ['ETB'],
        counts: { types: { ETB: 1 }, languages: { FR: 1 } },
        categories: [],
      },
      filters,
      {},
    ),
    [],
  );
});

test('une seule langue reste utile si elle ne couvre qu’une partie des produits', () => {
  const facets = {
    ...examples,
    counts: { ...examples.counts, languages: { FR: 2 } },
  };
  assert.ok(
    catalogFilterSections(facets, parseCatalogParams({}), {}).some(
      (s) => s.key === 'language',
    ),
  );
  assert.ok(
    !catalogFilterSections(facets, parseCatalogParams({}), {
      language: 'FR',
    }).some((s) => s.key === 'language'),
  );
});

test('liens partagés : les filtres devenus vides restent visibles et retirables', () => {
  const filters = parseCatalogParams({
    language: 'JP',
    availability: 'preorder',
    set: 'retiree',
    minPrice: '10',
  });
  const sections = catalogFilterSections(examples, filters, {});
  assert.ok(
    sections.some(
      (s) =>
        s.key === 'availability' &&
        s.options.some((o) => o.value === 'preorder'),
    ),
  );
  assert.ok(
    sections.some(
      (s) => s.key === 'language' && s.options.some((o) => o.value === 'JP'),
    ),
  );
  assert.ok(
    sections.some(
      (s) => s.key === 'set' && s.options.some((o) => o.value === 'retiree'),
    ),
  );
  assert.ok(hasPriceFilter(examples, filters));
});

test('stock : supprimer les options nulles et celles qui ne restreignent rien', () => {
  const facets: CatalogFacets = {
    ...examples,
    availability: [
      { value: 'in-stock', count: 3 },
      { value: 'low-stock', count: 1 },
      { value: 'preorder', count: 0 },
    ],
    priceRange: { min: '5', max: '50' },
  };
  const stock = catalogFilterSections(facets, parseCatalogParams({}), {}).find(
    (s) => s.key === 'availability',
  );
  assert.deepEqual(
    stock?.options.map((o) => o.value),
    ['low-stock'],
  );
  assert.ok(hasPriceFilter(facets, parseCatalogParams({})));
  assert.equal(
    hasPriceFilter(
      { ...facets, priceRange: { min: '5', max: '5' } },
      parseCatalogParams({}),
    ),
    false,
  );
});

test('tris : aucun tri par prix sur les exemples, aucun menu pour un seul produit', () => {
  assert.deepEqual(catalogSortOptions(examples, 'recommended'), [
    'recommended',
    'newest',
    'name-asc',
  ]);
  assert.deepEqual(
    catalogSortOptions({ ...examples, total: 1 }, 'recommended'),
    ['recommended'],
  );
  assert.ok(catalogSortOptions(examples, 'price-asc').includes('price-asc'));
});
