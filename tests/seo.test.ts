import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JsonLd } from '../src/components/seo/JsonLd';
import {
  isReservedFacetSlug,
  isReservedRootSlug,
  landingKind,
  landingPath,
  parentScopes,
  parseLandingSegments,
  type LandingLookup,
} from '../src/lib/seo/facets';
import {
  decideCategoryHubIndexation,
  decideLandingIndexation,
  decideListingIndexation,
  decideProductIndexation,
  filteredDecision,
  isNotFoundDecision,
  paginationDecision,
} from '../src/lib/seo/indexation';
import {
  breadcrumbListNode,
  breadcrumbTrail,
  graph,
  gtinProperty,
  organizationId,
  productNode,
  serializeJsonLd,
  websiteNode,
  type JsonLdNode,
  type ProductJsonLdInput,
  organizationNode,
} from '../src/lib/seo/jsonld';
import {
  buildMetadata,
  categoryHubText,
  formatDateFr,
  formatEuro,
  gameMetadataText,
  landingMetadataText,
  listingText,
  paginatedText,
  productMetadataText,
  truncateAtWord,
} from '../src/lib/seo/metadata';
import { LEGAL_IDENTITY } from '../src/lib/seo/policies';
import { absoluteUrl } from '../src/lib/site';
import type {
  CategoryRef,
  GameRef,
  LandingScope,
  ScopeStats,
  SetRef,
} from '../src/lib/seo/types';

const NBSP = '\u00a0';
const ORIGIN = 'https://lesterresdecaldera.fr';

const game: GameRef = { id: 'g1', slug: 'pokemon', name: 'Pokémon' };
const set: SetRef = {
  id: 's1',
  slug: 'flammes-obsidiennes',
  name: 'Flammes Obsidiennes',
  code: 'OBF',
  series: 'Écarlate et Violet',
  releaseDate: new Date('2026-11-14T00:00:00.000Z'),
  gameId: 'g1',
};
const category: CategoryRef = {
  id: 'c1',
  slug: 'boosters',
  name: 'Boosters',
  parentId: null,
};
const etb: CategoryRef = {
  id: 'c2',
  slug: 'etb',
  name: 'ETB',
  parentId: null,
};
const lookup: LandingLookup = {
  sets: new Map([[set.slug, set]]),
  categories: new Map([
    [category.slug, category],
    [etb.slug, etb],
  ]),
};

function stats(overrides: Partial<ScopeStats> = {}): ScopeStats {
  return {
    productCount: 0,
    inStockCount: 0,
    preorderCount: 0,
    newArrivalCount: 0,
    minPrice: null,
    maxPrice: null,
    languages: [],
    lastModified: null,
    ...overrides,
  };
}

function withSiteUrl<T>(value: string | undefined, run: () => T): T {
  const env = process.env as Record<string, string | undefined>;
  const saved = env.SITE_URL;
  try {
    env.SITE_URL = value;
    return run();
  } finally {
    env.SITE_URL = saved;
  }
}

test('URL des landings : ordre canonique et encodage', () => {
  assert.equal(landingPath({ game }), '/pokemon');
  assert.equal(
    landingPath({ game, set, category }),
    '/pokemon/flammes-obsidiennes/boosters',
  );
  assert.equal(
    landingPath({ game, category, status: 'precommandes' }),
    '/pokemon/boosters/precommandes',
  );
  assert.equal(
    landingPath({ game, set, language: 'JP' }),
    '/pokemon/flammes-obsidiennes/japonais',
  );
  assert.equal(
    landingPath({ game: { ...game, slug: 'jeu é' } }),
    '/jeu%20%C3%A9',
  );
  assert.equal(
    landingKind({ game, category, language: 'FR' }),
    'category-language',
  );
  assert.throws(() =>
    landingPath({ game, language: 'FR', status: 'en-stock' }),
  );
  assert.throws(() => landingKind({ game, set, category, language: 'FR' }));
});

