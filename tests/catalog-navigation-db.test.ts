import 'dotenv/config';
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { getPrisma } from '../src/lib/db/prisma';
import { getCatalogProducts } from '../src/lib/catalog/getCatalogProducts';
import { getCatalogFacets } from '../src/lib/catalog/facets';
import {
  getCategories,
  getCategory,
  getExtension,
  getGameBySlug,
} from '../src/lib/catalog/taxonomy';
import {
  parseCatalogParams,
  CATALOG_PAGE_SIZE,
  type CatalogScope,
  type SearchParams,
} from '../src/lib/catalog/params';
import {
  catalogMetadata,
  catalogStateFromParams,
  isTrackingParam,
  listingMetadata,
} from '../src/lib/catalog/metadata';
import { getScopeStats, type RegistryScope } from '../src/lib/seo/registry';
import { absoluteUrl } from '../src/lib/site';
import {
  catalogItemListNode,
  catalogRobots,
  resolveCatalog,
} from '../src/components/catalog/catalogLoad';
import {
  LISTING_KINDS,
  getIndexableListings,
  getListingHub,
  listingScope,
  presentFamilies,
} from '../src/components/catalog/listingHub';
import { Prisma } from '../src/generated/prisma/client';
if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1'].includes(
    new URL(process.env.DATABASE_URL ?? 'invalid:').hostname,
  )
)
  throw new Error('Ces tests sont réservés à une base de développement.');
const db = getPrisma();
after(() => db.$disconnect());
const catalog = (params: SearchParams = {}, scope: CatalogScope = {}) =>
  getCatalogProducts(parseCatalogParams(params), scope);
const resolve = (searchParams: SearchParams, scope: CatalogScope = {}) =>
  resolveCatalog({ path: '/catalogue', searchParams, scope });
const etb = 'dev-etb-terres-de-braise';
const VISIBLE = 20;
const indexable = (canonicalPath: string) => ({
  index: true,
  reason: 'indexable',
  canonicalPath,
});

test('mêmes variantes pour langue, prix, stock et représentation publique', async () => {
  const fr = await catalog({ category: 'etb', language: 'FR' });
  assert.equal(fr.total, 1);
  assert.equal(fr.products[0]?.price, '59.90');
  assert.equal(fr.products[0]?.priceFrom, false);
  const en = await catalog({ category: 'etb', language: 'EN' });
  assert.equal(en.products[0]?.price, '54.90');
  assert.equal(en.products[0]?.availability, 'LOW_STOCK');
  const both = await catalog({ category: 'etb', language: 'FR,EN' });
  assert.equal(both.products[0]?.priceFrom, true);
  assert.equal(
    (await catalog({ category: 'etb', language: 'FR', maxPrice: '55' })).total,
    0,
  );
  assert.equal(
    (
      await catalog({
        category: 'etb',
        language: 'EN',
        availability: 'low-stock',
      })
    ).total,
    1,
  );
  assert.equal(
    (
      await catalog({
        category: 'etb',
        language: 'FR',
        availability: 'low-stock',
      })
    ).total,
    0,
  );
  assert.equal((await catalog({ category: 'etb', language: 'JP' })).total, 0);
  const json = JSON.stringify(fr);
  assert.ok(!/costPrice|stockQuantity|lowStockThreshold/.test(json));
});

test('filtres combinés, périmètres jeu / famille / statut et recherche littérale', async () => {
  assert.equal(
    (
      await catalog({
        type: 'ETB',
        set: 'dev-terres-de-braise',
        language: 'FR',
        minPrice: '20',
        maxPrice: '80',
        availability: 'in-stock',
      })
    ).products[0]?.slug,
    etb,
  );
  // Root families include their descendants; the game is its own axis.
  assert.equal((await catalog({}, { category: 'scelles' })).total, 17);
  assert.equal((await catalog({}, { game: 'pokemon' })).total, 16);
  assert.equal((await catalog({}, { game: 'lorcana' })).total, 3);
  assert.equal(
    (await catalog({ category: 'boosters' }, { game: 'lorcana' })).total,
    1,
  );
  assert.equal(
    (await catalog({ category: 'accessoires' }, { category: 'scelles' })).total,
    0,
  );
  assert.equal((await catalog({}, { category: 'pokemon' })).total, 0);

  // Unknown slugs are dropped from the effective filters, never matched.
  for (const params of [{ category: 'inconnue' }, { set: 'inconnue' }]) {
    const result = await catalog(params);
    assert.equal(result.total, VISIBLE);
    assert.deepEqual(result.filters.category, []);
    assert.deepEqual(result.filters.set, []);
  }
  const mixed = await catalog({ category: 'etb,inconnue' });
  assert.deepEqual(mixed.filters.category, ['etb']);
  assert.equal(mixed.total, 1);

  for (const scope of [
    { preorder: true },
    { status: 'precommandes' },
  ] as const) {
    const preorder = await catalog({}, scope);
    assert.equal(preorder.total, 4);
    assert.ok(preorder.products.every((p) => p.availability === 'PREORDER'));
  }
  for (const scope of [{ newArrival: true }, { status: 'nouveautes' }] as const)
    assert.equal((await catalog({}, scope)).total, 5);
  const inStock = await catalog({}, { status: 'en-stock' });
  assert.equal(inStock.total, 14);
  assert.ok(
    inStock.products.every((p) =>
      ['IN_STOCK', 'LOW_STOCK'].includes(p.availability),
    ),
  );

  assert.equal(
    (await catalog({ search: 'DEV-ETB-TERRES-DE-BRAISE' })).products[0]?.slug,
    etb,
  );
  assert.equal((await catalog({ search: 'non commercialisé' })).total, VISIBLE);
  assert.equal((await catalog({ search: '%' })).total, 0);
  assert.equal(await getCategory('inconnue'), null);
  assert.equal(await getExtension('inconnue'), null);
  assert.deepEqual(
    (await getCategory('etb'))?.ancestors.map((c) => c.slug),
    ['scelles'],
  );
});

