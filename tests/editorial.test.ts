import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import {
  editorialDecision,
  editorialMetadata,
  fitList,
  fitSentences,
  fittingTitle,
  freeAnchor,
  glossaryLetter,
  groupByLetter,
  groupGuides,
  guideCountsLabel,
  latestUpdate,
  shortTitle,
  splitLead,
} from '../src/components/editorial/editorial';
import {
  deliveryText,
  handlingLabel,
  priceLabel,
  transitLabel,
} from '../src/components/editorial/delivery';
import {
  universeChapterMetadata,
  universeChapterTitle,
  universeIndexMetadata,
} from '../src/components/universe/metadata';
import {
  universeChapters,
  universeImage,
  universeIndex,
} from '../src/data/universe';
import { getAllContent, type ContentEntry } from '../src/lib/content';
import { DESCRIPTION_MAX, TITLE_MAX } from '../src/lib/seo/metadata';
import type { ShippingFact } from '../src/lib/seo/shipping';

const entry = (
  slug: string,
  overrides: Partial<ContentEntry> = {},
): ContentEntry =>
  Object.freeze({
    slug,
    kind: 'guide',
    title: slug,
    description: slug,
    updated: new Date('2026-09-01'),
    published: new Date('2026-09-01'),
    games: [],
    categories: [],
    sets: [],
    related: [],
    faq: [],
    href: `/guides/${slug}`,
    wordCount: 100,
    ...overrides,
  });

const method = (overrides: Partial<ShippingFact> = {}): ShippingFact => ({
  code: 'relay',
  name: 'Mondial Relay',
  description: null,
  type: 'HOME_DELIVERY',
  price: '4.90',
  freeFromAmount: null,
  estimatedMinDays: 3,
  estimatedMaxDays: 5,
  minDays: 3,
  maxDays: 5,
  countries: ['FR'],
  destinations: [{ code: 'FR', name: 'France' }],
  ...overrides,
});

/** Every number written in a text: « 4,90 € » → "4,90", « 100 » → "100". */
const numbersOf = (text: string) => text.match(/\d+(?:,\d+)?/g) ?? [];

test('shortTitle garde un titre court et coupe un long à une proposition', () => {
  assert.equal(shortTitle('Débuter une collection'), 'Débuter une collection');
  assert.equal(
    shortTitle(
      'Cartes Pokémon en français, anglais ou japonais : quelles différences ?',
    ),
    'Cartes Pokémon en français, anglais ou japonais',
  );
  assert.equal(
    shortTitle('Protéger ses cartes : protège-cartes, toploaders et classeurs'),
    'Protéger ses cartes : protège-cartes, toploaders',
  );
  // No usable clause: cut at a word, ellipsis included, within TITLE_MAX.
  const long = shortTitle(
    'Un très long titre sans aucune ponctuation qui dépasse largement la limite fixée',
  );
  assert.ok(long.length <= TITLE_MAX);
  assert.ok(long.endsWith('…'));
  assert.equal(fittingTitle('a'.repeat(61), 'Court'), 'Court');
  assert.ok(fittingTitle('a'.repeat(70)).length <= TITLE_MAX);
});

test('les titles meta des contenus tiennent sans la marque', async () => {
  const entries = await getAllContent();
  assert.ok(entries.length > 0);
  for (const item of entries) {
    const base =
      item.kind === 'glossaire' ? `${item.title} : définition` : item.title;
    const title = shortTitle(base);
    assert.ok(title.length <= TITLE_MAX, `${item.href} : ${title}`);
    assert.ok(!/caldera/i.test(title), `${item.href} : marque dans le title`);
    assert.ok(title.length >= TITLE_MAX / 2 || title === base, item.href);
  }
});

test('fitSentences et fitList restent dans la limite sans couper une phrase', () => {
  const text = fitSentences([
    'Première phrase.',
    'x'.repeat(DESCRIPTION_MAX),
    null,
    'Dernière phrase.',
  ]);
  assert.equal(text, 'Première phrase. Dernière phrase.');
  const list = fitList(
    'Termes : ',
    Array.from({ length: 40 }, (_, i) => `terme ${i}`),
  );
  assert.ok(list.length <= DESCRIPTION_MAX);
  assert.ok(list.endsWith(', …'));
  assert.equal(fitList('Termes : ', ['a', 'b']), 'Termes : a, b.');
});

