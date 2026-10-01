import 'dotenv/config';
import assert from 'node:assert/strict';
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
