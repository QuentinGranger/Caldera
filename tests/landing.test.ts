import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  categoryAncestors,
  categoryHubFacts,
  categoryHubHeading,
  extensionReleaseSections,
  factText,
  factualFaq,
  familyAndSubject,
  gameAndSet,
  groupByMonth,
  isUpcoming,
  landingBreadcrumb,
  landingEyebrow,
  landingFacts,
  landingHeading,
  mergeFaq,
  parisToday,
  recentExtensionsStart,
  RECENT_EXTENSION_MONTHS,
  releasePhrase,
  releaseStockText,
  releaseWindow,
  releaseWindowStart,
  setDetailsFact,
  standaloneSetFacts,
  withSearchParams,
  type CountedLink,
  type DatedLink,
  type LanguageLink,
  calendarYearPath as yearPath,
  parseCalendarSlug,
  yearCalendarText,
} from '../src/components/landing/landingText';
import { shopAisleCopy } from '../src/components/catalog/pageCopy';
import { landingKind, landingPath } from '../src/lib/seo/facets';
import { breadcrumbListNode, breadcrumbTrail } from '../src/lib/seo/jsonld';
import type {
  CategoryRef,
  GameRef,
  LandingScope,
  ScopeStats,
  SetRef,
} from '../src/lib/seo/types';

const NBSP = ' ';
const eur = (amount: string) => `${amount}${NBSP}€`;
const utc = (year: number, month: number, day: number) =>
  new Date(Date.UTC(year, month - 1, day));
const today = utc(2026, 9, 26);

const game: GameRef = { id: 'g1', slug: 'pokemon', name: 'Pokémon' };
const category = (
  id: string,
  slug: string,
  name: string,
  parentId: string | null = null,
): CategoryRef => ({ id, slug, name, parentId });
const sealed = category('c-sealed', 'scelles', 'Produits scellés');
const boosters = category('c-boosters', 'boosters', 'Boosters', 'c-sealed');
const etb = category('c-etb', 'etb', 'ETB', 'c-sealed');
const flammes: SetRef = {
  id: 's1',
  slug: 'flammes-obsidiennes',
  name: 'Flammes Obsidiennes',
  code: 'OBF',
  series: 'Écarlate et Violet',
  releaseDate: utc(2023, 8, 11),
  gameId: 'g1',
};
const opale: SetRef = {
  id: 's2',
  slug: 'sentiers-d-opale',
  name: 'Sentiers d’Opale',
  code: null,
  series: 'Écarlate et Violet',
  releaseDate: utc(2026, 12, 25),
  gameId: 'g1',
};
const undated: SetRef = {
  id: 's3',
  slug: 'promo',
  name: 'Promo',
  code: null,
  series: null,
  releaseDate: null,
  gameId: 'g1',
};

const stats = (values: Partial<ScopeStats> = {}): ScopeStats => ({
  productCount: 0,
  inStockCount: 0,
  preorderCount: 0,
  newArrivalCount: 0,
  minPrice: null,
  maxPrice: null,
  languages: [],
  lastModified: null,
  ...values,
});
const texts = (facts: ReturnType<typeof landingFacts>) => facts.map(factText);

