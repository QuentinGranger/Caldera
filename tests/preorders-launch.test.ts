import assert from 'node:assert/strict';
import { test } from 'node:test';

// This file runs in its own test process. Import the catalog only after closing
// the gate, even when CI exercises the existing preorder engine in other files.
process.env.NEXT_PUBLIC_PREORDERS_ENABLED = 'false';
const { preordersEnabled } = await import('../src/lib/catalog/preorders');
const { parseCatalogParams, catalogQuery } =
  await import('../src/lib/catalog/params');
const { catalogFilterSections } =
  await import('../src/lib/catalog/filterOptions');
const { itemIssue, assertPurchasable, validateCart } =
  await import('../src/lib/cart/validation');
const { getAllContent, getContentEntry } = await import('../src/lib/content');
const { mergeFaq } = await import('../src/components/landing/landingText');
const { buildShopFaq } = await import('../src/components/editorial/shopFaq');
const { publishedProductWhere } = await import('../src/lib/catalog/queries');

test('lancement : désactivation par défaut, activation explicite seulement', () => {
  for (const value of [undefined, '', '1', 'false', 'TRUE']) {
    if (value === undefined) delete process.env.NEXT_PUBLIC_PREORDERS_ENABLED;
    else process.env.NEXT_PUBLIC_PREORDERS_ENABLED = value;
    assert.equal(preordersEnabled(), false);
  }
  process.env.NEXT_PUBLIC_PREORDERS_ENABLED = 'true';
  assert.equal(preordersEnabled(), true);
  process.env.NEXT_PUBLIC_PREORDERS_ENABLED = 'false';
});

test('anciens liens : retirer la précommande sans perdre les autres filtres', () => {
  const filters = parseCatalogParams({
    availability: 'preorder,in-stock',
    category: 'etb',
  });
  assert.deepEqual(filters.availability, ['in-stock']);
  assert.equal(catalogQuery(filters), 'category=etb&availability=in-stock');
  const sections = catalogFilterSections(
    {
      total: 3,
      categories: [],
      types: [],
      languages: [],
      sets: [],
      availability: [
        { value: 'preorder', count: 1 },
        { value: 'in-stock', count: 2 },
      ],
      priceRange: null,
      counts: { types: {}, languages: {} },
    },
    { ...filters, category: [], availability: ['preorder'] },
    {},
  );
  assert.ok(
    sections.every((section) =>
      section.options.every((option) => option.value !== 'preorder'),
    ),
  );
});

test('serveur : aucune précommande achetable même avec du stock et un ancien panier', () => {
  assert.equal(publishedProductWhere.preorder, false);
  const variant = {
    isActive: true,
    stockQuantity: 5,
    reservedQuantity: 0,
    product: {
      status: 'ACTIVE',
      preorder: true,
      category: { isActive: true },
      tcgSet: null,
      game: null,
    },
  };
  assert.equal(itemIssue(variant, 1), 'UNAVAILABLE');
  assert.throws(() => assertPurchasable(variant, 1), /plus disponible/);
  assert.equal(
    validateCart({
      status: 'ACTIVE',
      expiresAt: new Date(Date.now() + 60_000),
      items: [{ id: 'old-item', quantity: 1, variant }],
    }).valid,
    false,
  );
  assert.equal(
    itemIssue(
      { ...variant, product: { ...variant.product, preorder: false } },
      1,
    ),
    null,
  );
});

test('contenu : pas de guide, glossaire, suggestion ou FAQ promettant des précommandes', async () => {
  const entries = await getAllContent();
  assert.ok(entries.length > 0);
  assert.ok(
    entries.every(
      (entry) => !/précommand|precommand/i.test(`${entry.title} ${entry.href}`),
    ),
  );
  assert.equal(
    await getContentEntry('guides', 'precommander-produit-scelle'),
    null,
  );
  assert.equal(await getContentEntry('glossaire', 'precommande'), null);
  assert.doesNotMatch(
    JSON.stringify(buildShopFaq([])),
    /précommand|precommand/i,
  );
  assert.deepEqual(
    mergeFaq([
      { question: 'Puis-je précommander ?', answer: 'Oui.' },
      { question: 'Quels produits ?', answer: 'Des boosters.' },
    ]),
    [{ question: 'Quels produits ?', answer: 'Des boosters.' }],
  );
});
