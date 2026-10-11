import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { after, before, test } from 'node:test';

if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1'].includes(
    new URL(process.env.DATABASE_URL ?? 'invalid:').hostname,
  )
)
  throw new Error('Ces tests sont réservés à une base de développement.');

// Outside a Next.js server, unstable_cache (landing index, navigation) needs
// an incremental cache: this one never stores anything.
const globals = globalThis as typeof globalThis & {
  AsyncLocalStorage?: typeof AsyncLocalStorage;
  __incrementalCache?: object;
};
globals.AsyncLocalStorage ??= AsyncLocalStorage;
globals.__incrementalCache ??= {
  isOnDemandRevalidate: false,
  generateSimpleCacheKey: async (key: string) => key,
  get: async () => null,
  set: async () => undefined,
};

// Imported once the globals exist: Next.js reads them when its modules load.
const { getPrisma } = await import('../src/lib/db/prisma');
const { visibleProductWhere } = await import('../src/lib/catalog/queries');
const { getLandingIndex } = await import('../src/lib/seo/registry');
const { getNavigation } = await import('../src/lib/seo/links');
const { getShippingFacts } = await import('../src/lib/seo/shipping');
const { getAllContent } = await import('../src/lib/content');
const content = await import('../src/components/editorial/content');
const { getDeliveryPage } =
  await import('../src/components/editorial/delivery');
const { getUniverseShopLinks } =
  await import('../src/components/universe/shopLinks');

const db = getPrisma();
after(() => db.$disconnect());

let indexable: Set<string>;
before(async () => {
  const index = await getLandingIndex();
  indexable = new Set(
    [...index.landings, ...index.categoryHubs].map((page) => page.path),
  );
});

async function assertVisible(ids: readonly string[]) {
  if (!ids.length) return;
  const visible = await db.product.count({
    where: { AND: [visibleProductWhere, { id: { in: [...ids] } }] },
  });
  assert.equal(visible, ids.length, 'produit non visible affiché');
}

test('guides : produits visibles, landings indexables, contenus liés existants', async () => {
  const all = await getAllContent();
  const hrefs = new Set(all.map((entry) => entry.href));
  const guides = all.filter((entry) => entry.href.startsWith('/guides/'));
  assert.ok(guides.length > 0);
  for (const guide of guides) {
    const page = await content.getGuidePage(guide.slug);
    assert.ok(page, guide.href);
    assert.equal(page.entry.title, guide.title);
    assert.ok(page.shop.products.length <= 8);
    await assertVisible(page.shop.products.map((product) => product.id));
    for (const link of page.shop.landings)
      assert.ok(indexable.has(link.href), `${guide.href} → ${link.href}`);
    for (const related of page.related) {
      assert.ok(hrefs.has(related.href));
      assert.notEqual(related.href, guide.href);
    }
  }
  assert.equal(await content.getGuidePage('guide-inexistant'), null);
  assert.equal(await content.getGuidePage('booster'), null);
});

test('glossaire : produits du type nommé par le terme quand il y en a', async () => {
  const terms = (await getAllContent()).filter(
    (entry) => entry.kind === 'glossaire',
  );
  assert.ok(terms.length > 0);
  for (const term of terms) {
    const page = await content.getGlossaryTermPage(term.slug);
    assert.ok(page, term.href);
    await assertVisible(page.shop.products.map((product) => product.id));
    for (const link of page.shop.landings)
      assert.ok(indexable.has(link.href), `${term.href} → ${link.href}`);
    const types = content.productTypesOfTerm(term.slug);
    if (!types.length || !page.shop.products.length) continue;
    const typed = await db.product.findMany({
      where: { id: { in: page.shop.products.map((product) => product.id) } },
      select: { productType: true },
    });
    const ofType = typed.filter((row) =>
      types.includes(row.productType),
    ).length;
    // Either every product has the type, or none (fallback on the facets).
    assert.ok(ofType === 0 || ofType === typed.length, term.href);
  }
  assert.equal(
    await content.getGlossaryTermPage('etb-display-ou-booster'),
    null,
  );
});