test('H1 : intention de la landing, sans répéter le jeu', () => {
  const cases: [LandingScope, string, string][] = [
    [{ game }, 'Pokémon', 'Jeu de cartes à collectionner'],
    [
      { game, set: flammes },
      'Pokémon Flammes Obsidiennes',
      'Extension Pokémon',
    ],
    [
      { game, set: flammes, category: etb },
      'ETB Pokémon Flammes Obsidiennes',
      'Extension Pokémon',
    ],
    [
      { game, category: boosters },
      'Boosters Pokémon',
      'Famille de produits Pokémon',
    ],
    [
      { game, category: boosters, language: 'JP' },
      'Boosters Pokémon en japonais',
      'Famille de produits Pokémon',
    ],
    [
      { game, language: 'FR' },
      'Produits Pokémon en français',
      'Catalogue Pokémon',
    ],
    [
      { game, status: 'precommandes' },
      'Précommandes Pokémon',
      'Catalogue Pokémon',
    ],
    [
      { game, status: 'en-stock' },
      'Produits Pokémon en stock',
      'Catalogue Pokémon',
    ],
    [{ game, status: 'nouveautes' }, 'Nouveautés Pokémon', 'Catalogue Pokémon'],
    [
      { game, category: boosters, status: 'en-stock' },
      'Boosters Pokémon en stock',
      'Famille de produits Pokémon',
    ],
    [
      { game, category: boosters, status: 'precommandes' },
      'Boosters Pokémon en précommande',
      'Famille de produits Pokémon',
    ],
    [
      { game, category: boosters, status: 'nouveautes' },
      'Nouveautés boosters Pokémon',
      'Famille de produits Pokémon',
    ],
    [
      { game, category: etb, status: 'nouveautes' },
      'Nouveautés ETB Pokémon',
      'Famille de produits Pokémon',
    ],
    [
      { game, set: flammes, language: 'EN' },
      'Pokémon Flammes Obsidiennes en anglais',
      'Extension Pokémon',
    ],
    [
      { game, set: flammes, status: 'precommandes' },
      'Précommandes Pokémon Flammes Obsidiennes',
      'Extension Pokémon',
    ],
  ];
  for (const [scope, heading, eyebrow] of cases) {
    assert.equal(landingHeading(scope), heading, landingPath(scope));
    assert.equal(landingEyebrow(scope), eyebrow, landingPath(scope));
  }
  // A set named after its game does not repeat it.
  const named = { ...flammes, name: 'Pokémon 151' };
  assert.equal(landingHeading({ game, set: named }), 'Pokémon 151');
  assert.equal(gameAndSet('Pokémon', 'Pokémon 151'), 'Pokémon 151');
  assert.equal(familyAndSubject('Boosters', 'Pokémon'), 'Boosters Pokémon');
  assert.equal(
    familyAndSubject('Coffrets Pokémon', 'Pokémon'),
    'Coffrets Pokémon',
  );
});

test('intro factuelle du hub jeu : comptes, familles, extensions, stock, langues', () => {
  const families: CountedLink[] = [
    { label: 'Boosters', count: 6, href: '/pokemon/boosters' },
    { label: 'ETB', count: 1 },
  ];
  const sets: DatedLink[] = [
    { label: opale.name, count: 2, releaseDate: opale.releaseDate },
    {
      label: flammes.name,
      count: 5,
      releaseDate: flammes.releaseDate,
      href: '/pokemon/flammes-obsidiennes',
    },
  ];
  const languages: CountedLink[] = [
    { label: 'français', count: 13, href: '/pokemon/francais' },
    { label: 'japonais', count: 1 },
  ];
  const facts = landingFacts({
    scope: { game },
    stats: stats({
      productCount: 16,
      inStockCount: 12,
      preorderCount: 2,
      minPrice: '5.90',
      maxPrice: '189.90',
    }),
    families,
    sets,
    languages,
    nextRelease: {
      label: opale.name,
      count: 2,
      releaseDate: opale.releaseDate,
    },
    today,
  });
  assert.deepEqual(texts(facts), [
    `16 produits au catalogue, de ${eur('5,90')} à ${eur('189,90')}.`,
    'Familles de produits : Boosters (6) et ETB (1).',
    '2 extensions au catalogue, la plus récente : Flammes Obsidiennes (sortie le 11 août 2023).',
    'Disponibilité : 12 en stock et 2 en précommande.',
    'Langues : français (13) et japonais (1).',
    'Prochaine sortie annoncée : Sentiers d’Opale, le 25 décembre 2026.',
  ]);
  // Links only where an indexable target was given.
  assert.deepEqual(facts[1], [
    'Familles de produits : ',
    { text: 'Boosters', href: '/pokemon/boosters' },
    ' (6) et ETB (1).',
  ]);
  assert.deepEqual(facts[2]?.[1], {
    text: 'Flammes Obsidiennes',
    href: '/pokemon/flammes-obsidiennes',
  });
});

