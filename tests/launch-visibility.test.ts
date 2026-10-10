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
  hasSales: false,
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

test('les langues ne sont proposées que pour retirer un ancien filtre', () => {
  const facets = {
    ...examples,
    counts: { ...examples.counts, languages: { FR: 2 } },
  };
  assert.ok(
    !catalogFilterSections(facets, parseCatalogParams({}), {}).some(
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
  ]);
  assert.deepEqual(
    catalogSortOptions({ ...examples, total: 1 }, 'recommended'),
    ['recommended'],
  );
  assert.ok(catalogSortOptions(examples, 'price-asc').includes('price-asc'));
  assert.deepEqual(catalogSortOptions({ ...examples, total: 1 }, 'price-asc'), [
    'recommended',
    'price-asc',
  ]);
});

test('tris : popularité uniquement avec des ventes, ancien tri toujours retirable', () => {
  assert.ok(!catalogSortOptions(examples, 'recommended').includes('popular'));
  assert.ok(
    catalogSortOptions({ ...examples, hasSales: true }, 'recommended').includes(
      'popular',
    ),
  );
  assert.ok(catalogSortOptions(examples, 'popular').includes('popular'));
  assert.ok(catalogSortOptions(examples, 'name-asc').includes('name-asc'));
});

test('lancement : quatre filtres utiles, extensions avant types et stock', () => {
  const facets: CatalogFacets = {
    ...examples,
    sets: [{ slug: 'extension', name: 'Extension', count: 1 }],
    availability: [{ value: 'out-of-stock', count: 1 }],
    priceRange: { min: '5', max: '50' },
  };
  assert.deepEqual(
    catalogFilterSections(facets, parseCatalogParams({}), {}).map((s) => s.key),
    ['set', 'type', 'availability'],
  );
  assert.ok(hasPriceFilter(facets, {}));
  const old = catalogFilterSections(
    facets,
    parseCatalogParams({ category: 'scelles', language: 'FR' }),
    {},
  );
  assert.deepEqual(
    old.find((s) => s.key === 'language')?.options.map((o) => o.value),
    ['FR'],
  );
});
