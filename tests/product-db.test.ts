import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { getPrisma } from '../src/lib/db/prisma';
import { getProductBySlug } from '../src/lib/catalog/queries';
import { getRelatedProducts } from '../src/lib/catalog/getRelatedProducts';
import { getCategories } from '../src/lib/catalog/taxonomy';
import { selectProductVariant } from '../src/lib/product/purchase';
import {
  familyLineage,
  indexablePaths,
  productBreadcrumb,
  productParents,
  productTrailLevels,
} from '../src/lib/product/navigation';
import {
  productPageMetadata,
  resolveProductRoute,
} from '../src/lib/product/page';
import { productStructuredData } from '../src/lib/product/seo';
import {
  graph,
  organizationNode,
  serializeJsonLd,
} from '../src/lib/seo/jsonld';
import { loadLandingIndex } from '../src/lib/seo/registry';
const db = getPrisma();
after(() => db.$disconnect());
test('fiche : variantes actives, galerie ordonnée et DTO public', async () => {
  const product = await getProductBySlug('dev-etb-terres-de-braise');
  assert.ok(product);
  assert.equal(product.images.length, 3);
  assert.equal(product.images[0]?.isPrimary, true);
  assert.deepEqual(
    product.images.map((i) => i.sortOrder),
    [0, 1, 2],
  );
  assert.equal(product.variants.length, 2);
  const selected = selectProductVariant(product.variants);
  assert.equal(selected?.sku, 'DEV-ETB-BRAISE-FR');
  assert.equal(selected?.price, '59.90');
  assert.equal(selected?.maxQuantity, 7);
  const en = selectProductVariant(product.variants, 'DEV-ETB-BRAISE-EN');
  assert.equal(en?.price, '54.90');
  assert.equal(en?.availability, 'LOW_STOCK');
  assert.equal(en?.lowStockQuantity, 2);
  assert.ok(!JSON.stringify(product).includes('costPrice'));
  assert.deepEqual(JSON.parse(JSON.stringify(product)), product);
  const inactive = await getProductBySlug('dev-variante-inactive');
  assert.ok(inactive);
  assert.deepEqual(inactive.variants, []);
  assert.equal(await getProductBySlug('dev-brouillon'), null);
  assert.equal(await getProductBySlug('dev-archive'), null);
});
test('précommande et related products cohérents, disponibles d’abord, sans duplication ni produit courant', async () => {
  const preorder = await getProductBySlug('dev-coffret-aurores');
  assert.ok(preorder);
  assert.equal(
    preorder.variants.find((v) => v.language === 'EN')?.maxQuantity,
    3,
  );
  // A preorder variant with no quota left cannot be ordered: sold out.
  assert.ok(
    preorder.variants.every(
      (v) =>
        v.availability === (v.maxQuantity > 0 ? 'PREORDER' : 'OUT_OF_STOCK'),
    ),
  );
  assert.ok(preorder.variants.some((v) => v.availability === 'PREORDER'));
  const product = await getProductBySlug('dev-display-aurores-jp');
  assert.ok(product);
  const related = await getRelatedProducts(product);
  assert.equal(related.length, 4);
  assert.equal(new Set(related.map((p) => p.id)).size, 4);
  assert.ok(related.every((p) => p.id !== product.id));
  assert.equal(related[0]?.tcgSet?.slug, product.tcgSet?.slug);
  const sold = await getProductBySlug('dev-display-vallees');
  assert.ok(sold);
  assert.equal(sold.availability, 'OUT_OF_STOCK');
  const alternatives = await getRelatedProducts(sold);
  const firstSoldOut = alternatives.findIndex(
    (p) => p.availability === 'OUT_OF_STOCK',
  );
  assert.ok(alternatives.some((p) => p.availability !== 'OUT_OF_STOCK'));
  if (firstSoldOut >= 0)
    assert.ok(
      alternatives
        .slice(firstSoldOut)
        .every((p) => p.availability === 'OUT_OF_STOCK'),
    );
});
test('routage : page indexable, sans variante noindex, archivé 308, brouillon et inconnu 404', async () => {
  const visible = await resolveProductRoute(
    'dev-etb-terres-de-braise',
    loadLandingIndex,
  );
  assert.equal(visible.type, 'page');
  assert.ok(visible.type === 'page' && visible.decision.index);
  const noVariant = await resolveProductRoute(
    'dev-variante-inactive',
    loadLandingIndex,
  );
  assert.ok(noVariant.type === 'page');
  assert.equal(noVariant.decision.index, false);
  assert.equal(noVariant.decision.reason, 'no-active-variant');
  assert.equal(
    noVariant.decision.canonicalPath,
    '/produit/dev-variante-inactive',
  );
  // dev-archive: Pokémon booster without set; /pokemon/boosters is indexable.
  const index = await loadLandingIndex();
  assert.ok(index.landings.some((page) => page.path === '/pokemon/boosters'));
  assert.deepEqual(await resolveProductRoute('dev-archive', loadLandingIndex), {
    type: 'redirect',
    path: '/pokemon/boosters',
  });
  for (const slug of ['dev-brouillon', `inexistant-${randomUUID()}`])
    assert.deepEqual(await resolveProductRoute(slug, loadLandingIndex), {
      type: 'not-found',
    });
});
test('routage : ancien slug → 308 vers le slug actuel, ou directement vers le parent d’un produit archivé', async () => {
  const [current, archived] = await Promise.all([
    db.product.findUniqueOrThrow({
      where: { slug: 'dev-etb-terres-de-braise' },
      select: { id: true },
    }),
    db.product.findUniqueOrThrow({
      where: { slug: 'dev-archive' },
      select: { id: true },
    }),
  ]);
  const suffix = randomUUID();
  const renamed = `test-ancien-slug-${suffix}`;
  const renamedArchive = `test-ancienne-archive-${suffix}`;
  await db.slugRedirect.createMany({
    data: [
      { entityType: 'PRODUCT', fromSlug: renamed, entityId: current.id },
      {
        entityType: 'PRODUCT',
        fromSlug: renamedArchive,
        entityId: archived.id,
      },
    ],
  });
  try {
    assert.deepEqual(await resolveProductRoute(renamed, loadLandingIndex), {
      type: 'redirect',
      path: '/produit/dev-etb-terres-de-braise',
    });
    assert.deepEqual(
      await resolveProductRoute(renamedArchive, loadLandingIndex),
      { type: 'redirect', path: '/pokemon/boosters' },
    );
  } finally {
    await db.slugRedirect.deleteMany({
      where: { fromSlug: { in: [renamed, renamedArchive] } },
    });
  }
});
test('fil d’Ariane : jeu puis extension indexables, sans niveau non indexable', async () => {
  const product = await getProductBySlug('dev-etb-terres-de-braise');
  assert.ok(product?.game && product.tcgSet);
  const [index, categories] = await Promise.all([
    loadLandingIndex(),
    getCategories(),
  ]);
  const isIndexable = indexablePaths(index);
  const parents = productParents(
    {
      game: product.game,
      set: product.tcgSet,
      families: familyLineage(categories, product.categoryInfo.id),
    },
    isIndexable,
  );
  const items = productBreadcrumb(productTrailLevels(parents), product.name);
  assert.equal(items[0]?.href, '/');
  assert.equal(items.at(-1)?.label, product.name);
  assert.equal(items.at(-1)?.href, undefined);
  assert.equal(items[1]?.href, '/pokemon');
  assert.equal(items[2]?.href, '/pokemon/dev-terres-de-braise');
  for (const item of items.slice(1, -1))
    assert.ok(item.href && isIndexable(item.href), item.href);
});
test('SEO : offres réelles par variante, noindex sans variante et échappement JSON-LD', async () => {
  const product = await getProductBySlug('dev-etb-terres-de-braise');
  assert.ok(product);
  const node = productStructuredData(product);
  assert.ok(node);
  const data = JSON.parse(JSON.stringify(node));
  assert.equal(data['@type'], 'Product');
  assert.deepEqual(
    data.offers.map((offer: { sku: string; price: string }) => [
      offer.sku,
      offer.price,
    ]),
    [
      ['DEV-ETB-BRAISE-FR', '59.90'],
      ['DEV-ETB-BRAISE-EN', '54.90'],
    ],
  );
  assert.ok(
    data.offers.every(
      (offer: { availability: string }) =>
        offer.availability === 'https://schema.org/InStock',
    ),
  );
  assert.equal(data.brand.name, 'Pokémon');
  // Development visuals are placeholders: never published as product images.
  assert.equal(data.image, undefined);
  assert.ok(
    !/costPrice|DEV-ETB-BRAISE-JP|review|rating/.test(JSON.stringify(data)),
  );
  const preorder = await getProductBySlug('dev-coffret-aurores');
  assert.ok(preorder?.releaseDate);
  const preorderData = JSON.parse(
    JSON.stringify(productStructuredData(preorder)),
  );
  type PreorderOffer = { availability: string; availabilityStarts?: string };
  const offers = preorderData.offers as PreorderOffer[];
  assert.ok(
    offers.some(
      (offer) => offer.availability === 'https://schema.org/PreOrder',
    ),
  );
  // PreOrder offers carry the release date; an exhausted preorder is OutOfStock.
  for (const offer of offers)
    assert.ok(
      offer.availability === 'https://schema.org/PreOrder'
        ? offer.availabilityStarts === preorder.releaseDate?.slice(0, 10)
        : offer.availability === 'https://schema.org/OutOfStock' &&
            offer.availabilityStarts === undefined,
    );
  const serialized = serializeJsonLd(
    graph(
      organizationNode(),
      productStructuredData({
        ...product,
        name: '</script><script>alert(1)</script>',
      }),
    ),
  );
  assert.ok(!serialized.includes('<'));
  assert.ok(serialized.includes('\\u003c'));
  const previous = process.env.SITE_URL;
  try {
    process.env.SITE_URL = 'https://caldera.example';
    const route = await resolveProductRoute(
      'dev-etb-terres-de-braise',
      loadLandingIndex,
    );
    assert.ok(route.type === 'page');
    const metadata = productPageMetadata(route.product, route.decision);
    assert.equal(
      metadata.alternates?.canonical,
      'https://caldera.example/produit/dev-etb-terres-de-braise',
    );
    assert.deepEqual(metadata.robots, { index: true, follow: true });
    assert.ok(!String(metadata.title).includes('Caldera'));
    assert.ok(!JSON.stringify(metadata.openGraph).includes('placeholder'));
    const inactive = await resolveProductRoute(
      'dev-variante-inactive',
      loadLandingIndex,
    );
    assert.ok(inactive.type === 'page');
    assert.deepEqual(
      productPageMetadata(inactive.product, inactive.decision).robots,
      { index: false, follow: true },
    );
    assert.equal(productStructuredData(inactive.product), null);
  } finally {
    if (previous === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = previous;
  }
});
