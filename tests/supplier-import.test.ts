import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  decodeText,
  detectDelimiter,
  parseCsv,
  parseCsvRecords,
} from '../src/lib/supplier-import/csv';
import { tableFromRecords } from '../src/lib/supplier-import/table';
import {
  availabilityFromText,
  inferDateOrder,
  inferDecimal,
  normalizeDate,
  normalizeEan,
  normalizeInteger,
  normalizeLanguage,
  normalizeMoney,
  normalizeRate,
  normalizeRow,
  packSizeFrom,
  type NormalizedValues,
  type NormalizeOptions,
} from '../src/lib/supplier-import/normalize';
import {
  inferOptions,
  signatureSource,
  suggestMapping,
} from '../src/lib/supplier-import/mapping';
import { tableFromPages, type Word } from '../src/lib/supplier-import/layout';
import {
  createMatcher,
  nameSimilarity,
  productTypeFrom,
  type CatalogVariant,
} from '../src/lib/supplier-import/matching';
import {
  analyzeRows,
  diffOffer,
  disappearedOffers,
  summarize,
  type OfferSnapshot,
} from '../src/lib/supplier-import/analysis';

const options: NormalizeOptions = {
  decimal: ',',
  dateOrder: 'DMY',
  defaultLanguage: null,
  defaultVatRate: '20.00',
};

test('import CSV : encodage, séparateur, guillemets et en-tête décalé', () => {
  const latin1 = new Uint8Array([
    0x52, 0xe9, 0x66, 0x3b, 0x50, 0x72, 0x69, 0x78,
  ]); // « Réf;Prix »
  assert.deepEqual(decodeText(latin1), {
    text: 'Réf;Prix',
    encoding: 'windows-1252',
  });
  const bom = new Uint8Array([0xef, 0xbb, 0xbf, 0x41]);
  assert.deepEqual(decodeText(bom), { text: 'A', encoding: 'utf-8' });
  assert.equal(detectDelimiter('a;b;c\n1;2,5;3\n4;5,5;6'), ';');
  assert.equal(detectDelimiter('a,b,c\n1,"2,5",3\n4,5,6'), ',');
  assert.equal(detectDelimiter('a\tb\n1\t2'), '\t');
  assert.deepEqual(
    parseCsvRecords(
      'ref;nom\n"A;1";"Coffret ""Braise""\nédition 2"\r\nB2;Deck',
      ';',
    ),
    [
      ['ref', 'nom'],
      ['A;1', 'Coffret "Braise"\nédition 2'],
      ['B2', 'Deck'],
    ],
  );
  const csv = parseCsv(
    new TextEncoder().encode(
      'Tarif fournisseur octobre 2026;;\n;;\nRéférence;Désignation;PA HT\nETB-1;Coffret;39,90\n;;\nRéférence;Désignation;PA HT\nDIS-2;Display;129,00\n',
    ),
  );
  assert.deepEqual(csv.headers, ['Référence', 'Désignation', 'PA HT']);
  assert.deepEqual(
    csv.rows.map((row) => [row.number, row.cells[0]]),
    [
      [4, 'ETB-1'],
      [7, 'DIS-2'],
    ],
  );
  assert.equal(csv.skipped, 4);
  assert.deepEqual(
    tableFromRecords([
      ['1', '2'],
      ['3', '4'],
    ]).headers,
    [],
  );
  assert.deepEqual(
    tableFromRecords([
      ['Prix', 'Prix', ''],
      ['1', '2', ''],
    ]).headers,
    ['Prix', 'Prix (2)'],
  );
});

