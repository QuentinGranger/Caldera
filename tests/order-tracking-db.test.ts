import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { GET } from '../src/app/api/finance/order-events/route';
import { getPrisma } from '../src/lib/db/prisma';

if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1'].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  )
)
  throw Error('Base locale requise.');
const db = getPrisma();
const secret = randomUUID();
const feed = (after = '0:0', auth: string = secret) =>
  GET(
    new Request(
      'http://localhost/api/finance/order-events?after=' +
        encodeURIComponent(after),
      { headers: { Authorization: 'Bearer ' + auth } },
    ),
  );
type Event = {
  reference: string;
  kind: string;
  status: string;
  fulfillment: string;
  cursor: string;
  previousStatus: string | null;
};
test('Journal Make : autorisation, transactions, pagination et reprise', async () => {
  const previous = process.env.FINANCE_REPORT_SECRET;
  process.env.FINANCE_REPORT_SECRET = secret;
  const ref = 'MAKE-' + randomUUID();
  const expiresAt = new Date(Date.now() + 60000);
  const cart = await db.cart.create({
    data: { tokenHash: randomUUID().replaceAll('-', '').repeat(2), expiresAt },
  });
  const checkout = await db.checkoutSession.create({
    data: { cartId: cart.id, expiresAt },
  });
  try {
    assert.equal((await feed('0:0', 'incorrect')).status, 401);
    assert.equal((await feed('18446744073709551616:0')).status, 400);
    // Start after all previously committed rows in this development database.
    const [last] = await db.$queryRaw<
      { cursor: string }[]
    >`SELECT writer::text || ':' || id::text cursor FROM "OrderTrackingEvent" ORDER BY writer DESC,id DESC LIMIT 1`;
    const start = last?.cursor ?? '0:0';
    const o = await db.order.create({
      data: {
        checkoutSessionId: checkout.id,
        publicId: randomUUID().replaceAll('-', '').repeat(2),
        orderNumber: ref,
        email: 'test@example.invalid',
        currency: 'EUR',
        subtotalAmount: '1',
        shippingAmount: '0',
        totalAmount: '1',
        shippingMethodCode: 'TEST',
        shippingMethodName: 'Test',
      },
    });
    await db.order.update({
      where: { id: o.id },
      data: { internalNote: 'jamais exportée', status: o.status },
    });
    await assert.rejects(
      db.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: o.id },
          data: { status: 'CANCELLED' },
        });
        throw Error('rollback');
      }),
      /rollback/,
    );
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_current_xact_id()::text`;
      await db.order.update({ where: { id: o.id }, data: { status: 'PAID' } });
      const during = await (await feed(start)).json();
      assert.deepEqual(
        during.events
          .filter((e: Event) => e.reference === ref)
          .map((e: Event) => e.kind),
        ['CREATED'],
      );
      await tx.order.update({
        where: { id: o.id },
        data: { fulfillmentStatus: 'PREPARING' },
      });
    });
    const result = await feed(start);
    assert.equal(result.status, 200);
    const body = await result.json();
    const events: Event[] = body.events.filter(
      (e: Event) => e.reference === ref,
    );
    assert.equal(events.length, 3);
    assert.ok(
      events.some(
        (e) => e.previousStatus === 'PENDING_PAYMENT' && e.status === 'PAID',
      ),
    );
    assert.ok(events.some((e) => e.fulfillment === 'PREPARING'));
    assert.doesNotMatch(
      JSON.stringify(body),
      /example.invalid|jamais exportée/,
    );
    const cursor = events.at(-1)!.cursor;
    await db.$transaction(async (tx) => {
      for (let i = 0; i < 101; i++)
        await tx.order.update({
          where: { id: o.id },
          data: {
            fulfillmentStatus: i % 2 === 0 ? 'READY_TO_SHIP' : 'PREPARING',
          },
        });
    });
    const first = await (await feed(cursor)).json();
    assert.equal(first.events.length, 100);
    assert.equal(first.hasMore, true);
    const second = await (await feed(first.events.at(-1).cursor)).json();
    assert.equal(second.events.length, 1);
    assert.equal(second.hasMore, false);
    assert.deepEqual((await (await feed(cursor)).json()).events, first.events);
  } finally {
    await db.order.deleteMany({ where: { checkoutSessionId: checkout.id } });
    await db.checkoutSession.delete({ where: { id: checkout.id } });
    await db.cart.delete({ where: { id: cart.id } });
    await db.$executeRaw`DELETE FROM "OrderTrackingEvent" WHERE reference=${ref}`;
    if (previous === undefined) delete process.env.FINANCE_REPORT_SECRET;
    else process.env.FINANCE_REPORT_SECRET = previous;
    await db.$disconnect();
  }
});