test('intro factuelle : chaque phrase dépend des données disponibles', () => {
  // Announced set without product: set details, no stock, no language.
  assert.deepEqual(
    texts(landingFacts({ scope: { game, set: opale }, stats: stats(), today })),
    [
      'Extension Pokémon de la série Écarlate et Violet, sortie prévue le 25 décembre 2026.',
      'Aucun produit de cette extension n’est en ligne pour le moment.',
    ],
  );
  // Released set with a single price and products out of stock.
  assert.deepEqual(
    texts(
      landingFacts({
        scope: { game, set: flammes },
        stats: stats({ productCount: 1, minPrice: '54.90', maxPrice: '54.90' }),
        families: [{ label: 'ETB', count: 1 }],
        today,
      }),
    ),
    [
      'Extension Pokémon de la série Écarlate et Violet, code OBF, sortie le 11 août 2023.',
      `1 produit au catalogue à ${eur('54,90')}.`,
      'Famille de produits : ETB (1).',
      'Aucun produit en stock pour le moment.',
    ],
  );
  // Undated set without series nor code: no set sentence at all.
  assert.deepEqual(
    texts(
      landingFacts({
        scope: { game, set: undated },
        stats: stats({ productCount: 3, inStockCount: 3 }),
        today,
      }),
    ),
    ['3 produits au catalogue.', 'Disponibilité : 3 en stock.'],
  );
  // Empty family.
  assert.deepEqual(
    texts(
      landingFacts({ scope: { game, category: etb }, stats: stats(), today }),
    ),
    ['Aucun produit de cette famille n’est en ligne pour le moment.'],
  );
  // A family lists its sub-families and its sets.
  assert.deepEqual(
    texts(
      landingFacts({
        scope: { game, category: sealed },
        stats: stats({ productCount: 4, inStockCount: 1, preorderCount: 3 }),
        families: [
          { label: 'Boosters', count: 3 },
          { label: 'ETB', count: 1 },
        ],
        sets: [
          { label: opale.name, count: 3, releaseDate: opale.releaseDate },
          { label: flammes.name, count: 1, releaseDate: flammes.releaseDate },
        ],
        today,
      }),
    ),
    [
      '4 produits au catalogue.',
      'Sous-familles : Boosters (3) et ETB (1).',
      'Extensions : Sentiers d’Opale (3) et Flammes Obsidiennes (1).',
      'Disponibilité : 1 en stock et 3 en précommande.',
    ],
  );
  // Status and language facets do not repeat what the URL already says.
  assert.deepEqual(
    texts(
      landingFacts({
        scope: { game, status: 'precommandes' },
        stats: stats({
          productCount: 2,
          preorderCount: 2,
          minPrice: '34.90',
          maxPrice: '39.90',
        }),
        sets: [{ label: opale.name, count: 2, releaseDate: opale.releaseDate }],
        languages: [{ label: 'français', count: 2 }],
        today,
      }),
    ),
    [
      `2 produits en précommande, de ${eur('34,90')} à ${eur('39,90')}.`,
      'Extension : Sentiers d’Opale (2).',
      'Sortie prévue : Sentiers d’Opale le 25 décembre 2026.',
      'Langue : français (2).',
    ],
  );
  assert.deepEqual(
    texts(
      landingFacts({
        scope: { game, category: boosters, language: 'JP' },
        stats: stats({ productCount: 2, inStockCount: 2 }),
        languages: [{ label: 'japonais', count: 2 }],
        today,
      }),
    ),
    ['2 produits en japonais.', 'Disponibilité : 2 en stock.'],
  );
  assert.deepEqual(
    texts(
      landingFacts({
        scope: { game, status: 'en-stock' },
        stats: stats({ productCount: 2, inStockCount: 2 }),
        today,
      }),
    ),
    ['2 produits en stock.'],
  );
  // Long lists are cut with the real remainder.
  const many = Array.from({ length: 8 }, (_, index) => ({
    label: `F${index + 1}`,
    count: 1,
  }));
  assert.equal(
    factText(
      landingFacts({
        scope: { game },
        stats: stats({ productCount: 8 }),
        families: many,
        today,
      })[1] ?? [],
    ),
    'Familles de produits : F1 (1), F2 (1), F3 (1), F4 (1), F5 (1), F6 (1) et 2 autres.',
  );
});