test('segments de facettes : ok, redirection d’ordre, 404', () => {
  assert.deepEqual(parseLandingSegments(['flammes-obsidiennes'], lookup), {
    type: 'ok',
    scope: { set },
  });
  assert.deepEqual(parseLandingSegments(['boosters', 'japonais'], lookup), {
    type: 'ok',
    scope: { category, language: 'JP' },
  });
  assert.deepEqual(parseLandingSegments(['en-stock'], lookup), {
    type: 'ok',
    scope: { status: 'en-stock' },
  });
  // Valid facets in a non canonical order: redirect to the canonical order.
  assert.deepEqual(
    parseLandingSegments(['boosters', 'flammes-obsidiennes'], lookup),
    { type: 'redirect', segments: ['flammes-obsidiennes', 'boosters'] },
  );
  assert.deepEqual(parseLandingSegments(['precommandes', 'etb'], lookup), {
    type: 'redirect',
    segments: ['etb', 'precommandes'],
  });
  const notFound = { type: 'not-found' };
  // Forbidden combination, in any order.
  assert.deepEqual(
    parseLandingSegments(['japonais', 'en-stock'], lookup),
    notFound,
  );
  assert.deepEqual(
    parseLandingSegments(['en-stock', 'japonais'], lookup),
    notFound,
  );
  // Unknown slug, duplicate dimension, three facets, nothing.
  assert.deepEqual(parseLandingSegments(['inconnu'], lookup), notFound);
  assert.deepEqual(
    parseLandingSegments(['boosters', 'inconnu'], lookup),
    notFound,
  );
  assert.deepEqual(parseLandingSegments(['boosters', 'etb'], lookup), notFound);
  assert.deepEqual(
    parseLandingSegments(['francais', 'japonais'], lookup),
    notFound,
  );
  assert.deepEqual(
    parseLandingSegments(
      ['flammes-obsidiennes', 'boosters', 'japonais'],
      lookup,
    ),
    notFound,
  );
  assert.deepEqual(parseLandingSegments([], lookup), notFound);
});

test('parents directs et slugs réservés', () => {
  assert.deepEqual(parentScopes({ game }), []);
  assert.deepEqual(parentScopes({ game, set }), [{ game }]);
  assert.deepEqual(parentScopes({ game, set, category }), [
    { game, set },
    { game, category },
  ]);
  assert.deepEqual(parentScopes({ game, category, status: 'en-stock' })[0], {
    game,
    category,
  });
  for (const slug of [
    'admin',
    'produit',
    'api',
    '_next',
    'en-stock',
    'guides',
    'sitemap.xml',
    'Catalogue',
  ])
    assert.equal(isReservedRootSlug(slug), true, slug);
  assert.equal(isReservedRootSlug('pokemon'), false);
  for (const slug of [
    'francais',
    'japonais',
    'precommandes',
    'nouveautes',
    'en-stock',
  ])
    assert.equal(isReservedFacetSlug(slug), true, slug);
  assert.equal(isReservedFacetSlug('boosters'), false);
});

test('indexation : hub jeu et facettes entité', () => {
  assert.deepEqual(
    decideLandingIndexation({
      scope: { game },
      stats: stats({ productCount: 1 }),
    }),
    { index: true, reason: 'indexable', canonicalPath: '/pokemon' },
  );
  assert.deepEqual(
    decideLandingIndexation({ scope: { game }, stats: stats() }),
    {
      index: false,
      reason: 'empty',
      canonicalPath: '/pokemon',
    },
  );
  const setPath = '/pokemon/flammes-obsidiennes';
  const decide = (productCount: number, entityExists?: boolean) =>
    decideLandingIndexation({
      scope: { game, set },
      stats: stats({ productCount }),
      parentStats: stats({ productCount: 50 }),
      entityExists,
    });
  assert.deepEqual(decide(2), {
    index: true,
    reason: 'indexable',
    canonicalPath: setPath,
  });
  assert.deepEqual(decide(1), {
    index: false,
    reason: 'below-threshold',
    canonicalPath: setPath,
  });
  // Upcoming set without product: 200 noindex, self canonical.
  assert.deepEqual(decide(0), {
    index: false,
    reason: 'empty',
    canonicalPath: setPath,
  });
  assert.equal(isNotFoundDecision(decide(0)), false);
  assert.equal(isNotFoundDecision(decide(0, false)), true);
  // An entity facet equal to the game hub stays indexable (no strict rule).
  assert.equal(
    decideLandingIndexation({
      scope: { game, category },
      stats: stats({ productCount: 50 }),
      parentStats: stats({ productCount: 50 }),
    }).index,
    true,
  );
});