test('index des guides et du glossaire indexables tant qu’ils ont du contenu', async () => {
  const [guides, glossary] = await Promise.all([
    content.getGuidesIndex(),
    content.getGlossaryIndex(),
  ]);
  assert.equal(guides.decision.index, guides.groups.length > 0);
  assert.equal(
    glossary.decision.index,
    glossary.document.terms.length + glossary.fiches.length > 0,
  );
  // The detailed pages listed with the A to Z: Pokémon, or no game at all.
  assert.ok(
    glossary.fiches.every(
      (entry) => !entry.games.length || entry.games.includes('pokemon'),
    ),
  );
});

test('livraison : noindex tant qu’aucun mode n’est proposé', async () => {
  const [page, facts] = await Promise.all([
    getDeliveryPage(),
    getShippingFacts(),
  ]);
  assert.deepEqual(
    page.methods.map((method) => method.code),
    facts.map((fact) => fact.code),
  );
  assert.equal(page.decision.index, facts.length > 0);
  assert.equal(page.decision.canonicalPath, '/livraison');
});

test('chroniques : liens « Dans la boutique » vers des cibles existantes', async () => {
  const [shop, navigation, guides, glossary] = await Promise.all([
    getUniverseShopLinks(),
    getNavigation(),
    content.getGuidesIndex(),
    content.getGlossaryIndex(),
  ]);
  const allowed = new Set([
    ...navigation.games.map((game) => game.href),
    ...(guides.decision.index ? ['/guides'] : []),
    ...(glossary.decision.index ? ['/glossaire'] : []),
  ]);
  for (const link of shop.links) assert.ok(allowed.has(link.href), link.href);
  assert.equal(
    new Set(shop.links.map((link) => link.href)).size,
    shop.links.length,
  );
  if (shop.exit)
    assert.ok(
      shop.exit.href === '/catalogue' || allowed.has(shop.exit.href),
      shop.exit.href,
    );
});