test('intro factuelle : extension hors jeu et hub famille multi-jeux', () => {
  assert.deepEqual(
    setDetailsFact(
      { series: null, code: 'OBF', releaseDate: null },
      today,
      'Pokémon',
    ),
    ['Extension Pokémon, code OBF.'],
  );
  assert.equal(
    setDetailsFact({ series: null, code: null, releaseDate: null }, today),
    null,
  );
  assert.deepEqual(
    standaloneSetFacts({
      set: flammes,
      stats: stats({ productCount: 2, inStockCount: 1 }),
      families: [{ label: 'Boosters', count: 2 }],
      languages: [{ label: 'français', count: 2 }],
      today,
    }).map(factText),
    [
      'Extension de la série Écarlate et Violet, code OBF, sortie le 11 août 2023.',
      '2 produits au catalogue.',
      'Famille de produits : Boosters (2).',
      'Disponibilité : 1 en stock.',
      'Langue : français (2).',
    ],
  );
  const hub = categoryHubFacts({
    stats: stats({ productCount: 19, inStockCount: 19 }),
    games: [
      { label: 'Pokémon', count: 14, href: '/pokemon/scelles' },
      { label: 'Jeu Test', count: 3 },
    ],
    gamelessCount: 2,
    families: [{ label: 'Boosters', count: 7, href: '/categorie/boosters' }],
  });
  assert.deepEqual(hub.map(factText), [
    '19 produits au catalogue.',
    'Jeux : Pokémon (14), Jeu Test (3) et 2 produits multi-jeux.',
    'Sous-famille : Boosters (7).',
    'Disponibilité : 19 en stock.',
  ]);
  assert.deepEqual(hub[1]?.[1], { text: 'Pokémon', href: '/pokemon/scelles' });
  assert.deepEqual(
    categoryHubFacts({
      stats: stats({ productCount: 2, inStockCount: 2 }),
      games: [],
      gamelessCount: 2,
    }).map(factText),
    [
      '2 produits au catalogue.',
      '2 produits multi-jeux.',
      'Disponibilité : 2 en stock.',
    ],
  );
  assert.equal(
    categoryHubHeading('Boosters', ['Pokémon', 'Jeu Test'], false),
    'Boosters Pokémon et Jeu Test',
  );
  assert.equal(
    categoryHubHeading('Boosters', ['Pokémon'], false),
    'Boosters Pokémon',
  );
  // Multi-game products belong to no game; four games make a long list.
  assert.equal(categoryHubHeading('Boosters', ['Pokémon'], true), 'Boosters');
  assert.equal(
    categoryHubHeading('Boosters', ['A', 'B', 'C', 'D'], false),
    'Boosters',
  );
  assert.equal(
    categoryHubHeading(
      'Protège-cartes et accessoires de rangement',
      ['Pokémon', 'Jeu Test', 'One Piece'],
      false,
    ),
    'Protège-cartes et accessoires de rangement',
  );
});