test('pagination PostgreSQL, bornage, stabilité et tris par MIN du prix pertinent', async () => {
  const first = await catalog();
  const second = await catalog({ page: '2' });
  assert.equal(first.total, VISIBLE);
  assert.equal(first.products.length, CATALOG_PAGE_SIZE);
  assert.equal(second.products.length, VISIBLE - CATALOG_PAGE_SIZE);
  assert.equal(first.pageCount, 2);
  assert.equal(
    new Set([...first.products, ...second.products].map((p) => p.id)).size,
    VISIBLE,
  );
  assert.equal((await catalog({ page: '9999' })).page, 2);
  for (const sort of ['price-asc', 'price-desc']) {
    const a = await catalog({ sort, language: 'FR' }),
      b = await catalog({ sort, language: 'FR', page: '2' });
    const products = [...a.products, ...(a.pageCount > 1 ? b.products : [])];
    for (let i = 1; i < products.length; i++) {
      const comparison = new Prisma.Decimal(products[i - 1]!.price!).comparedTo(
        products[i]!.price!,
      );
      assert.ok(sort === 'price-asc' ? comparison <= 0 : comparison >= 0);
    }
    assert.equal(products.find((p) => p.slug === etb)?.price, '59.90');
  }
  for (const sort of ['recommended', 'newest', 'name-asc'])
    assert.equal((await catalog({ sort })).products.length, 12);
});

test('facettes : comptes réels du périmètre, options vides masquées', async () => {
  const facets = await getCatalogFacets({ category: 'etb' });
  assert.deepEqual(facets.languages, ['FR', 'EN']);
  assert.deepEqual(facets.counts.languages, { FR: 1, EN: 1 });
  assert.deepEqual(facets.types, ['ETB']);
  assert.equal(facets.sets.length, 1);
  assert.deepEqual(facets.categories, []);
  const all = await getCatalogFacets({});
  assert.ok(all.languages.includes('JP'));
  assert.deepEqual(
    all.categories.find((c) => c.slug === 'scelles'),
    { name: 'Produits scellés', slug: 'scelles', count: 17 },
  );
  assert.ok(all.categories.every((c) => c.count > 0));
  assert.ok(all.sets.every((s) => s.count > 0));
  // An upcoming set without product is never offered.
  assert.ok(!all.sets.some((s) => s.slug === 'dev-sentiers-d-opale'));
  assert.deepEqual(
    (await getCatalogFacets({ game: 'lorcana' })).sets.map((s) => s.slug),
    ['dev-brumes-de-cristal'],
  );
  const stock = await getCatalogFacets({ status: 'en-stock' });
  assert.equal(
    Object.values(stock.counts.types).reduce((sum, n) => sum + (n ?? 0), 0),
    14,
  );
});

test('liste et registre : mêmes produits pour chaque périmètre', async () => {
  const pokemon = await getGameBySlug('pokemon');
  assert.ok(pokemon);
  const scopes: [CatalogScope, RegistryScope][] = [
    [{}, {}],
    [{ status: 'en-stock' }, { status: 'en-stock' }],
    [{ status: 'precommandes' }, { status: 'precommandes' }],
    [{ status: 'nouveautes' }, { status: 'nouveautes' }],
    [{ game: 'pokemon' }, { game: pokemon }],
    [
      { game: 'pokemon', status: 'en-stock' },
      { game: pokemon, status: 'en-stock' },
    ],
    [
      { game: 'pokemon', language: 'EN' },
      { game: pokemon, language: 'EN' },
    ],
  ];
  for (const [catalogScope, registryScope] of scopes)
    assert.equal(
      (await catalog({}, catalogScope)).total,
      (await getScopeStats(registryScope)).productCount,
      JSON.stringify(catalogScope),
    );
});