test('indexation : facettes filtre et combinaisons', () => {
  const hub = stats({ productCount: 10 });
  const japanese = (productCount: number) =>
    decideLandingIndexation({
      scope: { game, language: 'JP' },
      stats: stats({ productCount }),
      parentStats: hub,
    });
  assert.deepEqual(japanese(4), {
    index: true,
    reason: 'indexable',
    canonicalPath: '/pokemon/japonais',
  });
  // Same products as the game hub: canonical to the hub, never noindex + cross canonical.
  assert.deepEqual(japanese(10), {
    index: false,
    reason: 'duplicate-of-parent',
    canonicalPath: '/pokemon',
  });
  assert.deepEqual(japanese(1), {
    index: false,
    reason: 'below-threshold',
    canonicalPath: '/pokemon/japonais',
  });
  assert.equal(japanese(0).reason, 'empty-combination');
  assert.equal(isNotFoundDecision(japanese(0)), true);

  const setCategory = (productCount: number, parentCount: number) =>
    decideLandingIndexation({
      scope: { game, set, category },
      stats: stats({ productCount }),
      parentStats: stats({ productCount: parentCount }),
    });
  assert.equal(setCategory(3, 5).index, true);
  assert.deepEqual(setCategory(5, 5), {
    index: false,
    reason: 'duplicate-of-parent',
    canonicalPath: '/pokemon/flammes-obsidiennes',
  });
  assert.equal(setCategory(0, 5).reason, 'empty-combination');

  const categoryStatus = decideLandingIndexation({
    scope: { game, category, status: 'en-stock' },
    stats: stats({ productCount: 6 }),
    parentStats: stats({ productCount: 6 }),
    parentPath: '/pokemon/boosters',
  });
  assert.equal(categoryStatus.canonicalPath, '/pokemon/boosters');
  // Every new arrival of the shop is of this game: /nouveautes lists the same.
  const arrivals = (listingCount: number) =>
    decideLandingIndexation({
      scope: { game, status: 'nouveautes' },
      stats: stats({ productCount: 4 }),
      parentStats: hub,
      listingStats: stats({ productCount: listingCount }),
    });
  assert.deepEqual(arrivals(4), {
    index: false,
    reason: 'duplicate-of-listing',
    canonicalPath: '/nouveautes',
  });
  assert.deepEqual(arrivals(5), {
    index: true,
    reason: 'indexable',
    canonicalPath: '/pokemon/nouveautes',
  });
  // Only a status alone has a transverse listing.
  assert.equal(
    decideLandingIndexation({
      scope: { game, category, status: 'nouveautes' },
      stats: stats({ productCount: 3 }),
      parentStats: stats({ productCount: 6 }),
      listingStats: stats({ productCount: 3 }),
    }).index,
    true,
  );
  assert.equal(
    decideLandingIndexation({
      scope: { game, set, language: 'FR' },
      stats: stats({ productCount: 2 }),
      parentStats: stats({ productCount: 3 }),
    }).index,
    true,
  );
  assert.throws(() =>
    decideLandingIndexation({
      scope: { game, status: 'nouveautes' },
      stats: stats({ productCount: 3 }),
    }),
  );
});

test('indexation : hub famille, hubs transverses, produit, filtres', () => {
  const path = '/categorie/boosters';
  const hub = (
    distinctGames: number,
    hasGamelessProducts: boolean,
    productCount = 8,
  ) =>
    decideCategoryHubIndexation({
      path,
      stats: stats({ productCount }),
      distinctGames,
      hasGamelessProducts,
      singleGamePath: '/pokemon/boosters',
    });
  assert.deepEqual(hub(2, false), {
    index: true,
    reason: 'indexable',
    canonicalPath: path,
  });
  assert.equal(hub(0, true).index, true);
  assert.deepEqual(hub(1, false), {
    index: false,
    reason: 'single-game',
    canonicalPath: '/pokemon/boosters',
  });
  assert.deepEqual(hub(2, false, 1), {
    index: false,
    reason: 'below-threshold',
    canonicalPath: path,
  });

  assert.equal(
    decideListingIndexation({
      path: '/catalogue',
      stats: stats({ productCount: 1 }),
      min: 1,
    }).index,
    true,
  );
  assert.equal(
    decideListingIndexation({
      path: '/precommandes',
      stats: stats({ productCount: 1 }),
    }).index,
    false,
  );
  assert.equal(
    decideListingIndexation({
      path: '/nouveautes',
      stats: stats({ productCount: 2 }),
    }).index,
    true,
  );
  assert.deepEqual(
    decideListingIndexation({
      path: '/catalogue?sort=price-asc',
      stats: stats({ productCount: 30 }),
      filtered: true,
    }),
    filteredDecision('/catalogue?sort=price-asc'),
  );

  const product = '/produit/display-flammes-obsidiennes';
  assert.equal(
    decideProductIndexation({
      status: 'ACTIVE',
      hasActiveVariant: true,
      path: product,
    }).index,
    true,
  );
  assert.equal(
    decideProductIndexation({
      status: 'ACTIVE',
      hasActiveVariant: false,
      path: product,
    }).reason,
    'no-active-variant',
  );
  assert.equal(
    decideProductIndexation({
      status: 'ACTIVE',
      hasActiveVariant: true,
      path: product,
      parentsActive: false,
    }).index,
    false,
  );
  assert.equal(
    decideProductIndexation({
      status: 'ARCHIVED',
      hasActiveVariant: true,
      path: product,
    }).reason,
    'archived',
  );
  assert.equal(
    isNotFoundDecision(
      decideProductIndexation({
        status: 'DRAFT',
        hasActiveVariant: true,
        path: product,
      }),
    ),
    true,
  );
});