test('normalisation : EAN, prix, TVA, quantités', () => {
  assert.equal(normalizeEan('3 760 052 142 223').value, null); // mauvaise clé
  assert.equal(normalizeEan('0820650853517').value, '0820650853517');
  assert.equal(normalizeEan('820650853517').value, '0820650853517');
  assert.equal(normalizeEan('00820650853517').value, '0820650853517');
  assert.match(
    normalizeEan('8.20651E+11').issue!.problem,
    /notation scientifique/,
  );
  assert.match(normalizeEan('123456').issue!.problem, /EAN invalide/);
  assert.equal(normalizeEan('').value, null);
  assert.equal(normalizeEan('').issue, undefined);

  assert.equal(normalizeMoney('39,90 €', ',').value, '39.90');
  assert.equal(normalizeMoney('1 234,5', ',').value, '1234.50');
  assert.equal(normalizeMoney('1.234,56', ',').value, '1234.56');
  assert.equal(normalizeMoney('1,234.56', ',').value, '1234.56');
  assert.equal(normalizeMoney('12.5 EUR HT', ',').value, '12.50');
  assert.equal(normalizeMoney('0', ',').value, '0.00');
  assert.equal(normalizeMoney('NC', ',').value, null);
  assert.equal(normalizeMoney('NC', ',').issue, undefined);
  assert.match(
    normalizeMoney('sur demande', ',').issue!.problem,
    /impossible à interpréter/,
  );
  assert.equal(normalizeMoney('1.234', ',').issue!.level, 'review');
  assert.equal(normalizeMoney('1,234', '.').issue!.level, 'review');
  assert.equal(normalizeMoney('12,345', ',').issue!.level, 'review');
  assert.match(normalizeMoney('-5', ',').issue!.problem, /négatif/);

  assert.equal(normalizeRate('20 %', ',').value, '20.00');
  assert.equal(normalizeRate('0,2', ',').value, '20.00');
  assert.equal(normalizeRate('5,5', ',').value, '5.50');
  assert.equal(normalizeRate('19,6', ',').issue!.level, 'review');

  assert.equal(normalizeInteger('24').value, 24);
  assert.equal(normalizeInteger('24,0').value, 24);
  assert.equal(normalizeInteger('> 100').value, 100);
  assert.equal(normalizeInteger('100+').issue!.level, 'info');
  assert.equal(normalizeInteger('En stock').availability, 'IN_STOCK');
  assert.equal(normalizeInteger('2,5').issue!.level, 'error');
  assert.equal(normalizeInteger('-3').issue!.level, 'error');
});

test('normalisation : dates, langues, disponibilité, conditionnement', () => {
  assert.equal(normalizeDate('15/11/2026', 'DMY').value, '2026-11-15');
  assert.equal(normalizeDate('11/15/2026', 'MDY').value, '2026-11-15');
  assert.equal(normalizeDate('2026-11-15', 'MDY').value, '2026-11-15');
  assert.equal(normalizeDate('15.11.26', 'DMY').value, '2026-11-15');
  assert.equal(normalizeDate('15 novembre 2026', 'DMY').value, '2026-11-15');
  assert.equal(normalizeDate('31/02/2026', 'DMY').issue!.level, 'error');
  assert.equal(normalizeDate('novembre 2026', 'DMY').issue!.level, 'review');
  assert.equal(normalizeDate('T4 2026', 'DMY').issue!.level, 'review');
  assert.equal(normalizeDate('TBA', 'DMY').issue!.level, 'info');
  assert.deepEqual(inferDateOrder(['03/04/2026', '25/12/2026']), {
    order: 'DMY',
    certain: true,
  });
  assert.deepEqual(inferDateOrder(['03/04/2026', '12/25/2026']), {
    order: 'MDY',
    certain: true,
  });
  assert.deepEqual(inferDateOrder(['03/04/2026']), {
    order: 'DMY',
    certain: false,
  });

  assert.equal(normalizeLanguage('Français').value, 'FR');
  assert.equal(normalizeLanguage('VF').value, 'FR');
  assert.equal(normalizeLanguage('JAP').value, 'JP');
  assert.equal(normalizeLanguage('VO').issue!.level, 'review');
  assert.equal(availabilityFromText('Rupture'), 'OUT_OF_STOCK');
  assert.equal(availabilityFromText('Précommande'), 'PREORDER');
  assert.equal(availabilityFromText('Sur commande'), 'ON_ORDER');
  assert.equal(availabilityFromText('Fin de série'), 'DISCONTINUED');
  assert.equal(availabilityFromText('peut-être'), 'UNKNOWN');
  assert.equal(packSizeFrom('Display de 36 boosters'), 36);
  assert.equal(packSizeFrom('Carton x6'), 6);
  assert.equal(packSizeFrom('Unité'), 1);
  assert.equal(packSizeFrom('Vrac'), null);
  assert.equal(inferDecimal(['39,90', '1 234,50', '12']), ',');
  assert.equal(inferDecimal(['39.90', '1,234.50']), '.');
});

