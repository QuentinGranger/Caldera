import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { getPrisma } from '../src/lib/db/prisma';
import { getProductBySlug } from '../src/lib/catalog/queries';
import { getComplementaryProducts } from '../src/lib/catalog/getComplementaryProducts';

if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1'].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  )
)
  throw new Error('Base locale de test uniquement.');

const db = getPrisma();
test('compléments : tags explicites, stock réel, variantes disponibles et absence de doublon', async () => {
  const key = randomUUID().slice(0, 8);
  const category = await db.category.create({
    data: { name: 'QA protections', slug: 'qa-protections-' + key },
  });
  const ids: string[] = [];
  async function create(
    name: string,
    type: 'ETB' | 'DISPLAY' | 'ACCESSORY',
    tags: string[] = [],
    stock = 3,
    demo = false,
  ) {
    const row = await db.product.create({
      data: {
        name,
        slug: 'qa-' + name + '-' + key,
        categoryId: category.id,
        status: 'ACTIVE',
        productType: type,
        isDemonstration: demo,
        tags: {
          connectOrCreate: tags.map((slug) => ({
            where: { slug },
            create: { name: slug, slug },
          })),
        },
        variants: {
          create: {
            sku: name + '-' + key,
            price: '9.90',
            stockQuantity: stock,
          },
        },
      },
    });
    ids.push(row.id);
    return row;
  }
  try {
    const etb = await create('etb', 'ETB');
    const box = await create('box', 'ACCESSORY', ['protection-etb']);
    const sleeve = await create('sleeve', 'ACCESSORY', [
      'sleeves',
      'top-loaders',
    ]);
    await create('rupture', 'ACCESSORY', ['sleeves'], 0);
    await create('exemple', 'ACCESSORY', ['sleeves'], 3, true);
    await create('classeur-non-tague', 'ACCESSORY');
    // Unavailable cheap version must not distort the recommended price.
    await db.productVariant.create({
      data: {
        productId: sleeve.id,
        sku: 'cheap-' + key,
        price: '.01',
        stockQuantity: 0,
      },
    });
    const product = (await getProductBySlug(etb.slug))!;
    const items = await getComplementaryProducts(product);
    assert.deepEqual(
      items.map((item) => item.id),
      [box.id, sleeve.id],
    );
    assert.equal(items[1]?.price, '9.90');
    const display = await create('display', 'DISPLAY');
    const displayItems = await getComplementaryProducts(
      (await getProductBySlug(display.slug))!,
    );
    assert.deepEqual(
      displayItems.map((item) => item.id),
      [sleeve.id],
    );
    assert.equal(
      new Set(displayItems.map((item) => item.id)).size,
      displayItems.length,
    );
    assert.deepEqual(
      await getComplementaryProducts({
        ...product,
        availability: 'OUT_OF_STOCK',
      }),
      [],
    );
    assert.deepEqual(
      await getComplementaryProducts({ ...product, isDemonstration: true }),
      [],
    );
    assert.deepEqual(
      await getComplementaryProducts({ ...product, productType: 'ACCESSORY' }),
      [],
    );
    await db.productVariant.updateMany({
      where: { productId: { in: [box.id, sleeve.id] } },
      data: { stockQuantity: 0 },
    });
    assert.deepEqual(await getComplementaryProducts(product), []);
  } finally {
    await db.productVariant.deleteMany({ where: { productId: { in: ids } } });
    await db.product.deleteMany({ where: { id: { in: ids } } });
    await db.category.delete({ where: { id: category.id } });
    await db.$disconnect();
  }
});