test('pagination : self-canonical si indexable, noindex sinon', () => {
  const indexable = {
    index: true,
    reason: 'indexable',
    canonicalPath: '/pokemon/boosters',
  };
  assert.deepEqual(paginationDecision(indexable, 3), {
    index: true,
    reason: 'indexable',
    canonicalPath: '/pokemon/boosters?page=3',
  });
  assert.equal(paginationDecision(indexable, 1), indexable);
  assert.equal(paginationDecision(indexable, Number.NaN), indexable);
  const thin = {
    index: false,
    reason: 'below-threshold',
    canonicalPath: '/nouveautes',
  };
  assert.deepEqual(paginationDecision(thin, 2), {
    index: false,
    reason: 'below-threshold',
    canonicalPath: '/nouveautes?page=2',
  });
  const metadata = buildMetadata({
    title: 'Nouveautés',
    description: 'x',
    path: '/nouveautes?page=2',
    index: false,
    canonicalPath: '/nouveautes?page=2',
  });
  assert.deepEqual(metadata.robots, { index: false, follow: true });
  assert.equal(metadata.alternates?.canonical, `${ORIGIN}/nouveautes?page=2`);
});

test('buildMetadata : canonical absolu, robots, Open Graph et Twitter', () =>
  withSiteUrl(undefined, () => {
    const metadata = buildMetadata({
      title: 'Boosters Pokémon',
      description: 'Boosters Pokémon : 12 produits.',
      path: '/pokemon/boosters',
      index: true,
    });
    assert.equal(metadata.title, 'Boosters Pokémon');
    assert.equal(metadata.alternates?.canonical, `${ORIGIN}/pokemon/boosters`);
    assert.deepEqual(metadata.robots, { index: true, follow: true });
    assert.deepEqual(metadata.openGraph, {
      type: 'website',
      locale: 'fr_FR',
      siteName: 'Les Terres de Caldera',
      title: 'Boosters Pokémon',
      description: 'Boosters Pokémon : 12 produits.',
      url: `${ORIGIN}/pokemon/boosters`,
      images: [
        {
          url: `${ORIGIN}/assets/brand/logo-header.png`,
          alt: 'Les Terres de Caldera',
          width: 1916,
          height: 821,
        },
      ],
    });
    assert.equal(
      (metadata.twitter as { card?: string } | undefined)?.card,
      'summary_large_image',
    );
    assert.deepEqual(
      buildMetadata({
        title: 'Accueil',
        description: 'x',
        path: '/',
        index: true,
        absoluteTitle: true,
      }).title,
      { absolute: 'Accueil' },
    );
    // Duplicate page: canonical to the parent, never combined with noindex.
    const duplicate = buildMetadata({
      title: 'Pokémon en français',
      description: 'x',
      path: '/pokemon/francais',
      index: false,
      canonicalPath: '/pokemon',
    });
    assert.equal(duplicate.alternates?.canonical, `${ORIGIN}/pokemon`);
    assert.deepEqual(duplicate.robots, { index: true, follow: true });
    assert.deepEqual(
      buildMetadata({
        title: 't',
        description: 'd',
        path: '/pokemon',
        index: false,
      }).robots,
      { index: false, follow: true },
    );
  }));