test('guides groupés par type, les plus récents d’abord, sans trier l’entrée gelée', () => {
  const entries = Object.freeze([
    entry('b', { kind: 'guide', title: 'B', updated: new Date('2026-01-01') }),
    entry('a', { kind: 'guide', title: 'A', updated: new Date('2026-03-01') }),
    entry('c', { kind: 'comparatif', title: 'C' }),
    entry('t', { kind: 'glossaire', title: 'T', href: '/glossaire/t' }),
  ]);
  const groups = groupGuides(entries);
  assert.deepEqual(
    groups.map((group) => [group.kind, group.entries.map((e) => e.slug)]),
    [
      ['comparatif', ['c']],
      ['guide', ['a', 'b']],
    ],
  );
  assert.equal(guideCountsLabel(groups), '2 guides et 1 comparatif');
  assert.deepEqual(latestUpdate(entries), new Date('2026-09-01'));
  assert.equal(latestUpdate([]), null);
});

test('glossaire A-Z : accents, chiffres et ancres de lettres', () => {
  assert.equal(glossaryLetter('État d’une carte'), 'E');
  assert.equal(glossaryLetter('151'), '#');
  const letters = groupByLetter([
    entry('etb', { title: 'ETB' }),
    entry('etat', { title: 'État d’une carte' }),
    entry('booster', { title: 'Booster' }),
    entry('151', { title: '151' }),
  ]);
  assert.deepEqual(
    letters.map((group) => [
      group.letter,
      group.id,
      group.entries.map((e) => e.slug),
    ]),
    [
      ['B', 'lettre-b', ['booster']],
      ['E', 'lettre-e', ['etat', 'etb']],
      ['#', 'lettre-autres', ['151']],
    ],
  );
});

test('définition mise en avant : premier paragraphe séparé du corps', () => {
  assert.deepEqual(
    splitLead('<p>Un <a href="/glossaire/etb">ETB</a>.</p>\n<h2 id="x">X</h2>'),
    { lead: 'Un <a href="/glossaire/etb">ETB</a>.', rest: '<h2 id="x">X</h2>' },
  );
  assert.deepEqual(splitLead('<h2>X</h2>'), {
    lead: null,
    rest: '<h2>X</h2>',
  });
});

test('ancre de FAQ libre même si le corps utilise déjà la même', () => {
  assert.equal(freeAnchor('questions-frequentes', []), 'questions-frequentes');
  assert.equal(
    freeAnchor('questions-frequentes', [
      { id: 'questions-frequentes' },
      { id: 'questions-frequentes-2' },
    ]),
    'questions-frequentes-3',
  );
});

test('metadata éditoriale : canonical absolu, noindex sans contenu, pas de marque', () => {
  const indexable = editorialMetadata({
    title: 'Glossaire des cartes à collectionner',
    description: 'd'.repeat(300),
    decision: editorialDecision('/glossaire'),
  });
  assert.equal(indexable.title, 'Glossaire des cartes à collectionner');
  assert.equal(
    indexable.alternates?.canonical,
    'https://lesterresdecaldera.fr/glossaire',
  );
  assert.deepEqual(indexable.robots, { index: true, follow: true });
  assert.ok(String(indexable.description).length <= DESCRIPTION_MAX);
  const empty = editorialMetadata({
    title: 'Livraison',
    description: 'Livraison.',
    decision: editorialDecision('/livraison', false),
  });
  assert.deepEqual(empty.robots, { index: false, follow: true });
  assert.equal(
    empty.alternates?.canonical,
    'https://lesterresdecaldera.fr/livraison',
  );
});

