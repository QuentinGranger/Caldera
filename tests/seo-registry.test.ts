import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withKnownSlugs, parseCatalogParams } from '../src/lib/catalog/params';
import { allocateSlots } from '../src/lib/catalog/getRelatedProducts';
import {
  aggregateOverTree,
  breakdownFromRows,
  categoryDescendants,
  categoryLineage,
  countGameLandings,
  groupStatuses,
  indexCategoryHubs,
  indexGameLandings,
  type FactGroup,
  type LandingIndex,
} from '../src/lib/seo/registry';
import { buildNavigation } from '../src/lib/seo/links';
import type { CategoryRef, GameRef, SetRef } from '../src/lib/seo/types';

const pokemon: GameRef = { id: 'g-pkm', slug: 'pokemon', name: 'Pokémon' };
const jeuTest: GameRef = { id: 'g-test', slug: 'jeu-test', name: 'Jeu Test' };
const category = (
  id: string,
  slug: string,
  name: string,
  parentId: string | null = null,
): CategoryRef => ({ id, slug, name, parentId });
const categories = [
  category('c-sealed', 'scelles', 'Produits scellés'),
  category('c-boosters', 'boosters', 'Boosters', 'c-sealed'),
  category('c-etb', 'etb', 'ETB', 'c-sealed'),
  category('c-acc', 'accessoires', 'Accessoires'),
];
const set = (id: string, slug: string, name: string): SetRef => ({
  id,
  slug,
  name,
  code: null,
  series: null,
  releaseDate: null,
  gameId: pokemon.id,
});
const braise = set('s-braise', 'terres-de-braise', 'Terres de Braise');
const vallees = set('s-vallees', 'vallees-oubliees', 'Vallées Oubliées');
const day = (n: number) => new Date(Date.UTC(2026, 8, n));
const group = (overrides: Partial<FactGroup>): FactGroup => ({
  gameId: pokemon.id,
  tcgSetId: null,
  categoryId: 'c-boosters',
  preorder: false,
  newArrival: false,
  inStock: true,
  languages: ['FR'],
  count: 1,
  lastModified: day(1),
  ...overrides,
});

test('arbre des catégories : lignée, agrégation et descendants sans boucle', () => {
  const lineage = categoryLineage(categories);
  assert.deepEqual(lineage.get('c-etb'), ['c-etb', 'c-sealed']);
  assert.deepEqual(lineage.get('c-acc'), ['c-acc']);
  const totals = aggregateOverTree(
    [
      ['c-boosters', 3],
      ['c-etb', 2],
      ['c-acc', 1],
    ],
    categories,
  );
  assert.equal(totals.get('c-sealed'), 5);
  assert.equal(totals.get('c-boosters'), 3);
  assert.equal(totals.get('c-acc'), 1);
  // Unknown categories (inactive chain) are not counted anywhere.
  assert.equal(aggregateOverTree([['ghost', 4]], categories).size, 0);
  assert.deepEqual(categoryDescendants(categories, 'c-sealed'), [
    'c-sealed',
    'c-boosters',
    'c-etb',
  ]);
  assert.deepEqual(categoryDescendants(categories, 'unknown'), []);
  const cycle = [
    { id: 'a', parentId: 'b' },
    { id: 'b', parentId: 'a' },
    { id: 'c', parentId: 'missing' },
  ];
  assert.deepEqual(categoryLineage(cycle).get('a'), ['a', 'b']);
  assert.deepEqual(categoryLineage(cycle).get('c'), ['c']);
  assert.deepEqual(categoryDescendants(cycle, 'a'), ['a', 'b']);
});

test('statuts : une précommande n’est jamais en stock', () => {
  assert.deepEqual(
    groupStatuses({ inStock: true, preorder: false, newArrival: true }),
    ['en-stock', 'nouveautes'],
  );
  assert.deepEqual(
    groupStatuses({ inStock: false, preorder: true, newArrival: false }),
    ['precommandes'],
  );
});