test('FAQ factuelle d’une extension : seulement ce que les données disent', () => {
  const families: CountedLink[] = [
    { label: 'ETB', count: 2, href: '/pokemon/flammes-obsidiennes/etb' },
    { label: 'Boosters', count: 1 },
  ];
  const languages: LanguageLink[] = [
    { language: 'FR', label: 'français', count: 2 },
    { language: 'JP', label: 'japonais', count: 1 },
  ];
  assert.deepEqual(
    factualFaq({
      scope: { game, set: flammes },
      stats: stats({ productCount: 3, inStockCount: 2 }),
      families,
      languages,
      today,
    }),
    [
      {
        question: 'Quand est sortie l’extension Flammes Obsidiennes ?',
        answer: 'L’extension Flammes Obsidiennes est sortie le 11 août 2023.',
      },
      {
        question: 'Quels produits Flammes Obsidiennes sont disponibles ?',
        answer:
          '3 produits de l’extension Flammes Obsidiennes au catalogue : ETB (2) et Boosters (1). Disponibilité : 2 en stock.',
      },
      {
        question:
          'En quelles langues trouver l’extension Flammes Obsidiennes ?',
        answer: '2 produits en français et 1 produit en japonais.',
      },
    ],
  );
  // Announced set: the date question, preorders only when there are some.
  assert.deepEqual(
    factualFaq({
      scope: { game, set: opale },
      stats: stats({ productCount: 2, preorderCount: 2 }),
      today,
    }).map((entry) => entry.answer),
    [
      'La sortie de l’extension Sentiers d’Opale est prévue le 25 décembre 2026. 2 produits sont en précommande.',
      '2 produits de l’extension Sentiers d’Opale au catalogue. Disponibilité : 2 en précommande.',
    ],
  );
  assert.deepEqual(
    factualFaq({ scope: { game, set: opale }, stats: stats(), today }),
    [
      {
        question: 'Quand sort l’extension Sentiers d’Opale ?',
        answer:
          'La sortie de l’extension Sentiers d’Opale est prévue le 25 décembre 2026.',
      },
    ],
  );
  // No date, no product: no question at all.
  assert.deepEqual(
    factualFaq({ scope: { game, set: undated }, stats: stats(), today }),
    [],
  );
  assert.equal(
    factualFaq({
      scope: { game, set: undated },
      stats: stats({ productCount: 1 }),
      today,
    })[0]?.answer,
    '1 produit de l’extension Promo au catalogue. Aucun n’est en stock pour le moment.',
  );
});

test('FAQ factuelle d’une famille : langues présentes et extensions réelles', () => {
  const faq = factualFaq({
    scope: { game, category: boosters },
    stats: stats({ productCount: 6 }),
    languages: [
      { language: 'FR', label: 'français', count: 5 },
      { language: 'JP', label: 'japonais', count: 2 },
      { language: 'EN', label: 'anglais', count: 1 },
    ],
    sets: [
      {
        label: flammes.name,
        count: 3,
        releaseDate: flammes.releaseDate,
        href: '/pokemon/flammes-obsidiennes/boosters',
      },
      { label: opale.name, count: 1, releaseDate: opale.releaseDate },
    ],
    today,
  });
  assert.deepEqual(faq, [
    {
      question: 'Existe-t-il des boosters Pokémon en japonais ?',
      answer:
        'Oui : 2 produits de la famille Boosters Pokémon sont proposés en japonais.',
    },
    {
      question: 'Existe-t-il des boosters Pokémon en anglais ?',
      answer:
        'Oui : 1 produit de la famille Boosters Pokémon est proposé en anglais.',
    },
    {
      question: 'Dans quelles extensions trouver des boosters Pokémon ?',
      answer: 'Flammes Obsidiennes (3) et Sentiers d’Opale (1).',
    },
  ]);
  // A language that is absent is never asked about.
  assert.deepEqual(
    factualFaq({
      scope: { game, category: etb },
      stats: stats({ productCount: 1 }),
      languages: [{ language: 'FR', label: 'français', count: 1 }],
      today,
    }),
    [],
  );
  // Filter landings and the game hub carry no generated question.
  for (const scope of [
    { game },
    { game, language: 'JP' as const },
    { game, status: 'precommandes' as const },
    { game, set: flammes, category: etb },
    { game, category: boosters, language: 'JP' as const },
  ])
    assert.deepEqual(
      factualFaq({
        scope,
        stats: stats({ productCount: 4 }),
        languages: [{ language: 'JP', label: 'japonais', count: 4 }],
        today,
      }),
      [],
      landingKind(scope),
    );
});