test('livraison : délais et tarifs issus des méthodes et des CGV uniquement', () => {
  assert.equal(handlingLabel(), '1 à 2 jours ouvrés');
  assert.equal(transitLabel(method()), '3 à 5 jours ouvrés');
  assert.equal(
    transitLabel(method({ estimatedMinDays: 2, estimatedMaxDays: 2 })),
    '2 jours ouvrés',
  );
  assert.equal(
    transitLabel(method({ estimatedMinDays: null, estimatedMaxDays: 1 })),
    '1 jour ouvré',
  );
  assert.equal(
    transitLabel(method({ estimatedMinDays: null, estimatedMaxDays: null })),
    null,
  );
  assert.equal(priceLabel('0.00'), 'Offerte');
  assert.equal(priceLabel('4.90'), '4,90 €');

  const none = deliveryText([]);
  assert.equal(none.title, 'Livraison et expédition');
  assert.deepEqual(numbersOf(none.description), ['1', '2']);

  const methods = [
    method({ freeFromAmount: '100.00' }),
    method({
      code: 'home',
      name: 'Colissimo',
      price: '7.90',
      freeFromAmount: null,
    }),
  ];
  const text = deliveryText(methods);
  assert.equal(text.title, 'Livraison : modes, tarifs et délais');
  assert.ok(text.description.length <= DESCRIPTION_MAX);
  assert.match(text.description, /offerte dès 100,00 € d’achat avec/);
  assert.match(text.description, /Tarifs dès 4,90 €/);
  const allowed = new Set(['1', '2', '4,90', '7,90', '100,00']);
  for (const value of numbersOf(text.description))
    assert.ok(allowed.has(value), `chiffre inventé : ${value}`);

  const single = deliveryText([method({ price: '0.00' })]);
  assert.match(single.description, /Mondial Relay : livraison offerte\./);
});

const PUBLIC = path.join(process.cwd(), 'public');
const UNIVERSE_SOURCES = [
  path.join(process.cwd(), 'src/data/universe.ts'),
  ...readdirSync(path.join(process.cwd(), 'src/app/univers'), {
    recursive: true,
    encoding: 'utf8',
  })
    .filter((file) => file.endsWith('.tsx'))
    .map((file) => path.join(process.cwd(), 'src/app/univers', file)),
];

/** Width and height of a PNG, from its IHDR chunk. */
function pngSize(file: string) {
  const header = readFileSync(file).subarray(16, 24);
  return { width: header.readUInt32BE(0), height: header.readUInt32BE(4) };
}

test('univers : une image n’est rendue ou partagée que si elle est publiée', () => {
  const referenced = new Set(
    UNIVERSE_SOURCES.flatMap(
      (file) =>
        readFileSync(file, 'utf8').match(/\/assets\/images\/[\w-]+\.png/g) ??
        [],
    ),
  );
  assert.ok(referenced.size > 0);
  for (const src of referenced) {
    const file = path.join(PUBLIC, src);
    const image = universeImage(src, 'alt');
    assert.equal(Boolean(image), existsSync(file), src);
    if (image)
      assert.deepEqual(
        { width: image.width, height: image.height },
        pngSize(file),
        src,
      );
  }
});

test('univers : metadata par buildMetadata, og:image seulement si le héros existe', () => {
  const origin = 'https://lesterresdecaldera.fr';
  const index = universeIndexMetadata();
  assert.equal(index.title, universeIndex.title);
  assert.equal(index.alternates?.canonical, `${origin}/univers`);
  for (const chapter of universeChapters) {
    const title = universeChapterTitle(chapter.slug);
    assert.ok(title.length <= TITLE_MAX, title);
    assert.ok(title.startsWith(chapter.title), title);
    const metadata = universeChapterMetadata(chapter.slug, 'Description.');
    assert.equal(metadata.title, title);
    assert.equal(
      metadata.alternates?.canonical,
      `${origin}/univers/${chapter.slug}`,
    );
    assert.deepEqual(metadata.robots, { index: true, follow: true });
    const images = metadata.openGraph?.images;
    const urls = (Array.isArray(images) ? images : [images]).map((image) =>
      typeof image === 'object' && image && 'url' in image
        ? String(image.url)
        : String(image),
    );
    const heroUrl = `${origin}${chapter.hero.src}`;
    assert.equal(
      urls.includes(heroUrl),
      existsSync(path.join(PUBLIC, chapter.hero.src)),
      chapter.slug,
    );
  }
});