test('absoluteUrl suit SITE_URL et garde les URL absolues', () => {
  withSiteUrl('http://localhost:3000', () => {
    assert.equal(absoluteUrl('/produit/x'), 'http://localhost:3000/produit/x');
    assert.equal(absoluteUrl('/'), 'http://localhost:3000/');
  });
  withSiteUrl('ftp://invalide', () =>
    assert.equal(absoluteUrl('/cgv'), `${ORIGIN}/cgv`),
  );
  assert.equal(
    absoluteUrl('https://blob.example.com/a.png'),
    'https://blob.example.com/a.png',
  );
});

test('formats français et coupe au mot', () => {
  assert.equal(formatEuro('54.90'), `54,90${NBSP}€`);
  assert.equal(formatEuro('1234.5'), `1${NBSP}234,50${NBSP}€`);
  assert.equal(
    formatDateFr(new Date('2026-11-14T00:00:00.000Z')),
    '14 novembre 2026',
  );
  assert.equal(formatDateFr('2027-03-01'), '1er mars 2027');
  const long = 'mot '.repeat(60).trim();
  const cut = truncateAtWord(long, 160);
  assert.ok(cut.length <= 160);
  assert.ok(cut.endsWith('mot…'));
  assert.equal(truncateAtWord('court', 160), 'court');
  assert.equal(
    truncateAtWord('Une phrase. Une autre phrase longue', 20),
    'Une phrase. Une…',
  );
  assert.equal(
    truncateAtWord('Une phrase. Une autre phrase longue', 12),
    'Une phrase.',
  );
});

const fullStats = stats({
  productCount: 12,
  inStockCount: 9,
  preorderCount: 3,
  minPrice: '5.90',
  maxPrice: '189.90',
  languages: ['FR', 'JP', 'OTHER'],
});

test('metadata des landings : faits réels, longueurs, aucune formule creuse', () => {
  const hub = gameMetadataText({
    game,
    stats: fullStats,
    availableCategoryNames: ['Boosters', 'ETB', 'Coffrets', 'Displays'],
  });
  // Never « en stock » in the hub title: not every family listed is in stock.
  assert.equal(hub.title, 'Pokémon : boosters, ETB et coffrets');
  assert.equal(
    hub.description,
    `Pokémon : 12 produits de 5,90${NBSP}€ à 189,90${NBSP}€. 9 en stock, 3 en précommande. Langues : français et japonais.`,
  );

  const cases: [LandingScope, string][] = [
    // « boosters et ETB » would exceed 60 characters.
    [{ game, set }, 'Flammes Obsidiennes (Pokémon) : boosters – prix et stock'],
    [{ game, category }, 'Boosters Pokémon : prix et disponibilité'],
    [
      { game, set, category },
      'Boosters Pokémon Flammes Obsidiennes – prix et stock',
    ],
    [{ game, language: 'JP' }, 'Pokémon en japonais : boosters et ETB'],
    [{ game, category, language: 'JP' }, 'Boosters Pokémon en japonais'],
    [
      { game, status: 'precommandes' },
      'Précommandes Pokémon : boosters et ETB',
    ],
    [{ game, status: 'nouveautes' }, 'Nouveautés Pokémon : boosters et ETB'],
    [{ game, category, status: 'en-stock' }, 'Boosters Pokémon en stock'],
    [
      { game, category, status: 'precommandes' },
      'Précommandes boosters Pokémon',
    ],
    [
      { game, set, status: 'nouveautes' },
      'Nouveautés Pokémon Flammes Obsidiennes',
    ],
    [{ game, set, language: 'FR' }, 'Pokémon Flammes Obsidiennes en français'],
  ];
  for (const [scope, title] of cases) {
    const text = landingMetadataText(scope, landingKind(scope), fullStats, [
      'Boosters',
      'ETB',
    ]);
    assert.equal(text.title, title);
    assert.ok(text.title.length <= 60, text.title);
    assert.ok(text.description.length <= 160, text.description);
    assert.doesNotMatch(
      text.description,
      /découvrez|large sélection|meilleur/i,
    );
  }

  // The set title keeps the families that fit within 60 characters.
  const longSet = {
    ...set,
    name: 'Écarlate et Violet – Évolutions Prismatiques',
  };
  const longTitle = landingMetadataText(
    { game, set: longSet },
    'set',
    fullStats,
    ['Boosters', 'ETB', 'Coffrets'],
  ).title;
  assert.ok(
    longTitle.length <= 60 || longTitle === `${longSet.name} (Pokémon)`,
  );

  // Game name already in the set name: not repeated.
  const set151 = { ...set, name: 'Pokémon 151', slug: 'pokemon-151' };
  assert.equal(
    landingMetadataText(
      { game, set: set151, category },
      'set-category',
      fullStats,
    ).title,
    'Boosters Pokémon 151 – prix et stock',
  );

  // Upcoming set without product: release date, no price or stock claim.
  const upcoming = landingMetadataText({ game, set }, 'set', stats());
  assert.equal(
    upcoming.title,
    'Flammes Obsidiennes (Pokémon) : sortie le 14 novembre 2026',
  );
  assert.doesNotMatch(upcoming.description, /€|en stock|précommande/);
  assert.match(upcoming.description, /Sortie : 14 novembre 2026\./);

  // Overrides win.
  assert.deepEqual(
    landingMetadataText({ game, category }, 'category', fullStats, [], {
      seoTitle: '  Boosters Pokémon au détail ',
      seoDescription: 'Texte relu.',
    }),
    { title: 'Boosters Pokémon au détail', description: 'Texte relu.' },
  );
});