test('tunnel article : correspondance exacte, variantes disponibles et aucun faux CTA', async () => {
  const { getContentLinks } = await import('../src/lib/seo/links');
  const { parseCatalogParams } = await import('../src/lib/catalog/params');
  const { getCatalogProducts } =
    await import('../src/lib/catalog/getCatalogProducts');
  const etb = await db.product.findUniqueOrThrow({
    where: { slug: 'dev-etb-terres-de-braise' },
    include: { variants: true },
  });
  const beforeMode = process.env.CATALOG_DEMO_MODE;
  process.env.CATALOG_DEMO_MODE = '0';
  try {
    // EN is cheaper but sold out. The article must show the available FR price.
    await db.productVariant.updateMany({
      where: { productId: etb.id, language: 'EN' },
      data: { stockQuantity: 0 },
    });
    const shop = await getContentLinks(
      { games: ['pokemon'], categories: ['etb'] },
      { funnel: true },
    );
    assert.equal(shop.products.length, 1);
    assert.equal(shop.products[0]?.id, etb.id);
    assert.equal(shop.products[0]?.price, '59.90');
    assert.deepEqual(shop.products[0]?.languages, ['FR']);
    assert.equal(shop.browse?.label, 'Voir les produits disponibles');
    const target = new URL(shop.browse!.href, 'https://caldera.example');
    assert.equal(target.pathname, '/pokemon');
    assert.equal(target.searchParams.get('category'), 'etb');
    assert.equal(target.searchParams.get('availability'), 'in-stock');
    const list = await getCatalogProducts(
      parseCatalogParams(Object.fromEntries(target.searchParams)),
      { game: 'pokemon' },
    );
    assert.ok(list.products.some((product) => product.id === etb.id));
    assert.deepEqual(shop.landings, []);
    await db.productVariant.updateMany({
      where: { productId: etb.id },
      data: { stockQuantity: 0 },
    });
    const empty = await getContentLinks(
      { games: ['pokemon'], categories: ['etb'] },
      { funnel: true },
    );
    assert.deepEqual(empty.products, []);
    assert.equal(empty.browse, undefined);
    assert.deepEqual(empty.landings, []);
    const unknown = await getContentLinks(
      { games: ['pokemon'], sets: ['extension-inconnue'] },
      { funnel: true },
    );
    assert.deepEqual(unknown.products, []);
    assert.equal(unknown.browse, undefined);
    const accessories = await getContentLinks(
      { categories: ['accessoires'] },
      { funnel: true },
    );
    assert.ok(
      accessories.products.some(
        (product) => product.slug === 'dev-protege-cartes',
      ),
    );
    assert.ok(
      accessories.products.every(
        (product) => product.category === 'Accessoires',
      ),
    );
    assert.ok(accessories.browse?.href.startsWith('/catalogue?'));
    const extension = await getContentLinks(
      { games: ['pokemon'], sets: ['dev-aurores-sauvages'] },
      { funnel: true },
    );
    assert.ok(extension.products.length > 0);
    assert.ok(
      extension.products.every(
        (product) => product.tcgSet?.slug === 'dev-aurores-sauvages',
      ),
    );
    assert.ok(extension.browse?.href.includes('set=dev-aurores-sauvages'));
    process.env.CATALOG_DEMO_MODE = '1';
    // Ordinary development products are not examples and cannot be called such.
    const noExamples = await getContentLinks(
      { categories: ['accessoires'] },
      { funnel: true },
    );
    assert.equal(noExamples.browse, undefined);
    const accessory = await db.product.findUniqueOrThrow({
      where: { slug: 'dev-protege-cartes' },
    });
    try {
      await db.product.update({
        where: { id: accessory.id },
        data: { isDemonstration: true },
      });
      const examples = await getContentLinks(
        { categories: ['accessoires'] },
        { funnel: true },
      );
      assert.equal(examples.browse?.label, 'Voir les produits d’exemple');
      assert.equal(examples.browse?.demonstration, true);
      assert.ok(!examples.browse?.href.includes('availability'));
    } finally {
      await db.product.update({
        where: { id: accessory.id },
        data: { isDemonstration: accessory.isDemonstration },
      });
    }
  } finally {
    for (const variant of etb.variants)
      await db.productVariant.update({
        where: { id: variant.id },
        data: { stockQuantity: variant.stockQuantity },
      });
    if (beforeMode === undefined) delete process.env.CATALOG_DEMO_MODE;
    else process.env.CATALOG_DEMO_MODE = beforeMode;
  }
});

test('destination en stock : ni exemple ni variante sans prix achetable', async () => {
  const { parseCatalogParams } = await import('../src/lib/catalog/params');
  const { getCatalogProducts } =
    await import('../src/lib/catalog/getCatalogProducts');
  const key = randomUUID();
  const category = await db.category.create({
    data: { name: 'Articles QA', slug: `article-${key}` },
  });
  try {
    for (const [name, price, demonstration] of [
      ['zero', '0', false],
      ['demo', '5', true],
      ['real', '5', false],
    ] as const) {
      await db.product.create({
        data: {
          name,
          slug: `${name}-${key}`,
          status: 'ACTIVE',
          categoryId: category.id,
          productType: 'ACCESSORY',
          isDemonstration: demonstration,
          variants: {
            create: { sku: `${name}-${key}`, price, stockQuantity: 2 },
          },
        },
      });
    }
    const list = await getCatalogProducts(
      parseCatalogParams({ category: category.slug, availability: 'in-stock' }),
    );
    assert.deepEqual(
      list.products.map((product) => product.slug),
      [`real-${key}`],
    );
  } finally {
    await db.productVariant.deleteMany({
      where: { product: { categoryId: category.id } },
    });
    await db.product.deleteMany({ where: { categoryId: category.id } });
    await db.category.delete({ where: { id: category.id } });
  }
});