test('URL canonique : 308 vers la requête normalisée, suivi publicitaire ignoré', async () => {
  const plain = await resolve({});
  assert.equal(plain.redirectTo, null);
  assert.equal(plain.load.query, '');
  assert.equal(plain.load.hasRefinements, false);

  // Tracking only: same page, same canonical, no redirect.
  for (const key of [
    'utm_source',
    'UTM_Medium',
    'gclid',
    'fbclid',
    'msclkid',
    'dclid',
    'gbraid',
    'wbraid',
    '_gl',
    'mc_cid',
    'mc_eid',
  ])
    assert.ok(isTrackingParam(key), key);
  assert.ok(!isTrackingParam('page'));
  const tracked = await resolve({
    utm_source: 'lettre',
    utm_campaign: ['a', 'b'],
    gclid: 'x',
  });
  assert.equal(tracked.redirectTo, null);
  assert.equal(tracked.load.query, '');
  assert.equal(tracked.load.total, VISIBLE);

  // Unknown slugs, invalid values, page 1 and out of range: canonical query.
  assert.equal(
    (await resolve({ category: 'inconnue' })).redirectTo,
    '/catalogue',
  );
  assert.equal(
    (await resolve({ category: 'etb,inconnue' })).redirectTo,
    '/catalogue?category=etb',
  );
  assert.equal((await resolve({ page: '1' })).redirectTo, '/catalogue');
  assert.equal(
    (await resolve({ page: '9999' })).redirectTo,
    '/catalogue?page=2',
  );
  assert.equal(
    (await resolve({ sort: 'inconnu', search: '', ref: 'x' })).redirectTo,
    '/catalogue',
  );
  // Another cause of redirect keeps the campaign parameters.
  assert.equal(
    (await resolve({ sort: 'inconnu', utm_source: 'lettre' })).redirectTo,
    '/catalogue?utm_source=lettre',
  );
  assert.equal(
    (await resolve({ minPrice: '80', maxPrice: '20' })).redirectTo,
    '/catalogue?minPrice=20.00&maxPrice=80.00',
  );

  // Canonical queries in any parameter order answer directly.
  const filtered = await resolve({ language: 'FR', category: 'etb' });
  assert.equal(filtered.redirectTo, null);
  assert.equal(filtered.load.query, 'category=etb&language=FR');
  assert.equal(filtered.load.hasRefinements, true);
  assert.equal(filtered.load.total, 1);

  const paged = await resolve({ page: '2' });
  assert.equal(paged.redirectTo, null);
  assert.equal(paged.load.page, 2);
  assert.equal(paged.load.hasRefinements, false);
  assert.equal(
    (await resolve({ sort: 'price-asc' })).load.hasRefinements,
    true,
  );

  // ItemList: the products shown, positions continued from page 1.
  const items = catalogItemListNode(paged.load);
  assert.equal(items?.numberOfItems, VISIBLE - CATALOG_PAGE_SIZE);
  const list = items?.itemListElement as { position: number; url: string }[];
  assert.equal(list[0]?.position, CATALOG_PAGE_SIZE + 1);
  assert.equal(
    list[0]?.url,
    absoluteUrl(`/produit/${paged.load.result.products[0]?.slug}`),
  );
  assert.equal(
    catalogItemListNode((await resolve({ search: 'introuvable' })).load),
    null,
  );
});

