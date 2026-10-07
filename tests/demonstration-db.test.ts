import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test, after } from 'node:test';
import { getPrisma } from '../src/lib/db/prisma';
import { mutateCart } from '../src/lib/cart/service';
import { getProductRoute, getProducts } from '../src/lib/catalog/queries';
import { productStructuredData } from '../src/lib/product/seo';
import {
  queueProductRelease,
  queueProductRestock,
} from '../src/lib/discord/outbox';
import { subscribeToStockAlert } from '../src/lib/stock-alerts/service';
if (
  !['localhost', '127.0.0.1'].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  )
)
  throw Error('Base locale uniquement');
const db = getPrisma();
after(() => db.$disconnect());
test('examples remain visible but cannot be ordered, subscribed to or announced, even with stock', async () => {
  const key = randomUUID();
  const category = await db.category.create({
    data: { name: 'Exemple test', slug: 'example-test-' + key },
  });
  const product = await db.product.create({
    data: {
      name: '[Exemple] Produit',
      slug: 'exemple-' + key,
      categoryId: category.id,
      productType: 'BOOSTER',
      status: 'ACTIVE',
      isDemonstration: true,
      newArrival: true,
      releaseDate: new Date('2020-01-01'),
      variants: {
        create: { sku: 'EXAMPLE-' + key, price: '10.00', stockQuantity: 100 },
      },
    },
    include: { variants: true },
  });
  const enabled = process.env.DISCORD_PUBLICATIONS_ENABLED;
  try {
    await assert.rejects(
      mutateCart(undefined, {
        kind: 'add',
        variantId: product.variants[0]!.id,
        quantity: 1,
      }),
    );
    assert.equal(
      await db.cartItem.count({
        where: { variantId: product.variants[0]!.id },
      }),
      0,
    );
    const route = await getProductRoute(product.slug);
    assert.ok(route.state === 'visible');
    assert.equal(route.product.isDemonstration, true);
    assert.equal(route.product.quickAddVariantId, null);
    assert.equal(route.product.price, null);
    assert.equal(productStructuredData(route.product), null);
    assert.ok((await getProducts(100)).some((p) => p.id === product.id));
    assert.equal(
      await subscribeToStockAlert({
        email: 'example@example.invalid',
        variantId: product.variants[0]!.id,
        customer: null,
      }),
      'not-found',
    );
    process.env.DISCORD_PUBLICATIONS_ENABLED = 'true';
    await db.$transaction(async (tx) => {
      await queueProductRelease(tx, product.id);
      await queueProductRestock(tx, product.id);
    });
    assert.equal(
      await db.discordOutbox.count({ where: { productId: product.id } }),
      0,
    );
  } finally {
    if (enabled === undefined) delete process.env.DISCORD_PUBLICATIONS_ENABLED;
    else process.env.DISCORD_PUBLICATIONS_ENABLED = enabled;
    await db.productVariant.deleteMany({ where: { productId: product.id } });
    await db.product.delete({ where: { id: product.id } });
    await db.category.delete({ where: { id: category.id } });
  }
});