test('FAQ : l’éditorial d’abord, une question posée deux fois gardée une fois', () => {
  const editorial = [
    {
      question: 'Quand sort l’extension Sentiers d’Opale ?',
      answer: 'Éditorial.',
    },
    { question: 'Faut-il précommander ?', answer: 'Oui.' },
  ];
  const generated = [
    { question: "Quand sort l'extension Sentiers d'Opale?", answer: 'Généré.' },
    { question: 'Quels produits sont disponibles ?', answer: 'Deux.' },
  ];
  assert.deepEqual(
    mergeFaq(editorial, generated).map((entry) => entry.answer),
    ['Éditorial.', 'Oui.', 'Deux.'],
  );
  assert.deepEqual(mergeFaq([{ question: '  ?', answer: 'x' }]), []);
});

test('fil d’Ariane : hiérarchie, niveaux intermédiaires indexables seulement', () => {
  const all = () => true;
  const trail = (items: ReturnType<typeof landingBreadcrumb>) =>
    items.map((item) =>
      item.href ? `${item.label}<${item.href}>` : item.label,
    );
  assert.deepEqual(
    trail(landingBreadcrumb({ scope: { game }, isIndexable: all })),
    ['Accueil</>', 'Pokémon'],
  );
  assert.deepEqual(
    trail(
      landingBreadcrumb({
        scope: { game, set: flammes, category: etb },
        ancestors: [sealed],
        isIndexable: all,
      }),
    ),
    [
      'Accueil</>',
      'Pokémon</pokemon>',
      'Flammes Obsidiennes</pokemon/flammes-obsidiennes>',
      'ETB',
    ],
  );
  assert.deepEqual(
    trail(
      landingBreadcrumb({
        scope: { game, category: boosters, language: 'JP' },
        ancestors: [sealed],
        isIndexable: all,
      }),
    ),
    [
      'Accueil</>',
      'Pokémon</pokemon>',
      'Produits scellés</pokemon/scelles>',
      'Boosters</pokemon/boosters>',
      'Japonais',
    ],
  );
  assert.deepEqual(
    trail(
      landingBreadcrumb({
        scope: { game, set: flammes, status: 'precommandes' },
        isIndexable: (path) => path !== '/pokemon/flammes-obsidiennes',
      }),
    ),
    ['Accueil</>', 'Pokémon</pokemon>', 'Précommandes'],
  );
  assert.deepEqual(
    trail(
      landingBreadcrumb({
        scope: { game, category: boosters },
        ancestors: [sealed],
        isIndexable: (path) => path !== '/pokemon/scelles',
      }),
    ),
    ['Accueil</>', 'Pokémon</pokemon>', 'Boosters'],
  );
  // Same trail in the BreadcrumbList, the current page last.
  const items = landingBreadcrumb({
    scope: { game, category: etb },
    ancestors: [sealed],
    isIndexable: all,
  });
  const node = breadcrumbListNode(breadcrumbTrail(items, '/pokemon/etb'));
  assert.deepEqual(
    (node?.itemListElement as { name: string; item: string }[]).map((entry) => [
      entry.name,
      new URL(entry.item).pathname,
    ]),
    [
      ['Accueil', '/'],
      ['Pokémon', '/pokemon'],
      ['Produits scellés', '/pokemon/scelles'],
      ['ETB', '/pokemon/etb'],
    ],
  );
  // Ancestors of a family, root first; a missing parent ends the chain.
  const categories = [sealed, boosters, etb];
  assert.deepEqual(categoryAncestors(categories, boosters), [sealed]);
  assert.deepEqual(categoryAncestors(categories, sealed), []);
  assert.deepEqual(
    categoryAncestors(categories, { parentId: 'c-inactive' }),
    [],
  );
});