test('compteurs de landings : produits distincts sur l’arbre, langues et statuts', () => {
  const counters = countGameLandings(
    [
      group({ tcgSetId: braise.id, count: 2, languages: ['EN', 'FR'] }),
      group({
        tcgSetId: braise.id,
        categoryId: 'c-etb',
        languages: ['FR'],
        lastModified: day(9),
      }),
      group({ gameId: jeuTest.id, count: 5 }),
      group({ tcgSetId: 'other-game-set', preorder: true, inStock: false }),
      group({ languages: ['OTHER'], categoryId: 'ghost' }),
    ],
    {
      gameId: pokemon.id,
      setIds: new Set([braise.id]),
      lineage: categoryLineage(categories),
    },
  );
  const get = (key: string) => counters.get(key);
  assert.equal(get('|||')?.productCount, 5);
  assert.equal(get('|||')?.lastModified?.toISOString(), day(9).toISOString());
  assert.equal(get('s-braise|||')?.productCount, 3);
  assert.equal(get('|c-sealed||')?.productCount, 4);
  assert.equal(get('|c-boosters||')?.productCount, 3);
  assert.equal(get('s-braise|c-sealed||')?.productCount, 3);
  assert.equal(get('||EN|')?.productCount, 2);
  assert.equal(get('||FR|')?.productCount, 4);
  assert.equal(get('|c-sealed|FR|')?.productCount, 4);
  assert.equal(get('||OTHER|'), undefined);
  assert.equal(get('|||precommandes')?.productCount, 1);
  assert.equal(get('|||en-stock')?.productCount, 4);
  // A set of another game never becomes a facet of this game.
  assert.equal(get('other-game-set|||'), undefined);
  assert.deepEqual([...(get('||EN|')?.languages ?? [])], ['EN']);
});

test('landings indexables : seuils, doublons du parent ou de la liste transverse et collisions de slugs', () => {
  const groups = [
    group({ tcgSetId: braise.id, count: 2, languages: ['FR', 'EN'] }),
    group({ tcgSetId: braise.id, categoryId: 'c-etb', count: 1 }),
    group({ tcgSetId: vallees.id, count: 3, lastModified: day(12) }),
    group({
      tcgSetId: vallees.id,
      categoryId: 'c-etb',
      preorder: true,
      inStock: false,
      count: 2,
    }),
  ];
  const entries = indexGameLandings({
    game: pokemon,
    groups,
    sets: [braise, vallees],
    categories,
  });
  const paths = entries.map((entry) => entry.path);
  assert.ok(paths.includes('/pokemon'));
  assert.ok(paths.includes('/pokemon/terres-de-braise'));
  assert.ok(paths.includes('/pokemon/etb'));
  // Same products as the set: duplicate of the parent, never listed.
  assert.ok(!paths.includes('/pokemon/vallees-oubliees/scelles'));
  // Strictly fewer products than the set, at least 2: indexable pair.
  assert.ok(paths.includes('/pokemon/vallees-oubliees/boosters'));
  // Single product: below threshold.
  assert.ok(!paths.includes('/pokemon/terres-de-braise/etb'));
  // Every product in French: same as the hub.
  assert.ok(!paths.includes('/pokemon/francais'));
  assert.ok(paths.includes('/pokemon/precommandes'));
  // The game's preorders are all of the shop's: /precommandes stands for them.
  const preorders = (count: number) =>
    indexGameLandings({
      game: pokemon,
      groups,
      sets: [braise, vallees],
      categories,
      listingCounts: new Map([['precommandes', count]]),
    }).some((entry) => entry.path === '/pokemon/precommandes');
  assert.equal(preorders(2), false);
  assert.equal(preorders(3), true);
  assert.equal(entries[0]?.kind, 'game');
  assert.equal(
    entries
      .find((e) => e.path === '/pokemon/vallees-oubliees')
      ?.lastModified?.toISOString(),
    day(12).toISOString(),
  );
  // A set slug equal to a category slug resolves to the set: the category landing is skipped.
  const clash = indexGameLandings({
    game: pokemon,
    groups,
    sets: [braise, { ...vallees, slug: 'etb' }],
    categories,
  });
  assert.deepEqual(
    clash.filter((e) => e.path === '/pokemon/etb').map((e) => e.kind),
    ['set'],
  );
  assert.deepEqual(
    indexGameLandings({
      game: { ...pokemon, slug: 'catalogue' },
      groups,
      sets: [],
      categories,
    }),
    [],
  );
});

test('hubs /categorie : plusieurs jeux ou produits sans jeu', () => {
  const hubs = indexCategoryHubs({
    groups: [
      group({ categoryId: 'c-boosters', count: 2 }),
      group({ gameId: jeuTest.id, categoryId: 'c-boosters' }),
      group({ categoryId: 'c-etb', count: 3 }),
      group({ gameId: null, categoryId: 'c-acc', count: 1 }),
      group({ categoryId: 'c-acc', count: 1 }),
    ],
    categories,
    games: [pokemon, jeuTest],
  });
  assert.deepEqual(
    hubs.map((hub) => [hub.path, hub.productCount]),
    [
      ['/categorie/scelles', 6],
      ['/categorie/boosters', 3],
      ['/categorie/accessoires', 2],
    ],
  );
});

