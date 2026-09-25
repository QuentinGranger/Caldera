import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';
import { getPrisma } from '../src/lib/db/prisma';
import { cartTokenHash } from '../src/lib/cart/identity';
if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1'].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  )
)
  throw new Error('Tests réservés à PostgreSQL local.');
const db = getPrisma(),
  base = process.env.TEST_BASE_URL ?? 'http://localhost:3001',
  // Identique au serveur : CRON_SECRET=cron_local_http_test_only npm run start -- --port 3001
  secret = 'cron_local_http_test_only';
function cron(authorization?: string) {
  return fetch(`${base}/api/cron/maintenance`, {
    headers: authorization ? { Authorization: authorization } : {},
    redirect: 'manual',
  });
}
test('planificateur HTTP : Bearer obligatoire, réponse immédiate, stock libéré', async (t) => {
  const key = randomUUID();
  const category = await db.category.create({
    data: { name: 'HTTP planificateur', slug: `cron-http-${key}` },
  });
  const product = await db.product.create({
    data: {
      name: 'Produit HTTP planificateur',
      slug: `cron-http-${key}`,
      categoryId: category.id,
      status: 'ACTIVE',
      productType: 'ETB',
      variants: {
        create: {
          sku: `CRON-HTTP-${key}`,
          price: '59.90',
          stockQuantity: 2,
          reservedQuantity: 1,
        },
      },
    },
    include: { variants: true },
  });
  const variant = product.variants[0]!;
  const token = randomUUID().replaceAll('-', '').repeat(2);
  const cart = await db.cart.create({
    data: {
      tokenHash: cartTokenHash(token)!,
      expiresAt: new Date(Date.now() + 86400000),
    },
  });
  const checkout = await db.checkoutSession.create({
    data: { cartId: cart.id, expiresAt: new Date(Date.now() + 86400000) },
  });
  // Tentative abandonnée sans appel Stripe : l’expiration libère sans réseau.
  const order = await db.order.create({
    data: {
      checkoutSessionId: checkout.id,
      publicId: randomUUID().replaceAll('-', '').repeat(2),
      orderNumber: `CRON-HTTP-${key}`,
      status: 'PENDING_PAYMENT',
      email: 'cron-http@example.com',
      currency: 'EUR',
      subtotalAmount: '59.90',
      shippingAmount: '0',
      totalAmount: '59.90',
      shippingMethodCode: 'TEST',
      shippingMethodName: 'Livraison test',
      // Plus ancienne inspection : priorité dans le lot de 100.
      updatedAt: new Date(0),
      items: {
        create: {
          productId: product.id,
          variantId: variant.id,
          productName: 'Produit HTTP planificateur',
          productSlug: product.slug,
          sku: variant.sku,
          language: 'FR',
          unitPrice: '59.90',
          quantity: 1,
          lineTotal: '59.90',
          imageUrl: '/assets/products/placeholder-sealed.png',
        },
      },
      payment: { create: { amount: '59.90', currency: 'EUR' } },
      reservations: {
        create: {
          variantId: variant.id,
          quantity: 1,
          expiresAt: new Date(Date.now() - 60000),
        },
      },
    },
  });
  const status = async () =>
    (await db.order.findUniqueOrThrow({ where: { id: order.id } })).status;
  try {
    await t.test(
      'sans Bearer valide : 401 non mis en cache, aucune action',
      async () => {
        for (const authorization of [
          undefined,
          'Bearer faux-secret-de-test',
          `bearer ${secret}`,
          secret,
        ]) {
          const response = await cron(authorization);
          assert.equal(response.status, 401);
          assert.equal(response.headers.get('cache-control'), 'no-store');
          assert.doesNotMatch(await response.text(), /cron_local_http/);
        }
        const post = await fetch(`${base}/api/cron/maintenance`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${secret}` },
        });
        assert.equal(post.status, 405);
        await sleep(500);
        assert.equal(await status(), 'PENDING_PAYMENT');
      },
    );
    await t.test(
      'Vercel Cron : 202 immédiat puis expiration via after()',
      async () => {
        const startedAt = Date.now();
        const response = await cron(`Bearer ${secret}`);
        assert.equal(response.status, 202);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.deepEqual(await response.json(), { accepted: true });
        assert.ok(Date.now() - startedAt < 5000);
        for (let i = 0; i < 50 && (await status()) !== 'EXPIRED'; i++)
          await sleep(200);
        assert.equal(await status(), 'EXPIRED');
        const reservation = await db.stockReservation.findFirstOrThrow({
          where: { orderId: order.id },
        });
        assert.equal(reservation.status, 'EXPIRED');
        const stock = await db.productVariant.findUniqueOrThrow({
          where: { id: variant.id },
        });
        assert.deepEqual(
          { stock: stock.stockQuantity, reserved: stock.reservedQuantity },
          { stock: 2, reserved: 0 },
        );
        // Deuxième passage (livraison dupliquée par Vercel) : idempotent.
        assert.equal((await cron(`Bearer ${secret}`)).status, 202);
        await sleep(1000);
        assert.equal(
          (
            await db.productVariant.findUniqueOrThrow({
              where: { id: variant.id },
            })
          ).reservedQuantity,
          0,
        );
      },
    );
  } finally {
    await db.stockReservation.deleteMany({ where: { orderId: order.id } });
    await db.orderItem.deleteMany({ where: { orderId: order.id } });
    await db.payment.deleteMany({ where: { orderId: order.id } });
    await db.emailDelivery.deleteMany({ where: { orderId: order.id } });
    await db.order.delete({ where: { id: order.id } });
    await db.cart.deleteMany({ where: { id: cart.id } });
    await db.productVariant.delete({ where: { id: variant.id } });
    await db.product.delete({ where: { id: product.id } });
    await db.category.delete({ where: { id: category.id } });
    await db.$disconnect();
  }
});