test('metadata : hub famille, hubs transverses et pagination', () => {
  const hub = categoryHubText({
    name: 'Boosters',
    stats: fullStats,
    gameNames: ['Pokémon', 'Jeu Test'],
  });
  assert.equal(hub.title, 'Boosters Pokémon et Jeu Test');
  assert.match(hub.description, /^Boosters : 12 produits/);

  const preorders = listingText({
    listing: 'precommandes',
    stats: fullStats,
    gameNames: ['Pokémon'],
    availableCategoryNames: ['Displays', 'ETB'],
  });
  assert.equal(preorders.title, 'Précommandes Pokémon : displays et ETB');
  assert.doesNotMatch(preorders.description, /en précommande/);
  assert.equal(
    listingText({ listing: 'en-stock', stats: fullStats }).title,
    'Produits en stock',
  );

  const page = paginatedText(preorders, 3);
  assert.equal(page.title, 'Précommandes Pokémon : displays et ETB – page 3');
  assert.match(page.description, /^Page 3 – /);
  assert.ok(page.description.length <= 160);
  assert.equal(paginatedText(preorders, 1), preorders);
});

test('metadata produit : pas de mot répété, pas d’affirmation sans donnée', () => {
  const display = productMetadataText({
    name: 'Display Flammes Obsidiennes',
    categoryName: 'Displays',
    setName: 'Flammes Obsidiennes',
    gameName: 'Pokémon',
    languages: ['JP'],
    price: '189.90',
    availability: 'IN_STOCK',
    preorder: false,
  });
  assert.equal(
    display.title,
    'Display Flammes Obsidiennes – Pokémon (japonais)',
  );
  assert.equal(
    display.description,
    `Display Flammes Obsidiennes (Pokémon) à 189,90${NBSP}€. En stock. Langue : japonais.`,
  );

  const booster = productMetadataText({
    name: 'Booster Pokémon',
    categoryName: 'Boosters',
    setName: 'Flammes Obsidiennes',
    gameName: 'Pokémon',
    languages: ['FR', 'EN'],
    price: '5.90',
    priceFrom: true,
    availability: 'PREORDER',
    preorder: true,
    releaseDate: new Date('2026-11-14T00:00:00.000Z'),
  });
  assert.equal(booster.title, 'Booster Pokémon – Flammes Obsidiennes');
  assert.match(booster.description, /dès 5,90/);
  assert.match(
    booster.description,
    /En précommande, sortie le 14 novembre 2026\./,
  );
  assert.match(booster.description, /Langues : français et anglais\./);

  // Language already in the name: no « (japonais) » suffix.
  assert.equal(
    productMetadataText({
      name: 'Booster japonais Terastal Festival',
      gameName: 'Pokémon',
      languages: ['JP'],
      price: '3.50',
      availability: 'IN_STOCK',
      preorder: false,
    }).title,
    'Booster japonais Terastal Festival – Pokémon',
  );

  // « Coffret Dresseur d’Élite » is the French name of an Elite Trainer Box.
  const frenchEtb = productMetadataText({
    name: 'Coffret Dresseur d’Élite Pokémon 151',
    categoryName: 'Elite Trainer Box',
    gameName: 'Pokémon',
    languages: ['FR'],
    price: '54.90',
    availability: 'IN_STOCK',
    preorder: false,
  });
  assert.equal(
    frenchEtb.title,
    'Coffret Dresseur d’Élite Pokémon 151 (français)',
  );
  assert.doesNotMatch(frenchEtb.description, /Elite Trainer Box/);

  const bare = productMetadataText({
    name: 'Classeur 9 cases',
    languages: [],
    price: null,
    availability: 'OUT_OF_STOCK',
    preorder: false,
  });
  assert.equal(bare.title, 'Classeur 9 cases');
  assert.equal(bare.description, 'Classeur 9 cases.');

  const longName =
    'Coffret Collection Premium Évolutions Prismatiques Mentali et Noctali ex';
  const long = productMetadataText({
    name: longName,
    categoryName: 'Coffrets',
    setName: 'Évolutions Prismatiques',
    gameName: 'Pokémon',
    languages: ['FR'],
    price: '79.90',
    availability: 'LOW_STOCK',
    preorder: false,
  });
  assert.equal(long.title, longName);
  assert.ok(long.description.length <= 160);

  for (const text of [display, booster, bare, long]) {
    const words = text.title
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length > 3);
    assert.equal(new Set(words).size, words.length, text.title);
  }
});

