import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { GET } from '../src/app/api/finance/orders/route';
import { getPrisma } from '../src/lib/db/prisma';
import { getCeoOrderSummary } from '../src/lib/finance/ceoOrders';

test('le brief des commandes compte les dossiers à traiter sans exposer les clients', async () => {
  assert.ok(
    process.env.NODE_ENV !== 'production' &&
      ['localhost', '127.0.0.1'].includes(
        new URL(process.env.DATABASE_URL!).hostname,
      ),
    'Ce test écrit uniquement dans PostgreSQL local',
  );
  const db = getPrisma();
  const now = new Date();
  const ago = (hours: number) => new Date(now.getTime() - hours * 3_600_000);
  const before = await getCeoOrderSummary(now);
  const fixture = randomUUID();
  const category = await db.category.create({
    data: { name: 'Fixture de briefing CEO', slug: `fixture-ceo-${fixture}` },
  });
  const product = await db.product.create({
    data: {
      name: 'Précommande test',
      slug: `fixture-ceo-${fixture}`,
      categoryId: category.id,
      productType: 'BOOSTER',
      preorder: true,
      releaseDate: new Date(now.getTime() + 14 * 86_400_000),
      variants: { create: { sku: `CEO-${fixture}`, price: 10 } },
    },
    include: { variants: true },
  });
  const orderIds: string[] = [];
  const checkoutIds: string[] = [];
  const cartIds: string[] = [];
  const oldSecret = process.env.FINANCE_REPORT_SECRET;
  try {
    const makeOrder = async (
      kind:
        | 'ready'
        | 'preorder'
        | 'inconsistent'
        | 'processing'
        | 'review'
        | 'refunded',
    ) => {
      const id = randomUUID().replaceAll('-', '');
      const checkout = await db.checkoutSession.create({
        data: {
          expiresAt: now,
          cart: { create: { expiresAt: now, tokenHash: id.repeat(2) } },
        },
      });
      checkoutIds.push(checkout.id);
      cartIds.push(checkout.cartId);
      const paid = kind !== 'processing' && kind !== 'review';
      const verified = paid && kind !== 'inconsistent';
      const variantId = product.variants[0]!.id;
      const order = await db.order.create({
        data: {
          checkoutSessionId: checkout.id,
          publicId: id.repeat(2),
          orderNumber: `QA-CEO-${id}`,
          email: 'ceo-fixture@example.invalid',
          currency: 'EUR',
          subtotalAmount: 10,
          shippingAmount: 0,
          totalAmount: 10,
          shippingMethodCode: 'fixture',
          shippingMethodName: 'Fixture',
          status: paid
            ? 'PAID'
            : kind === 'review'
              ? 'PAYMENT_REVIEW'
              : 'PAYMENT_PROCESSING',
          paidAt: paid ? ago(49) : null,
          fulfillmentStatus: kind === 'ready' ? 'READY_TO_SHIP' : 'UNFULFILLED',
          updatedAt: ago(2),
          ...(verified && {
            payment: {
              create: { status: 'SUCCEEDED', amount: 10, currency: 'EUR' },
            },
            reservations: {
              create: {
                variantId,
                quantity: 1,
                status: 'CONSUMED',
                expiresAt: now,
              },
            },
          }),
          ...(kind === 'preorder' && {
            items: {
              create: {
                productId: product.id,
                variantId,
                productName: product.name,
                productSlug: product.slug,
                sku: product.variants[0]!.sku,
                imageUrl: '/fixture',
                language: 'FR',
                quantity: 1,
                unitPrice: 10,
                lineTotal: 10,
              },
            },
          }),
        },
        include: { payment: true },
      });
      orderIds.push(order.id);
      if (kind === 'refunded')
        await db.refund.create({
          data: {
            orderId: order.id,
            paymentId: order.payment!.id,
            status: 'SUCCEEDED',
            reason: 'OTHER',
            amount: 10,
            currency: 'EUR',
            idempotencyKey: `ceo-${id}`,
          },
        });
    };
    for (const kind of [
      'ready',
      'preorder',
      'inconsistent',
      'processing',
      'review',
      'refunded',
    ] as const)
      await makeOrder(kind);

    const after = await getCeoOrderSummary(now);
    assert.equal(after.toPrepare, before.toPrepare);
    assert.equal(after.readyToShip, before.readyToShip + 1);
    assert.equal(after.waitingPreorder, before.waitingPreorder + 1);
    assert.equal(after.awaitingShipment48h, before.awaitingShipment48h + 1);
    assert.equal(
      after.inconsistentPaidOrders,
      before.inconsistentPaidOrders + 1,
    );
    assert.equal(after.paymentProcessing1h, before.paymentProcessing1h + 1);
    assert.equal(after.paymentReview, before.paymentReview + 1);

    process.env.FINANCE_REPORT_SECRET = 'test-only-ceo-report-secret';
    const url = 'http://localhost/api/finance/orders';
    assert.equal((await GET(new Request(url))).status, 401);
    const response = await GET(
      new Request(url, {
        headers: {
          authorization: `Bearer ${process.env.FINANCE_REPORT_SECRET}`,
        },
      }),
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.doesNotMatch(await response.text(), /example\.invalid|QA-CEO-/);
  } finally {
    if (oldSecret === undefined) delete process.env.FINANCE_REPORT_SECRET;
    else process.env.FINANCE_REPORT_SECRET = oldSecret;
    const where = { orderId: { in: orderIds } };
    await db.refund.deleteMany({ where });
    await db.stockReservation.deleteMany({ where });
    await db.orderItem.deleteMany({ where });
    await db.payment.deleteMany({ where });
    await db.order.deleteMany({ where: { id: { in: orderIds } } });
    await db.checkoutSession.deleteMany({ where: { id: { in: checkoutIds } } });
    await db.cart.deleteMany({ where: { id: { in: cartIds } } });
    await db.productVariant.deleteMany({ where: { productId: product.id } });
    await db.product.delete({ where: { id: product.id } });
    await db.category.delete({ where: { id: category.id } });
    await db.$disconnect();
  }
});