test('répartition : comptes par extension, catégorie agrégée, langue et statut', () => {
  const breakdown = breakdownFromRows(
    [
      { dimension: 'total', key: '', count: 4 },
      { dimension: 'set', key: 's-braise', count: 1 },
      { dimension: 'set', key: 's-vallees', count: 3 },
      { dimension: 'category', key: 'c-boosters', count: 3 },
      { dimension: 'category', key: 'c-etb', count: 1 },
      { dimension: 'language', key: 'JP', count: 1 },
      { dimension: 'language', key: 'FR', count: 4 },
      { dimension: 'status', key: 'en-stock', count: 2 },
    ],
    categories,
    [
      { ...vallees, releaseDate: day(1) },
      { ...braise, releaseDate: day(20) },
    ],
  );
  assert.equal(breakdown.productCount, 4);
  assert.deepEqual(
    breakdown.sets.map((s) => [s.slug, s.count]),
    [
      ['terres-de-braise', 1],
      ['vallees-oubliees', 3],
    ],
  );
  assert.deepEqual(
    breakdown.categories.map((c) => [c.slug, c.count]),
    [
      ['scelles', 4],
      ['boosters', 3],
      ['etb', 1],
    ],
  );
  assert.deepEqual(breakdown.languages, [
    { language: 'FR', count: 4 },
    { language: 'JP', count: 1 },
  ]);
  assert.deepEqual(breakdown.statuses, [
    { status: 'en-stock', count: 2 },
    { status: 'precommandes', count: 0 },
    { status: 'nouveautes', count: 0 },
  ]);
});

test('produits similaires : quotas par groupe, complément et aucun doublon', () => {
  const item = (id: string) => ({ id });
  assert.deepEqual(
    allocateSlots(
      [
        [item('a'), item('b'), item('c')],
        [item('b'), item('d')],
        [item('e'), item('f')],
      ],
      [2, 1, 1],
      4,
    ).map((x) => x.id),
    ['a', 'b', 'd', 'e'],
  );
  // Empty buckets leave their places to the others, in bucket order.
  assert.deepEqual(
    allocateSlots(
      [[], [item('d')], [item('e'), item('f'), item('g')]],
      [2, 1, 1],
      4,
    ).map((x) => x.id),
    ['d', 'e', 'f', 'g'],
  );
  assert.deepEqual(allocateSlots([[item('a')]], [2], 0), []);
});

test('filtres : les slugs inconnus sont ignorés', () => {
  const filters = parseCatalogParams({
    category: 'etb,inconnue',
    set: 'fantome',
  });
  const known = withKnownSlugs(filters, {
    categories: new Set(['etb']),
    sets: new Set(['terres-de-braise']),
  });
  assert.deepEqual(known.category, ['etb']);
  assert.deepEqual(known.set, []);
  const clean = parseCatalogParams({ category: 'etb' });
  assert.equal(
    withKnownSlugs(clean, { categories: new Set(['etb']), sets: new Set() }),
    clean,
  );
});

test('navigation : jeux avec hub indexable et familles en arbre', () => {
  const index: LandingIndex = {
    landings: [
      {
        path: '/pokemon',
        productCount: 9,
        lastModified: null,
      },
      {
        path: '/pokemon/scelles',
        productCount: 7,
        lastModified: null,
      },
      {
        path: '/pokemon/etb',
        productCount: 3,
        lastModified: null,
      },
      {
        path: '/pokemon/accessoires',
        productCount: 2,
        lastModified: null,
      },
      {
        path: '/jeu-test/scelles',
        productCount: 2,
        lastModified: null,
      },
    ],
    categoryHubs: [
      {
        path: '/categorie/accessoires',
        productCount: 4,
        lastModified: null,
      },
    ],
  };
  const full = categories.map((c, sortOrder) => ({
    ...c,
    description: null,
    intro: null,
    seoTitle: null,
    seoDescription: null,
    faq: [],
    imageUrl: null,
    sortOrder,
    updatedAt: day(1),
  }));
  const navigation = buildNavigation(
    index,
    [
      { ...pokemon, shortName: null },
      { ...jeuTest, shortName: 'Jeu Test' },
    ],
    full,
  );
  // Jeu Test has no indexable hub: absent from the menus.
  assert.deepEqual(
    navigation.games.map((g) => g.slug),
    ['pokemon'],
  );
  const families = navigation.games[0]!.families;
  assert.deepEqual(
    families.map((f) => [f.label, f.children.map((c) => c.href)]),
    [
      ['Produits scellés Pokémon', ['/pokemon/etb']],
      ['Accessoires Pokémon', []],
    ],
  );
  assert.deepEqual(
    navigation.categoryHubs.map((h) => [h.href, h.label]),
    [['/categorie/accessoires', 'Accessoires pour tous les jeux']],
  );
});