test('normalisation d’une ligne : dérivations signalées, jamais silencieuses', () => {
  const mapping = {
    supplierSku: 'Réf',
    name: 'Désignation',
    purchasePriceInclTax: 'PA TTC',
    stock: 'Stock',
    releaseDate: 'Sortie',
  };
  const { values, issues } = normalizeRow(
    {
      Réf: ' ETB-1 ',
      Désignation: 'Coffret  Braise (FR)',
      'PA TTC': '47,88',
      Stock: '0',
      Sortie: '15/11/2099',
    },
    mapping,
    options,
  );
  assert.equal(values.supplierSku, 'ETB-1');
  assert.equal(values.name, 'Coffret Braise (FR)');
  assert.equal(values.purchasePrice, '39.90');
  assert.equal(values.language, 'FR');
  assert.equal(values.availability, 'PREORDER');
  assert.ok(
    issues.some(
      (issue) =>
        issue.problem.startsWith('Prix HT calculé') && issue.level === 'info',
    ),
  );
  assert.ok(issues.some((issue) => issue.problem === 'Langue déduite du nom'));

  const empty = normalizeRow({ Réf: '', Désignation: '12' }, mapping, options);
  assert.deepEqual(
    empty.issues
      .filter((issue) => issue.level === 'error')
      .map((issue) => issue.field)
      .sort(),
    ['name', 'supplierSku'],
  );
  const byEan = normalizeRow(
    { EAN: '0820650853517', Nom: 'Deck de combat' },
    { ean: 'EAN', name: 'Nom' },
    options,
  );
  assert.equal(byEan.values.supplierSku, '0820650853517');
});

test('mapping automatique : noms de colonnes et valeurs', () => {
  const headers = [
    'Code article',
    'Libellé',
    'Gencod',
    'PA HT',
    'PVC',
    'Qté dispo',
    'Colonne X',
    'Visuel',
  ];
  const sample = [
    [
      'A1',
      'Coffret',
      '0820650853517',
      '39,90',
      '59,90',
      '4',
      'zzz',
      'https://cdn.example.com/a.jpg',
    ],
    [
      'A2',
      'Display',
      '0820650853524',
      '129,00',
      '215,64',
      '0',
      'yyy',
      'https://cdn.example.com/b.png',
    ],
  ];
  const { mapping, confidence } = suggestMapping(headers, sample);
  assert.equal(mapping.supplierSku, 'Code article');
  assert.equal(mapping.name, 'Libellé');
  assert.equal(mapping.ean, 'Gencod');
  assert.equal(mapping.purchasePrice, 'PA HT');
  assert.equal(mapping.msrp, 'PVC');
  assert.equal(mapping.stock, 'Qté dispo');
  assert.equal(mapping.imageUrl, 'Visuel');
  assert.ok(!Object.values(mapping).includes('Colonne X'));
  assert.equal(confidence.supplierSku, 1);
  // Une colonne « EAN » dont les valeurs ne sont pas des EAN est affaiblie.
  const weak = suggestMapping(
    ['EAN', 'Nom'],
    [
      ['abc', 'x'],
      ['def', 'y'],
    ],
  );
  assert.equal(weak.mapping.ean, undefined);
  // Barcodes with a wrong check digit: mapped, then flagged row by row.
  assert.equal(
    suggestMapping(
      ['Code EAN', 'Nom'],
      [
        ['3760052142223', 'x'],
        ['', 'y'],
      ],
    ).mapping.ean,
    'Code EAN',
  );
  assert.equal(signatureSource(['PA HT', 'Réf ', 'réf']), 'pa ht|ref');
  const inferred = inferOptions(
    ['PA', 'Sortie'],
    [['1.234,50', '25/12/2026']],
    { purchasePrice: 'PA', releaseDate: 'Sortie' },
  );
  assert.deepEqual(inferred, {
    decimal: ',',
    dateOrder: 'DMY',
    dateOrderCertain: true,
  });
});