test('robots des listes : raffinement noindex self-canonical, pagination indexable', async () => {
  const base = indexable('/catalogue');
  const { load: filtered } = await resolve({ category: 'etb', language: 'FR' });
  assert.deepEqual(catalogRobots(filtered, base), {
    index: false,
    reason: 'filtered',
    canonicalPath: '/catalogue?category=etb&language=FR',
  });
  // Never noindex with a canonical to another URL, even from a duplicate base.
  const duplicate = {
    index: false,
    reason: 'duplicate-of-parent',
    canonicalPath: '/pokemon',
  };
  assert.equal(
    catalogRobots(filtered, duplicate).canonicalPath,
    '/catalogue?category=etb&language=FR',
  );
  const { load: paged } = await resolve({ page: '2' });
  const pagedDecision = catalogRobots(paged, base);
  assert.deepEqual(pagedDecision, indexable('/catalogue?page=2'));
  assert.deepEqual(catalogRobots(paged, pagedDecision), pagedDecision);
  assert.equal(
    catalogRobots(paged, duplicate).canonicalPath,
    '/pokemon?page=2',
  );
  const thin = {
    index: false,
    reason: 'below-threshold',
    canonicalPath: '/nouveautes',
  };
  assert.deepEqual(catalogRobots(paged, thin), {
    ...thin,
    canonicalPath: '/nouveautes?page=2',
  });
  const { load: tracked } = await resolve({ utm_source: 'lettre' });
  assert.deepEqual(catalogRobots(tracked, base), base);

  const metadata = (params: SearchParams) =>
    listingMetadata({
      state: catalogStateFromParams('/catalogue', params),
      title: 'Catalogue Pokémon',
      description: 'Catalogue Pokémon : 20 produits.',
      decision: base,
    });
  const first = metadata({ utm_source: 'lettre' });
  assert.equal(first.title, 'Catalogue Pokémon');
  assert.deepEqual(first.robots, { index: true, follow: true });
  assert.equal(first.alternates?.canonical, absoluteUrl('/catalogue'));
  const second = metadata({ page: '2' });
  assert.equal(second.title, 'Catalogue Pokémon – page 2');
  assert.deepEqual(second.robots, { index: true, follow: true });
  assert.equal(second.alternates?.canonical, absoluteUrl('/catalogue?page=2'));
  const sorted = metadata({ sort: 'price-asc', gclid: 'x' });
  assert.deepEqual(sorted.robots, { index: false, follow: true });
  assert.equal(
    sorted.alternates?.canonical,
    absoluteUrl('/catalogue?sort=price-asc'),
  );

  // Compatibility wrapper: no brand suffix (layout template), same rules.
  const legacy = catalogMetadata(
    'ETB',
    'Coffrets Dresseur d’élite.',
    '/categorie/etb',
    {
      language: 'FR',
    },
  );
  assert.equal(legacy.title, 'ETB');
  assert.deepEqual(legacy.robots, { index: false, follow: true });
  assert.equal(
    legacy.alternates?.canonical,
    absoluteUrl('/categorie/etb?language=FR'),
  );
  assert.deepEqual(catalogMetadata('ETB', 'x', '/categorie/etb').robots, {
    index: true,
    follow: true,
  });
});

test('hubs transverses : titres, chiffres et indexation issus des données', async () => {
  const expected = {
    catalogue: 20,
    nouveautes: 5,
    precommandes: 4,
    'en-stock': 14,
  } as const;
  const listings = await getIndexableListings();
  for (const listing of LISTING_KINDS) {
    const hub = await getListingHub(listing);
    const { load } = await resolveCatalog({
      path: hub.config.path,
      searchParams: {},
      scope: listingScope(listing),
    });
    assert.equal(hub.stats.productCount, expected[listing], listing);
    assert.equal(load.total, hub.stats.productCount, listing);
    assert.deepEqual(hub.decision, indexable(hub.config.path));
    assert.equal(listings.get(listing), expected[listing]);
    assert.equal(
      hub.games.games.reduce((sum, game) => sum + game.count, 0) +
        hub.games.gamelessCount,
      hub.stats.productCount,
    );
    for (const text of [hub.heading, hub.text.title, hub.text.description])
      assert.doesNotMatch(text, /Caldera|Découvrez|large sélection/);
    assert.ok(hub.text.title.length <= 60, hub.text.title);
    assert.ok(hub.text.description.length <= 160);
    assert.ok(hub.text.title.startsWith(hub.heading));
  }
  const precommandes = await getListingHub('precommandes');
  assert.equal(precommandes.heading, 'Précommandes Pokémon et [Démo] Lorcana');
  assert.match(
    precommandes.text.description,
    /4 produits de 6,90\s€ à 149,90\s€/,
  );
  assert.doesNotMatch(precommandes.text.description, /en précommande/);
  const stock = await getListingHub('en-stock');
  assert.equal(stock.heading, 'Pokémon et [Démo] Lorcana en stock');
  assert.equal(stock.stats.preorderCount, 0);
  assert.equal(stock.games.gamelessCount, 1);
  assert.deepEqual(
    (await getListingHub('catalogue')).games.games.map(({ game, count }) => [
      game.slug,
      count,
    ]),
    [
      ['pokemon', 16],
      ['lorcana', 3],
    ],
  );

  // Most specific families only, most products first.
  const categories = await getCategories();
  assert.deepEqual(
    presentFamilies(
      {
        categories: [
          { name: 'Produits scellés', slug: 'scelles', count: 5 },
          { name: 'Boosters', slug: 'boosters', count: 2 },
          { name: 'ETB', slug: 'etb', count: 3 },
          { name: 'Accessoires', slug: 'accessoires', count: 1 },
        ],
      },
      categories,
    ).map((family) => family.slug),
    ['etb', 'boosters', 'accessoires'],
  );
});