const variant = {
  sku: 'OBF-DISP-FR',
  barcode: '4006381333931',
  price: '189.9',
  isActive: true,
  availability: 'IN_STOCK' as const,
};

const product: ProductJsonLdInput = {
  name: 'Display Flammes Obsidiennes',
  path: '/produit/display-flammes-obsidiennes',
  description: 'Display de 36 boosters.',
  images: [
    '/assets/products/placeholder-sealed.png',
    '/assets/products/placeholder-product.png',
    'https://blob.example.com/display.png',
    'https://blob.example.com/display.png',
  ],
  brand: 'Pokémon',
  category: 'Displays',
  variants: [variant],
  shippingMethods: [
    {
      name: 'Mondial Relay — Point Relais',
      price: '4.90',
      freeFromAmount: '100.00',
      minDays: 2,
      maxDays: 4,
      countries: ['FR'],
    },
  ],
};

test('JSON-LD produit : images, GTIN, offres, précommande', () =>
  withSiteUrl(undefined, () => {
    const node = productNode(product) as JsonLdNode;
    assert.deepEqual(node.image, ['https://blob.example.com/display.png']);
    assert.equal(node.gtin13, '4006381333931');
    assert.equal(node.sku, 'OBF-DISP-FR');
    assert.deepEqual(node.brand, { '@type': 'Brand', name: 'Pokémon' });
    const offer = node.offers as Record<string, unknown>;
    assert.equal(offer.price, '189.90');
    assert.equal(offer.priceCurrency, 'EUR');
    assert.equal(offer.availability, 'https://schema.org/InStock');
    assert.equal(offer.availabilityStarts, undefined);
    assert.deepEqual(offer.seller, { '@id': `${ORIGIN}/#organization` });
    assert.equal(offer.url, `${ORIGIN}/produit/display-flammes-obsidiennes`);
    const [shipping] = offer.shippingDetails as Record<string, unknown>[];
    // 189.90 € is above the 100 € threshold: shipping is free for this offer.
    assert.deepEqual(shipping?.shippingRate, {
      '@type': 'MonetaryAmount',
      value: 0,
      currency: 'EUR',
    });
    assert.deepEqual(offer.hasMerchantReturnPolicy, {
      '@type': 'MerchantReturnPolicy',
      applicableCountry: ['FR'],
      returnPolicyCountry: 'FR',
      returnPolicyCategory:
        'https://schema.org/MerchantReturnFiniteReturnWindow',
      merchantReturnDays: 14,
      returnMethod: 'https://schema.org/ReturnByMail',
      returnFees: 'https://schema.org/ReturnFeesCustomerResponsibility',
      merchantReturnLink: `${ORIGIN}/cgv#article-12`,
    });

    // Placeholders only: no image claimed. Invalid barcode: no GTIN.
    const bare = productNode({
      ...product,
      images: ['/assets/products/placeholder-card.png'],
      variants: [{ ...variant, barcode: '4006381333932' }],
    }) as JsonLdNode;
    assert.equal(bare.image, undefined);
    assert.equal(bare.gtin13, undefined);
    assert.deepEqual(gtinProperty('12345'), {});
    assert.deepEqual(gtinProperty('400638133393A'), {});
    assert.deepEqual(gtinProperty('96385074'), { gtin8: '96385074' });
    assert.deepEqual(gtinProperty(' 036000291452 '), {
      gtin12: '036000291452',
    });

    // One Offer per active variant; inactive variants are left out.
    const multi = productNode({
      ...product,
      releaseDate: new Date('2026-11-14T00:00:00.000Z'),
      variants: [
        { ...variant, availability: 'PREORDER' },
        {
          sku: 'OBF-DISP-JP',
          barcode: null,
          price: '149.90',
          isActive: true,
          availability: 'OUT_OF_STOCK',
        },
        {
          sku: 'OBF-DISP-EN',
          barcode: null,
          price: '139.90',
          isActive: false,
          availability: 'IN_STOCK',
        },
      ],
      shippingMethods: [],
    }) as JsonLdNode;
    const offers = multi.offers as Record<string, unknown>[];
    assert.equal(offers.length, 2);
    assert.equal(multi.sku, undefined);
    assert.equal(offers[0]?.availability, 'https://schema.org/PreOrder');
    assert.equal(offers[0]?.availabilityStarts, '2026-11-14');
    assert.equal(offers[0]?.gtin13, '4006381333931');
    assert.equal(offers[1]?.availability, 'https://schema.org/OutOfStock');
    assert.equal(offers[1]?.shippingDetails, undefined);

    // No active variant: no Product markup at all.
    assert.equal(
      productNode({ ...product, variants: [{ ...variant, isActive: false }] }),
      null,
    );
  }));

