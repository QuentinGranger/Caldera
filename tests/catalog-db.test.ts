import 'dotenv/config';
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { Prisma } from '../src/generated/prisma/client';
import { getPrisma } from '../src/lib/db/prisma';
import {
  getProducts,
  getProductBySlug,
  getFeaturedProducts,
  getNewProducts,
  getProductsByCategory,
  getProductsBySet,
  getRestockedProducts,
  getLastPiecesProducts,
} from '../src/lib/catalog/queries';
if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1'].includes(
    new URL(process.env.DATABASE_URL ?? 'invalid:').hostname,
  )
)
  throw new Error('Ces tests sont réservés à une base de développement.');
const db = getPrisma();
after(() => db.$disconnect());
const knownCode = (code: string) => (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
async function rejectedWrite(
  operation: (tx: Prisma.TransactionClient) => Promise<unknown>,
  code: string,
) {
  await assert.rejects(
    db.$transaction(async (tx) => {
      await operation(tx);
      throw new Error('La contrainte attendue n’a pas bloqué l’écriture.');
    }),
    knownCode(code),
  );
}
test('seed : identités uniques et relations conservées après plusieurs exécutions', async () => {
  assert.equal(
    await db.product.count({ where: { slug: { startsWith: 'dev-' } } }),
    20,
  );
  assert.equal(
    await db.productVariant.count({ where: { sku: { startsWith: 'DEV-' } } }),
    23,
  );
  assert.equal(
    await db.productImage.count({
      where: { product: { slug: { startsWith: 'dev-' } } },
    }),
    22,
  );
  const sets = await db.tcgSet.findMany({
    where: { slug: { startsWith: 'dev-' } },
    select: { gameId: true },
  });
  assert.equal(sets.length, 4);
  assert.ok(sets.every((set) => set.gameId));
  // Families are cross-game roots; the game is its own axis.
  const roots = await db.category.findMany({
    where: { isActive: true, parentId: null },
    select: { slug: true },
    orderBy: { sortOrder: 'asc' },
  });
  assert.deepEqual(
    roots.map((category) => category.slug),
    ['scelles', 'cartes', 'accessoires'],
  );
  assert.equal(
    await db.category.count({ where: { slug: 'pokemon', isActive: true } }),
    0,
  );
  assert.deepEqual(
    (
      await db.game.findMany({
        where: { isActive: true },
        select: { slug: true },
        orderBy: { sortOrder: 'asc' },
      })
    ).map((game) => game.slug),
    ['pokemon'],
  );
  // A product with a set belongs to the set's game; game-less = multi-game.
  for (const product of await db.product.findMany({
    where: { slug: { startsWith: 'dev-' } },
    select: { gameId: true, tcgSet: { select: { gameId: true } } },
  }))
    if (product.tcgSet) assert.equal(product.gameId, product.tcgSet.gameId);
  assert.equal(
    (
      await db.product.findUniqueOrThrow({
        where: { slug: 'dev-protege-cartes' },
        select: { gameId: true },
      })
    ).gameId,
    null,
  );
  const product = await db.product.findUniqueOrThrow({
    where: { slug: 'dev-etb-terres-de-braise' },
    include: { variants: true, images: true },
  });
  assert.equal(product.variants.length, 3);
  assert.equal(product.images.length, 3);
});
test('lecture : statuts, variantes, DTO public, prix minimum et listes spécialisées', async () => {
  const products = await getProducts();
  assert.equal(products.filter((p) => p.slug.startsWith('dev-')).length, 17);
  for (const slug of ['dev-brouillon', 'dev-archive', 'inexistant'])
    assert.equal(await getProductBySlug(slug), null);
  const product = await getProductBySlug('dev-etb-terres-de-braise');
  assert.ok(product);
  assert.equal(product.price, '54.90');
  assert.equal(product.priceFrom, true);
  assert.equal(product.variants.length, 2);
  assert.ok(product.variants.some((v) => v.sku === 'DEV-ETB-BRAISE-FR'));
  assert.equal(product.availability, 'IN_STOCK');
  for (const value of [products, product]) {
    const json = JSON.stringify(value);
    assert.ok(
      !/costPrice|stockQuantity|DATABASE_URL|lowStockThreshold/.test(json),
    );
    assert.deepEqual(JSON.parse(json), value);
  }
  assert.equal((await getFeaturedProducts(2)).length, 2);
  assert.equal((await getNewProducts(4)).length, 4);
  assert.ok(
    (await getProductsByCategory('scelles')).some(
      (p) => p.slug === 'dev-etb-terres-de-braise',
    ),
  );
  assert.deepEqual(await getProductsByCategory('pokemon'), []);
  assert.equal((await getProductsBySet('dev-terres-de-braise')).length, 2);
  assert.deepEqual(await getProductsByCategory('inexistant'), []);
  assert.deepEqual(await getProductsBySet('inexistant'), []);
  assert.equal((await getRestockedProducts()).length, 3);
  await assert.rejects(getFeaturedProducts(0), RangeError);
});
test('lecture : dernières pièces, comptées comme sur la fiche produit', async () => {
  const lastPieces = (await getLastPiecesProducts(20)).filter((product) =>
    product.slug.startsWith('dev-'),
  );
  const slugs = lastPieces.map((product) => product.slug);
  // At the threshold itself (2 left, threshold 2): last pieces.
  assert.ok(slugs.includes('dev-tripack-expedition'));
  // One variant still above its threshold: the product is not running out.
  assert.ok(!slugs.includes('dev-etb-terres-de-braise'));
  // A preorder or a sold-out product is never among the last pieces.
  assert.ok(!slugs.includes('dev-coffret-aurores'));
  assert.ok(!slugs.includes('dev-display-vallees'));
  for (const product of lastPieces) {
    assert.equal(product.availability, 'LOW_STOCK');
    assert.ok(product.lowStockLeft && product.lowStockLeft > 0);
  }
  assert.equal(
    lastPieces.find((product) => product.slug === 'dev-tripack-expedition')
      ?.lowStockLeft,
    2,
  );
  // The stock of a product that is not running out stays private.
  const etb = (await getProducts()).find(
    (product) => product.slug === 'dev-etb-terres-de-braise',
  );
  assert.equal(etb?.lowStockLeft, undefined);
});
test('UNIQUE PostgreSQL : slugs, SKU et barcode nullable', async () => {
  const product = await db.product.findUniqueOrThrow({
    where: { slug: 'dev-etb-terres-de-braise' },
  });
  const variant = await db.productVariant.findUniqueOrThrow({
    where: { sku: 'DEV-ETB-BRAISE-FR' },
  });
  await rejectedWrite(
    (tx) =>
      tx.product.create({
        data: {
          name: 'collision',
          slug: product.slug,
          productType: 'ETB',
          categoryId: product.categoryId,
        },
      }),
    'P2002',
  );
  await rejectedWrite(
    (tx) =>
      tx.productVariant.create({
        data: { sku: variant.sku, productId: product.id, price: '1.00' },
      }),
    'P2002',
  );
  await rejectedWrite(
    (tx) =>
      tx.category.create({ data: { name: 'collision', slug: 'scelles' } }),
    'P2002',
  );
  await rejectedWrite(
    (tx) => tx.game.create({ data: { name: 'collision', slug: 'pokemon' } }),
    'P2002',
  );
  await rejectedWrite(
    (tx) =>
      tx.tcgSet.create({
        data: { name: 'collision', slug: 'dev-terres-de-braise' },
      }),
    'P2002',
  );
  await rejectedWrite(
    (tx) =>
      tx.tag.create({ data: { name: 'collision', slug: 'demonstration' } }),
    'P2002',
  );
  await rejectedWrite(async (tx) => {
    await tx.productVariant.update({
      where: { sku: 'DEV-ETB-BRAISE-FR' },
      data: { barcode: 'TEST-UNIQUE-CALDERA' },
    });
    return tx.productVariant.update({
      where: { sku: 'DEV-ETB-BRAISE-EN' },
      data: { barcode: 'TEST-UNIQUE-CALDERA' },
    });
  }, 'P2002');
  assert.ok((await db.productVariant.count({ where: { barcode: null } })) > 1);
});
test('CHECK PostgreSQL et clés étrangères : écritures invalides annulées', async () => {
  for (const [column, value] of [
    ['stockQuantity', -1],
    ['lowStockThreshold', -1],
    ['price', -1],
    ['costPrice', -1],
    ['weightGrams', 0],
  ] as const) {
    await assert.rejects(
      db.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `UPDATE "ProductVariant" SET "${column}" = $1 WHERE "sku" = $2`,
          value,
          'DEV-ETB-BRAISE-FR',
        );
        throw new Error('CHECK absent');
      }),
      (error) =>
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2010' &&
        error.message.includes('23514'),
    );
  }
  await rejectedWrite(
    (tx) => tx.category.delete({ where: { slug: 'etb' } }),
    'P2003',
  );
  await rejectedWrite(
    (tx) => tx.tcgSet.delete({ where: { slug: 'dev-terres-de-braise' } }),
    'P2003',
  );
  await rejectedWrite(
    (tx) => tx.game.delete({ where: { slug: 'pokemon' } }),
    'P2003',
  );
  await rejectedWrite(
    (tx) => tx.product.delete({ where: { slug: 'dev-etb-terres-de-braise' } }),
    'P2003',
  );
  const variant = await db.productVariant.findUniqueOrThrow({
    where: { sku: 'DEV-ETB-BRAISE-FR' },
  });
  assert.equal(variant.price.toFixed(2), '59.90');
});