test('calendrier : jour à Paris, fenêtre de 12 mois, regroupement par mois', () => {
  // 22:30 UTC in September is already the next day in Paris (UTC+2).
  assert.deepEqual(
    parisToday(new Date('2026-09-26T22:30:00Z')),
    utc(2026, 9, 27),
  );
  assert.deepEqual(
    parisToday(new Date('2026-12-31T23:30:00Z')),
    utc(2027, 1, 1),
  );
  assert.deepEqual(
    parisToday(new Date('2026-09-26T21:30:00Z')),
    utc(2026, 9, 26),
  );
  assert.deepEqual(releaseWindowStart(today), utc(2025, 9, 26));

  assert.equal(isUpcoming(today, today), false);
  assert.equal(isUpcoming(utc(2026, 9, 27), today), true);
  assert.equal(
    releasePhrase(utc(2023, 8, 11), today),
    'sortie le 11 août 2023',
  );
  assert.equal(
    releasePhrase(utc(2026, 12, 1), today),
    'sortie prévue le 1er décembre 2026',
  );

  const entry = (name: string, releaseDate: Date) => ({ name, releaseDate });
  const window = releaseWindow(
    [
      entry('far', utc(2027, 2, 1)),
      entry('old', utc(2025, 9, 25)),
      entry('today', today),
      entry('limit', utc(2025, 9, 26)),
      entry('soon', utc(2026, 10, 2)),
      entry('summer', utc(2026, 7, 28)),
    ],
    today,
  );
  assert.deepEqual(
    window.upcoming.map((e) => e.name),
    ['soon', 'far'],
  );
  assert.deepEqual(
    window.recent.map((e) => e.name),
    ['today', 'summer', 'limit'],
  );

  const months = groupByMonth([
    entry('a', utc(2026, 12, 1)),
    entry('b', utc(2026, 12, 25)),
    entry('c', utc(2027, 1, 10)),
  ]);
  assert.deepEqual(
    months.map((month) => [month.key, month.label, month.entries.length]),
    [
      ['2026-12', 'Décembre 2026', 2],
      ['2027-01', 'Janvier 2027', 1],
    ],
  );

  assert.equal(
    releaseStockText({ count: 0, inStockCount: 0, preorderCount: 0 }),
    'Aucun produit en ligne',
  );
  assert.equal(
    releaseStockText({ count: 5, inStockCount: 3, preorderCount: 2 }),
    '5 produits : 3 en stock, 2 en précommande',
  );
  assert.equal(
    releaseStockText({ count: 1, inStockCount: 0, preorderCount: 0 }),
    '1 produit, aucun en stock',
  );
});

test('extensions : trois sections chronologiques sans doublon', () => {
  const reference = utc(2026, 10, 3);
  assert.equal(RECENT_EXTENSION_MONTHS, 6);
  assert.deepEqual(recentExtensionsStart(reference), utc(2026, 4, 3));

  const entries = [
    { name: 'future lointaine', releaseDate: utc(2027, 1, 10) },
    { name: 'ancienne', releaseDate: utc(2026, 4, 2) },
    { name: 'récente', releaseDate: utc(2026, 8, 20) },
    { name: 'future proche', releaseDate: utc(2026, 10, 12) },
    { name: 'limite', releaseDate: utc(2026, 4, 3) },
    { name: 'aujourd’hui', releaseDate: reference },
    { name: 'sans date', releaseDate: null },
  ];
  const sections = extensionReleaseSections(entries, reference);

  assert.deepEqual(
    sections.upcoming.map((entry) => entry.name),
    ['future proche', 'future lointaine'],
  );
  assert.deepEqual(
    sections.recent.map((entry) => entry.name),
    ['aujourd’hui', 'récente', 'limite'],
  );
  assert.deepEqual(
    sections.released.map((entry) => entry.name),
    ['ancienne', 'sans date'],
  );

  const names = [
    ...sections.upcoming,
    ...sections.recent,
    ...sections.released,
  ].map((entry) => entry.name);
  assert.equal(names.length, entries.length);
  assert.equal(new Set(names).size, entries.length);
});