test('PDF : tableau reconstruit depuis les positions, confiance par page', () => {
  const word = (
    text: string,
    left: number,
    top: number,
    confidence?: number,
  ): Word => ({
    text,
    left,
    top,
    width: text.length * 5,
    height: 10,
    ...(confidence !== undefined ? { confidence } : {}),
  });
  const page1 = [
    word('Catalogue', 40, 20),
    word('Référence', 40, 60),
    word('Désignation', 140, 60),
    word('PA', 330, 60),
    word('HT', 345, 60),
    word('Stock', 420, 60),
    word('ETB-001', 40, 80),
    word('Coffret', 140, 80),
    word('Dresseur', 180, 80),
    word('39,90', 335, 80),
    word('24', 425, 80),
    word('Elite', 140, 92),
    word('DIS-036', 40, 110),
    word('Display', 140, 110),
    word('129,00', 330, 110),
    word('0', 430, 110),
  ];
  const page2 = [
    word('BOO-010', 42, 30),
    word('Booster', 141, 30),
    word('4,50', 338, 30),
    word('300', 424, 30),
  ];
  const { table, pages } = tableFromPages([
    { page: 1, words: page1 },
    { page: 2, words: page2 },
    { page: 3, words: [word('Conditions générales', 40, 30)] },
  ]);
  assert.deepEqual(table.headers, [
    'Référence',
    'Désignation',
    'PA HT',
    'Stock',
  ]);
  assert.deepEqual(
    table.rows.map((row) => row.cells),
    [
      ['ETB-001', 'Coffret Dresseur Elite', '39,90', '24'],
      ['DIS-036', 'Display', '129,00', '0'],
      ['BOO-010', 'Booster', '4,50', '300'],
    ],
  );
  assert.equal(table.rows[2]!.source, 'page 2');
  assert.ok(pages[0]!.confidence >= 0.9, String(pages[0]!.confidence));
  assert.ok(pages[1]!.confidence >= 0.9, String(pages[1]!.confidence));
  assert.equal(pages[2]!.rows, 0);
  assert.equal(pages[2]!.confidence, 0);
  // OCR peu sûr : la confiance baisse avec celle des mots.
  const blurry = tableFromPages([
    { page: 1, words: page1.map((w) => ({ ...w, confidence: 45 })) },
  ]);
  assert.ok(blurry.pages[0]!.confidence < 0.7);
  // Aucun en-tête reconnu : rien n’est deviné.
  const loose = tableFromPages([
    { page: 1, words: [word('Bonjour', 40, 20), word('Merci', 200, 20)] },
  ]);
  assert.deepEqual(loose.table.rows, []);
  assert.match(loose.pages[0]!.note!, /en-tête/);
});

const catalog: CatalogVariant[] = [
  {
    id: 'v-etb-fr',
    productId: 'p1',
    sku: 'ETB-BRAISE-FR',
    barcode: '0820650853517',
    language: 'FR',
    productName: 'Coffret Dresseur d’Élite Terres de Braise',
    productType: 'ETB',
    gameName: 'Pokémon',
    setName: 'Terres de Braise',
  },
  {
    id: 'v-etb-en',
    productId: 'p1',
    sku: 'ETB-BRAISE-EN',
    barcode: null,
    language: 'EN',
    productName: 'Coffret Dresseur d’Élite Terres de Braise',
    productType: 'ETB',
    gameName: 'Pokémon',
    setName: 'Terres de Braise',
  },
  {
    id: 'v-dis-fr',
    productId: 'p2',
    sku: 'DIS-BRAISE-FR',
    barcode: '0820650853524',
    language: 'FR',
    productName: 'Display Terres de Braise',
    productType: 'DISPLAY',
    gameName: 'Pokémon',
    setName: 'Terres de Braise',
  },
];
const base: NormalizedValues = {
  supplierSku: null,
  ean: null,
  name: null,
  brand: null,
  game: null,
  series: null,
  category: null,
  language: null,
  condition: null,
  purchasePrice: null,
  purchasePriceInclTax: null,
  msrp: null,
  vatRate: null,
  stock: null,
  availability: 'UNKNOWN',
  releaseDate: null,
  restockDate: null,
  minOrderQty: null,
  packaging: null,
  packSize: null,
  description: null,
  imageUrl: null,
  productUrl: null,
};

