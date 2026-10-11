import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { after, test } from 'node:test';
import { getPrisma } from '../src/lib/db/prisma';
import { planLifecycle } from '../src/lib/lifecycle/planner';
import {
  processLifecycleEmails,
  currentLifecycleContent,
} from '../src/lib/lifecycle/processor';
import { DAY } from '../src/lib/lifecycle/policy';
import type { EmailEnvelope, EmailProvider } from '../src/lib/email/provider';
if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1'].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  )
)
  throw new Error('Base locale de test uniquement.');
const db = getPrisma();
after(() => db.$disconnect());
test('automations : événements vrais, opt-in, plafonds, concurrence et annulation après achat', async () => {
  const key = randomUUID(),
    now = new Date(),
    past = (days: number) => new Date(now.getTime() - days * DAY),
    future = new Date(now.getTime() + 7 * DAY);
  const runtime = await db.lifecycleRuntime.findUnique({
    where: { id: 'default' },
  });
  await db.lifecycleRuntime.upsert({
    where: { id: 'default' },
    create: { id: 'default', startedAt: past(20) },
    update: { startedAt: past(20), subscriberCursor: null },
  });
  const category = await db.category.create({
    data: { name: 'QA lifecycle', slug: `qa-lifecycle-${key}` },
  });
  const p = await db.product.create({
    data: {
      name: 'QA ETB',
      slug: `qa-etb-${key}`,
      productType: 'ETB',
      status: 'ACTIVE',
      categoryId: category.id,
      publishedAt: past(0.1),
      newArrival: true,
      variants: {
        create: {
          sku: `QA-LIFECYCLE-${key}`,
          price: '49.90',
          stockQuantity: 0,
          lowStockThreshold: 3,
        },
      },
    },
    include: { variants: true },
  });
  const variant = p.variants[0]!;
  const subscriberIds: string[] = [],
    cartIds: string[] = [],
    orderIds: string[] = [],
    customerIds: string[] = [];
  const subscriber = async (name: string, personal = true, welcome = false) => {
    const s = await db.newsletterSubscriber.create({
      data: {
        email: `${name}-${key}@example.com`,
        status: 'ACTIVE',
        consentAt: past(30),
        consentVersion: 'test',
        confirmedAt: welcome ? past(0.01) : past(25),
        lastInterestAt: past(25),
        personalizedEmails: personal,
        personalizedConsentAt: personal ? past(30) : null,
      },
    });
    subscriberIds.push(s.id);
    return s;
  };
  const checkout = async (email: string, days: number) => {
    const cart = await db.cart.create({
      data: {
        tokenHash: randomBytes(32).toString('hex'),
        expiresAt: future,
        updatedAt: past(days),
        items: {
          create: { variantId: variant.id, quantity: 2, updatedAt: past(days) },
        },
      },
    });
    cartIds.push(cart.id);
    return db.checkoutSession.create({
      data: {
        cartId: cart.id,
        email,
        expiresAt: future,
        updatedAt: past(days),
      },
    });
  };
  const order = async (
    email: string,
    paid: number,
    delivered: number | null,
  ) => {
    const co = await checkout(email, paid);
    const o = await db.order.create({
      data: {
        checkoutSessionId: co.id,
        email,
        publicId: randomBytes(32).toString('hex'),
        orderNumber: `QA-${randomUUID()}`,
        status: 'PAID',
        currency: 'EUR',
        subtotalAmount: '49.90',
        shippingAmount: '0',
        totalAmount: '49.90',
        shippingMethodCode: 'QA',
        shippingMethodName: 'QA',
        paidAt: past(paid),
        deliveredAt: delivered === null ? null : past(delivered),
        fulfillmentStatus: delivered === null ? 'SHIPPED' : 'DELIVERED',
        payment: {
          create: { status: 'SUCCEEDED', amount: '49.90', currency: 'EUR' },
        },
        items: {
          create: {
            productId: p.id,
            variantId: variant.id,
            productName: p.name,
            productSlug: p.slug,
            sku: variant.sku,
            language: 'FR',
            unitPrice: '49.90',
            quantity: 1,
            lineTotal: '49.90',
            imageUrl: '/test.png',
          },
        },
      },
    });
    orderIds.push(o.id);
    return o;
  };
  try {
    const welcome = await subscriber('welcome', false, true),
      cart = await subscriber('cart'),
      fav = await subscriber('favorite'),
      buyer = await subscriber('buyer'),
      inactive = await subscriber('inactive');
    const customer = await db.customer.create({
      data: {
        email: fav.email,
        name: 'QA',
        emailVerified: true,
        wishlistItems: { create: { productId: p.id, createdAt: past(1) } },
      },
    });
    customerIds.push(customer.id);
    const co = await checkout(cart.email, 1.5);
    await order(buyer.email, 6, 4);
    await order(inactive.email, 80, 75);
    await planLifecycle(now);
    assert.equal(
      await db.lifecycleDelivery.count({
        where: { subscriberId: fav.id, kind: 'FAVORITE_RESTOCK' },
      }),
      0,
      'initial observation is not a restock',
    );
    await db.productVariant.update({
      where: { id: variant.id },
      data: { stockQuantity: 2 },
    });
    const first = await planLifecycle(now);
    assert.ok(first.queued > 0);
    assert.equal(
      await db.lifecycleDelivery.count({
        where: { subscriberId: welcome.id, kind: 'WELCOME' },
      }),
      1,
    );
    assert.equal(
      await db.lifecycleDelivery.count({
        where: { subscriberId: welcome.id, kind: 'CART_FIRST' },
      }),
      0,
    );
    for (const [id, kind] of [
      [cart.id, 'CART_FIRST'],
      [fav.id, 'FAVORITE_RESTOCK'],
      [fav.id, 'LOW_STOCK'],
      [buyer.id, 'POST_PURCHASE'],
      [inactive.id, 'WIN_BACK'],
    ] as const)
      assert.equal(
        await db.lifecycleDelivery.count({ where: { subscriberId: id, kind } }),
        1,
        kind,
      );
    assert.equal(
      (await planLifecycle(now)).queued,
      0,
      'same events do not duplicate',
    );
    const welcomeRow = await db.lifecycleDelivery.findFirstOrThrow({
      where: { subscriberId: welcome.id, kind: 'WELCOME' },
    });
    const sent: EmailEnvelope[] = [];
    const provider: EmailProvider = {
      name: 'qa',
      async send(envelope) {
        sent.push(envelope);
        return { id: 'qa-' + sent.length };
      },
    };
    const options = {
      provider,
      settings: {
        from: 'Caldera <qa@example.com>',
        replyTo: undefined,
        testRecipient: 'qa@example.com',
      },
      limit: 1,
      now,
      deliveryId: welcomeRow.id,
    };
    await Promise.all([
      processLifecycleEmails(options),
      processLifecycleEmails(options),
    ]);
    assert.equal(sent.length, 1, 'concurrent workers send once');
    await processLifecycleEmails(options);
    assert.equal(sent.length, 1, 'already sent never repeats');
    const newRow = await db.lifecycleDelivery.findFirstOrThrow({
      where: { subscriberId: welcome.id, kind: 'NEW_ARRIVAL' },
    });
    await processLifecycleEmails({ ...options, deliveryId: newRow.id });
    assert.equal(
      sent.length,
      1,
      'welcome suppresses another commercial message',
    );
    const cartRow = await db.lifecycleDelivery.findFirstOrThrow({
      where: { subscriberId: cart.id, kind: 'CART_FIRST' },
    });
    assert.ok(await currentLifecycleContent(cartRow, cart.email));
    await db.checkoutSession.update({
      where: { id: co.id },
      data: { status: 'COMPLETED' },
    });
    assert.equal(
      await currentLifecycleContent(cartRow, cart.email),
      null,
      'completed checkout cancels reminder',
    );
    await db.newsletterSubscriber.update({
      where: { id: fav.id },
      data: { status: 'UNSUBSCRIBED' },
    });
    const favoriteRow = await db.lifecycleDelivery.findFirstOrThrow({
      where: { subscriberId: fav.id, kind: 'FAVORITE_RESTOCK' },
    });
    await processLifecycleEmails({ ...options, deliveryId: favoriteRow.id });
    assert.equal(sent.length, 1, 'unsubscribe checked before send');
    assert.equal(
      (
        await db.lifecycleDelivery.findUniqueOrThrow({
          where: { id: favoriteRow.id },
        })
      ).status,
      'SKIPPED',
    );
  } finally {
    await db.newsletterSubscriber.deleteMany({
      where: { id: { in: subscriberIds } },
    });
    await db.customer.deleteMany({ where: { id: { in: customerIds } } });
    await db.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await db.payment.deleteMany({ where: { orderId: { in: orderIds } } });
    await db.order.deleteMany({ where: { id: { in: orderIds } } });
    await db.checkoutSession.deleteMany({ where: { cartId: { in: cartIds } } });
    await db.cartItem.deleteMany({ where: { cartId: { in: cartIds } } });
    await db.cart.deleteMany({ where: { id: { in: cartIds } } });
    await db.lifecycleVariantState.deleteMany({
      where: { variantId: variant.id },
    });
    await db.productVariant.deleteMany({ where: { productId: p.id } });
    await db.product.delete({ where: { id: p.id } });
    await db.category.delete({ where: { id: category.id } });
    await db.lifecycleRuntime.update({
      where: { id: 'default' },
      data: {
        startedAt: runtime?.startedAt ?? now,
        subscriberCursor: null,
        leaseUntil: null,
        leaseToken: null,
      },
    });
  }
});