test('heroes Pokémon : cadrages mobile distincts et hauteur desktop stable', () => {
  const copies = ['scelles', 'boosters', 'displays', 'coffrets'].map((slug) => {
    const copy = shopAisleCopy(slug, 'Pokémon');
    assert.ok(copy, slug);
    return copy;
  });

  assert.equal(new Set(copies.map((copy) => copy.mobileFocus)).size, 4);
  assert.equal(new Set(copies.map((copy) => copy.focus)).size, 4);
  assert.deepEqual(
    [...new Set(copies.map((copy) => copy.desktopHeight))],
    ['34rem'],
  );
  for (const copy of copies) {
    assert.ok(copy.mobileFocus);
    assert.ok((copy.mobileZoom ?? 1) >= 1 && (copy.mobileZoom ?? 1) <= 1.12);
    assert.notEqual(copy.mobileFocus, copy.focus);
  }
});

test('redirections : la requête suit le chemin canonique', () => {
  assert.equal(
    withSearchParams('/pokemon/boosters/francais', {
      page: '2',
      utm_source: 'x',
      language: ['FR', 'EN'],
      empty: undefined,
    }),
    '/pokemon/boosters/francais?page=2&utm_source=x&language=FR&language=EN',
  );
  assert.equal(withSearchParams('/pokemon', {}), '/pokemon');
});

test('calendrier annuel : URL, titres et faits datés', () => {
  assert.deepEqual(parseCalendarSlug('2026'), { year: 2026, gameSlug: null });
  assert.deepEqual(parseCalendarSlug('pokemon-2026'), {
    year: 2026,
    gameSlug: 'pokemon',
  });
  assert.deepEqual(parseCalendarSlug('one-piece-2027'), {
    year: 2027,
    gameSlug: 'one-piece',
  });
  for (const invalid of [
    '26',
    '2026-pokemon',
    'pokemon',
    '1800',
    'Pokemon-2026',
  ])
    assert.equal(parseCalendarSlug(invalid), null, invalid);
  assert.equal(yearPath(2026), '/calendrier-des-sorties/2026');
  assert.equal(
    yearPath(2026, 'pokemon'),
    '/calendrier-des-sorties/pokemon-2026',
  );
  const text = yearCalendarText({
    year: 2026,
    gameName: 'Pokémon',
    gameNames: ['Pokémon'],
    upcoming: [
      { name: 'Flammes', releaseDate: new Date(Date.UTC(2026, 10, 14)) },
    ],
    released: [{}, {}],
  });
  assert.equal(text.title, 'Sorties Pokémon 2026 : calendrier des extensions');
  assert.match(
    text.description,
    /^3 extensions Pokémon en 2026 : 2 déjà sorties, 1 à venir\./,
  );
  assert.match(
    text.description,
    /Prochaine sortie : Flammes le 14 novembre 2026\./,
  );
  assert.ok(text.description.length <= 160);
  const past = yearCalendarText({
    year: 2025,
    gameName: null,
    gameNames: ['Pokémon', 'Jeu Test'],
    upcoming: [],
    released: [{}],
  });
  assert.equal(past.title, 'Calendrier des sorties 2025 : Pokémon et Jeu Test');
  assert.equal(past.description, '1 extension en 2025, déjà sortie.');
});