test('matching : EAN, offre connue, SKU, combinaison, nom en dernier recours', () => {
  const offers = new Map([['FRN-9', { id: 'o9', variantId: 'v-dis-fr' }]]);
  const match = createMatcher(catalog, offers);
  assert.deepEqual(
    match({ ...base, ean: '0820650853517', name: 'x' }).match,
    'CERTAIN',
  );
  assert.equal(
    match({ ...base, supplierSku: 'frn-9', name: 'x' }).variantId,
    'v-dis-fr',
  );
  assert.equal(
    match({ ...base, supplierSku: 'etb-braise-en', name: 'x' }).variantId,
    'v-etb-en',
  );
  // L’EAN et l’offre connue se contredisent : vérification manuelle.
  assert.equal(
    match({ ...base, supplierSku: 'FRN-9', ean: '0820650853517' }).match,
    'AMBIGUOUS',
  );
  const combined = match({
    ...base,
    name: 'ETB Pokémon Terres de Braise',
    language: 'FR',
  });
  assert.equal(combined.match, 'PROBABLE');
  assert.equal(combined.variantId, 'v-etb-fr');
  // Sans langue, deux variantes au même nom : jamais de choix automatique.
  const fuzzy = match({
    ...base,
    name: 'Coffret Dresseur Elite Terres de Braise',
  });
  assert.equal(fuzzy.match, 'AMBIGUOUS');
  assert.ok(fuzzy.candidates.length >= 2);
  assert.equal(
    match({ ...base, name: 'Tapis de jeu Caldera', language: 'FR' }).match,
    'NEW',
  );
  assert.ok(
    nameSimilarity('Display Terres de Braise', 'Display Terres Braise') > 0.9,
  );
  assert.equal(productTypeFrom('Coffret Dresseur Elite'), 'ETB');
  assert.equal(productTypeFrom('Booster Box 36'), 'DISPLAY');
  assert.equal(productTypeFrom('Protège-cartes x65'), 'ACCESSORY');
});

test('analyse : actions, doublons, différences et récapitulatif', () => {
  const offer: OfferSnapshot = {
    ...base,
    id: 'o1',
    supplierSku: 'ETB-1',
    variantId: 'v-etb-fr',
    name: 'Coffret Braise',
    purchasePrice: '39.90',
    stock: 0,
    availability: 'OUT_OF_STOCK',
    status: 'ACTIVE',
  };
  const gone: OfferSnapshot = { ...offer, id: 'o2', supplierSku: 'OLD-1' };
  const offers = new Map([
    ['ETB-1', offer],
    ['OLD-1', gone],
  ]);
  const match = createMatcher(
    catalog,
    new Map([['ETB-1', { id: 'o1', variantId: 'v-etb-fr' }]]),
  );
  const row = (
    number: number,
    values: Partial<NormalizedValues>,
    issues = [],
  ) => ({
    number,
    values: { ...base, ...values },
    issues,
  });
  const analysed = analyzeRows(
    [
      row(2, {
        supplierSku: 'ETB-1',
        name: 'Coffret Braise',
        purchasePrice: '37.50',
        stock: 12,
        availability: 'IN_STOCK',
      }),
      row(3, {
        supplierSku: 'NEW-1',
        ean: '0820650853531',
        name: 'Tapis de jeu Caldera',
        language: 'FR',
      }),
      row(4, { supplierSku: 'DUP', name: 'Deck A' }),
      row(5, { supplierSku: 'dup', name: 'Deck B' }),
      row(6, { supplierSku: 'X', name: 'Display Terres de Braise' }),
    ],
    match,
    offers,
  );
  assert.deepEqual(
    analysed.map((entry) => [entry.number, entry.match, entry.action]),
    [
      [2, 'CERTAIN', 'UPDATE_OFFER'],
      [3, 'NEW', 'CREATE_PRODUCT'],
      [4, 'NEW', 'REVIEW'],
      [5, 'NEW', 'REVIEW'],
      // Nom identique à un seul produit : probable, jamais automatique.
      [6, 'PROBABLE', 'REVIEW'],
    ],
  );
  assert.deepEqual(
    analysed[0]!.changes.map((change) => change.kind),
    ['PRICE_DOWN', 'BACK_IN_STOCK'],
  );
  assert.deepEqual(diffOffer(offer, { ...base, supplierSku: 'ETB-1' }), []);
  assert.deepEqual(
    diffOffer(
      { ...offer, status: 'MISSING' },
      { ...base, releaseDate: '2026-12-01' },
    ).map((c) => c.kind),
    ['REAPPEARED', 'RELEASE_DATE'],
  );
  const disappeared = disappearedOffers(analysed, offers);
  assert.deepEqual(
    disappeared.map((o) => o.supplierSku),
    ['OLD-1'],
  );
  const summary = summarize(analysed, disappeared.length);
  assert.equal(summary.rows, 5);
  assert.equal(summary.newProducts, 1);
  assert.equal(summary.offersUpdated, 1);
  assert.equal(summary.priceDown, 1);
  assert.equal(summary.backInStock, 1);
  assert.equal(summary.duplicates, 2);
  assert.equal(summary.toReview, 3);
  assert.equal(summary.disappeared, 1);
});
