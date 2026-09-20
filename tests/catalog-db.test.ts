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
} from '../src/lib/catalog/queries';
if (process.env.NODE_ENV === 'production')
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
  });
  assert.equal(sets.length, 3);
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
    (await getProductsByCategory('pokemon')).some(
      (p) => p.slug === 'dev-etb-terres-de-braise',
    ),
  );
  assert.equal((await getProductsBySet('dev-terres-de-braise')).length, 2);
  assert.deepEqual(await getProductsByCategory('inexistant'), []);
  assert.deepEqual(await getProductsBySet('inexistant'), []);
  assert.equal((await getRestockedProducts()).length, 3);
  await assert.rejects(getFeaturedProducts(0), RangeError);
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
      tx.category.create({ data: { name: 'collision', slug: 'pokemon' } }),
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
    (tx) => tx.product.delete({ where: { slug: 'dev-etb-terres-de-braise' } }),
    'P2003',
  );
  const variant = await db.productVariant.findUniqueOrThrow({
    where: { sku: 'DEV-ETB-BRAISE-FR' },
  });
  assert.equal(variant.price.toFixed(2), '59.90');
});