test('JSON-LD : graph, @id stables, fil d’Ariane', () =>
  withSiteUrl(undefined, () => {
    const doc = graph(websiteNode(), null, false);
    assert.equal(doc['@context'], 'https://schema.org');
    assert.equal(doc['@graph'].length, 1);
    assert.equal(doc['@graph'][0]?.['@id'], `${ORIGIN}/#website`);
    assert.equal(organizationId(), `${ORIGIN}/#organization`);
    const items = [
      { label: 'Accueil', href: '/' },
      { label: 'Pokémon', href: '/pokemon' },
      { label: 'Boosters' },
    ];
    assert.deepEqual(breadcrumbTrail(items), [
      { name: 'Accueil', path: '/' },
      { name: 'Pokémon', path: '/pokemon' },
    ]);
    const trail = breadcrumbListNode(
      breadcrumbTrail(items, '/pokemon/boosters'),
    );
    assert.deepEqual(trail?.itemListElement, [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${ORIGIN}/` },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Pokémon',
        item: `${ORIGIN}/pokemon`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: 'Boosters',
        item: `${ORIGIN}/pokemon/boosters`,
      },
    ]);
    assert.equal(breadcrumbListNode([{ name: 'Accueil', path: '/' }]), null);
  }));

test('JsonLd : échappement de </script> et des séparateurs de ligne', () => {
  const data = {
    '@type': 'Thing',
    name: '</script><script>alert(1)</script>\u2028\u2029',
  };
  const serialized = serializeJsonLd(data);
  assert.doesNotMatch(serialized, /</);
  assert.doesNotMatch(serialized, /[\u2028\u2029]/);
  assert.match(serialized, /\\u003c\/script>/);
  assert.match(serialized, /\\u2028\\u2029/);
  assert.deepEqual(JSON.parse(serialized), data);

  const element = JsonLd({ data }) as {
    type: string;
    props: { type: string; dangerouslySetInnerHTML: { __html: string } };
  };
  assert.equal(element.type, 'script');
  assert.equal(element.props.type, 'application/ld+json');
  const html = element.props.dangerouslySetInnerHTML.__html;
  assert.doesNotMatch(html, /</);
  assert.deepEqual(JSON.parse(html), {
    '@context': 'https://schema.org',
    ...data,
  });
  assert.equal(JsonLd({ data: null }), null);
});

test('Organization : siège social publié, identifiants seulement une fois connus', () => {
  const node = organizationNode() as Record<string, unknown>;
  assert.deepEqual(node.address, {
    '@type': 'PostalAddress',
    streetAddress: LEGAL_IDENTITY.address.street,
    postalCode: LEGAL_IDENTITY.address.postalCode,
    addressLocality: LEGAL_IDENTITY.address.locality,
    addressCountry: 'FR',
  });
  // No placeholder identifier while the company is being registered.
  assert.equal('taxID' in node, LEGAL_IDENTITY.siren !== null);
  assert.equal('vatID' in node, LEGAL_IDENTITY.vatId !== null);
  assert.equal('telephone' in node, false);
});
