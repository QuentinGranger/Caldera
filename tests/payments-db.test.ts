import { getCatalogProducts } from '../src/lib/catalog/getCatalogProducts';
import { parseCatalogParams } from '../src/lib/catalog/params';
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { getPrisma } from '../src/lib/db/prisma';
import { cartTokenHash } from '../src/lib/cart/identity';
import { mutateCart } from '../src/lib/cart/service';
import { getCartByToken } from '../src/lib/cart/queries';
import { mutateCheckout } from '../src/lib/checkout/service';
import { getCheckoutData } from '../src/lib/checkout/queries';
import { emptyAddress } from '../src/lib/checkout/types';
import { prepareOrder } from '../src/lib/orders/prepare';
import { getOwnedOrder } from '../src/lib/orders/queries';
import { orderInclude } from '../src/lib/orders/common';
import { ensureIntent, paymentPreflight } from '../src/lib/payments/intents';
import {
  cancelOrder,
  expireReservations,
  currentOrder,
} from '../src/lib/payments/cancel';
import { processPaymentEvent } from '../src/lib/payments/events';
import type { Intent, PaymentGateway } from '../src/lib/stripe/stripe';
import { getProductBySlug } from '../src/lib/catalog/queries';
if (process.env.NODE_ENV === 'production')
  throw new Error('Tests réservés à la base de développement.');
const db = getPrisma();
// Only the network boundary is fake. All order/cart/stock operations use PostgreSQL.
class Gateway implements PaymentGateway {
  intents = new Map<string, Intent>();
  keys = new Map<string, string>();
  creates = 0;
  async create(
    input: {
      amount: number;
      currency: string;
      metadata: { orderId: string; orderNumber: string };
    },
    key: string,
  ) {
    const existing = this.keys.get(key);
    if (existing) return this.retrieve(existing);
    const id = `pi_test_${randomUUID()}`;
    const intent: Intent = {
      ...input,
      id,
      amount_received: 0,
      status: 'requires_payment_method',
      livemode: false,
      client_secret: 'local-test-only',
    };
    this.intents.set(id, intent);
    this.keys.set(key, id);
    this.creates++;
    return { ...intent };
  }
  async retrieve(id: string) {
    return { ...this.intents.get(id)! };
  }
  async cancel(id: string) {
    const current = this.intents.get(id)!;
    if (['succeeded', 'processing'].includes(current.status))
      throw new Error('Not cancelable');
    current.status = 'canceled';
    return { ...current };
  }
  succeed(id: string) {
    const row = this.intents.get(id)!;
    row.status = 'succeeded';
    row.amount_received = row.amount;
    return { ...row };
  }
}
test('paiements : transactions, concurrence et idempotence PostgreSQL', async (t) => {
  const key = randomUUID(),
    tokens = new Set<string>(),
    gateway = new Gateway(),
    events: string[] = [];
  const category = await db.category.create({
    data: { name: 'Test paiement', slug: `payment-${key}` },
  });
  const product = await db.product.create({
    data: {
      name: 'Coffret snapshot',
      slug: `payment-${key}`,
      categoryId: category.id,
      status: 'ACTIVE',
      productType: 'ETB',
      variants: {
        create: { sku: `PAY-${key}`, price: '59.90', stockQuantity: 5 },
      },
    },
    include: { variants: true },
  });
  const variantId = product.variants[0]!.id;
  const country = await db.shippingCountry.findFirstOrThrow({
    where: { isActive: true },
  });
  const method = await db.shippingMethod.create({
    data: {
      code: `PAY-${key}`,
      name: 'Livraison test',
      price: '5.90',
      countries: { connect: { code: country.code } },
    },
  });
  const address = {
    ...emptyAddress(),
    firstName: 'Client',
    lastName: 'Test',
    addressLine1: '1 rue des Tests',
    postalCode: country.code === 'BE' ? '1000' : '75001',
    city: 'Ville test',
    countryCode: country.code,
  };
  async function ready(quantity = 1) {
    const token = await mutateCart(undefined, {
      kind: 'add',
      variantId,
      quantity,
    });
    tokens.add(token);
    await mutateCheckout(token, { kind: 'start' });
    const sessionId = (await getCheckoutData(token))!.session!.id;
    await mutateCheckout(token, {
      kind: 'contact',
      sessionId,
      contact: {
        email: 'payment@example.com',
        phone: '',
        billingSame: true,
        shipping: address,
        billing: null,
      },
    });
    await mutateCheckout(token, {
      kind: 'shipping',
      sessionId,
      methodId: method.id,
    });
    await mutateCheckout(token, { kind: 'prepare', sessionId });
    return { token, sessionId };
  }
  const stock = () =>
    db.productVariant.findUniqueOrThrow({ where: { id: variantId } });
  async function reset(quantity = 5) {
    await db.productVariant.update({
      where: { id: variantId },
      data: { stockQuantity: quantity },
    });
  }
  async function event(
    intent: Intent,
    type = 'payment_intent.succeeded',
    id = `evt_${randomUUID()}`,
  ) {
    events.push(id);
    await processPaymentEvent(id, type, intent);
    return id;
  }
  async function order(quantity = 1) {
    const draft = await ready(quantity);
    return {
      ...draft,
      order: await prepareOrder(draft.token, draft.sessionId),
    };
  }
  try {
    await t.test(
      'une unité et deux clients simultanés : un seul gagnant',
      async () => {
        await reset(1);
        const a = await ready(),
          b = await ready();
        const results = await Promise.allSettled([
          prepareOrder(a.token, a.sessionId),
          prepareOrder(b.token, b.sessionId),
        ]);
        assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
        assert.equal((await stock()).reservedQuantity, 1);
        assert.equal((await stock()).availableQuantity, 0);
        const winner = results.find((r) => r.status === 'fulfilled');
        assert.ok(winner?.status === 'fulfilled');
        await cancelOrder(winner.value.id, false, gateway);
        await reset();
      },
    );
    await t.test(
      'stock 5 : réserver 3 interdit une seconde réservation de 3',
      async () => {
        const a = await ready(3),
          b = await ready(3),
          first = await prepareOrder(a.token, a.sessionId);
        await assert.rejects(prepareOrder(b.token, b.sessionId));
        assert.equal((await stock()).availableQuantity, 2);
        assert.equal(
          (await getProductBySlug(product.slug))!.variants[0]!.maxQuantity,
          2,
        );
        await cancelOrder(first.id, false, gateway);
        await cancelOrder(first.id, false, gateway);
        assert.equal((await stock()).reservedQuantity, 0);
        assert.equal((await stock()).stockQuantity, 5);
      },
    );
    await t.test(
      'double clic, refresh et accès tiers : une commande, une réservation, un intent',
      async () => {
        const draft = await ready();
        const [a, b] = await Promise.all([
          prepareOrder(draft.token, draft.sessionId),
          prepareOrder(draft.token, draft.sessionId),
        ]);
        assert.equal(a.id, b.id);
        const count = gateway.creates;
        const [pi1, pi2] = await Promise.all([
          ensureIntent(a.id, gateway),
          ensureIntent(a.id, gateway),
        ]);
        assert.equal(pi1.id, pi2.id);
        assert.equal(gateway.creates, count + 1);
        assert.equal((await ensureIntent(a.id, gateway)).id, pi1.id);
        assert.equal(await getOwnedOrder(a.publicId, '0'.repeat(64)), null);
        await assert.rejects(
          mutateCart(draft.token, { kind: 'add', variantId, quantity: 1 }),
        );
        await assert.rejects(
          mutateCheckout(draft.token, {
            kind: 'contact',
            sessionId: draft.sessionId,
            contact: {},
          }),
        );
        await cancelOrder(a.id, false, gateway);
        await cancelOrder(a.id, false, gateway);
        assert.equal((await stock()).reservedQuantity, 0);
      },
    );
    await t.test(
      'prix et livraison changés après validation : aucune commande créée',
      async () => {
        const draft = await ready();
        await db.productVariant.update({
          where: { id: variantId },
          data: { price: '60.00' },
        });
        await assert.rejects(prepareOrder(draft.token, draft.sessionId));
        await db.productVariant.update({
          where: { id: variantId },
          data: { price: '59.90' },
        });
        await mutateCheckout(draft.token, {
          kind: 'prepare',
          sessionId: draft.sessionId,
        });
        await db.shippingMethod.update({
          where: { id: method.id },
          data: { price: '6.00' },
        });
        await assert.rejects(prepareOrder(draft.token, draft.sessionId));
        assert.equal(
          await db.order.count({
            where: { checkoutSessionId: draft.sessionId },
          }),
          0,
        );
        await db.shippingMethod.update({
          where: { id: method.id },
          data: { price: '5.90' },
        });
      },
    );
    await t.test(
      'webhook : montant, devise et metadata divergents refusés',
      async () => {
        const a = await order(),
          pi = await ensureIntent(a.order.id, gateway),
          paid = gateway.succeed(pi.id);
        for (const bad of [
          { ...paid, amount: 1 },
          { ...paid, currency: 'usd' },
          { ...paid, metadata: { ...paid.metadata, orderNumber: 'wrong' } },
          { ...paid, livemode: true },
        ])
          await assert.rejects(event(bad));
        assert.equal(
          (await currentOrder(a.order.id)).status,
          'PENDING_PAYMENT',
        );
        await event(paid);
        await reset();
      },
    );
    await t.test(
      'consommation une seule fois, snapshots stables, panier converti',
      async () => {
        const a = await order(2),
          pi = await ensureIntent(a.order.id, gateway);
        await db.product.update({
          where: { id: product.id },
          data: { name: 'Nom modifié' },
        });
        await db.productVariant.update({
          where: { id: variantId },
          data: { price: '99.00' },
        });
        await db.checkoutAddress.updateMany({
          where: { checkoutId: a.sessionId },
          data: { city: 'Autre ville' },
        });
        const success = gateway.succeed(pi.id),
          id = `evt_${randomUUID()}`;
        await Promise.all([
          event(success, undefined, id),
          event(success, undefined, id),
        ]);
        await event(success);
        await event(
          { ...success, status: 'requires_payment_method' },
          'payment_intent.payment_failed',
        );
        const current = await currentOrder(a.order.id);
        assert.equal(current.status, 'PAID');
        assert.equal(current.fulfillmentStatus, 'UNFULFILLED');
        const confirmations = await db.emailDelivery.findMany({
          where: { orderId: current.id, type: 'ORDER_CONFIRMATION' },
        });
        assert.equal(confirmations.length, 1);
        assert.equal(confirmations[0]!.status, 'PENDING');
        assert.equal(confirmations[0]!.attemptCount, 0);
        assert.equal(current.payment!.status, 'SUCCEEDED');
        assert.equal(current.items[0]!.productName, 'Coffret snapshot');
        assert.equal(current.items[0]!.unitPrice.toFixed(2), '59.90');
        assert.equal(current.addresses[0]!.city, 'Ville test');
        assert.equal(current.reservations[0]!.status, 'CONSUMED');
        assert.equal((await stock()).stockQuantity, 3);
        assert.equal((await stock()).reservedQuantity, 0);
        assert.equal(
          (
            await db.checkoutSession.findUniqueOrThrow({
              where: { id: a.sessionId },
            })
          ).status,
          'COMPLETED',
        );
        assert.equal((await getCartByToken(a.token)).itemCount, 0);
        await assert.rejects(paymentPreflight(a.order.id));
        await db.productVariant.update({
          where: { id: variantId },
          data: { price: '59.90' },
        });
        const next = await mutateCart(a.token, {
          kind: 'add',
          variantId,
          quantity: 1,
        });
        tokens.add(next);
        assert.notEqual(next, a.token);
        await db.product.update({
          where: { id: product.id },
          data: { name: 'Coffret snapshot' },
        });
        await reset();
      },
    );
    await t.test('échec puis retry : même intent, stock conservé', async () => {
      const a = await order(),
        pi = await ensureIntent(a.order.id, gateway);
      await event(pi, 'payment_intent.payment_failed');
      assert.equal((await currentOrder(a.order.id)).status, 'PAYMENT_FAILED');
      assert.equal((await ensureIntent(a.order.id, gateway)).id, pi.id);
      assert.equal((await stock()).reservedQuantity, 1);
      await event(gateway.succeed(pi.id));
      await reset();
    });
    await t.test(
      'crash DB avant Stripe : expiration sans appel Stripe',
      async () => {
        const a = await order();
        await db.stockReservation.updateMany({
          where: { orderId: a.order.id },
          data: { expiresAt: new Date(0) },
        });
        await assert.rejects(paymentPreflight(a.order.id));
        const count = gateway.creates;
        await expireReservations(gateway);
        assert.equal(gateway.creates, count);
        assert.equal((await currentOrder(a.order.id)).status, 'EXPIRED');
        assert.equal((await stock()).reservedQuantity, 0);
      },
    );
    await t.test(
      'réponse réseau perdue : récupération même clé puis annulation',
      async () => {
        const a = await order(),
          count = gateway.creates;
        const unreliable: PaymentGateway = {
          ...gateway,
          retrieve: gateway.retrieve.bind(gateway),
          cancel: gateway.cancel.bind(gateway),
          create: async (input, key) => {
            await gateway.create(input, key);
            throw new Error('Lost response');
          },
        };
        await assert.rejects(ensureIntent(a.order.id, unreliable));
        await db.stockReservation.updateMany({
          where: { orderId: a.order.id },
          data: { expiresAt: new Date(0) },
        });
        await cancelOrder(a.order.id, true, gateway);
        assert.equal(gateway.creates, count + 1);
        assert.equal((await currentOrder(a.order.id)).status, 'EXPIRED');
        assert.equal((await stock()).reservedQuantity, 0);
      },
    );
    await t.test(
      'processing et succeeded Stripe : expiration ne libère pas le stock',
      async () => {
        const a = await order(),
          pi = await ensureIntent(a.order.id, gateway);
        gateway.intents.get(pi.id)!.status = 'processing';
        await event(await gateway.retrieve(pi.id), 'payment_intent.processing');
        await db.stockReservation.updateMany({
          where: { orderId: a.order.id },
          data: { expiresAt: new Date(0) },
        });
        await cancelOrder(a.order.id, true, gateway);
        assert.equal((await stock()).reservedQuantity, 1);
        const success = gateway.succeed(pi.id);
        await cancelOrder(a.order.id, true, gateway);
        assert.equal((await stock()).reservedQuantity, 1);
        await event(success);
        assert.equal((await currentOrder(a.order.id)).status, 'PAID');
        await reset();
      },
    );
    await t.test(
      'course expiration / succès : une consommation, pas de libération prématurée',
      async () => {
        const a = await order(),
          pi = await ensureIntent(a.order.id, gateway);
        const success = gateway.succeed(pi.id);
        await db.stockReservation.updateMany({
          where: { orderId: a.order.id },
          data: { expiresAt: new Date(0) },
        });
        await Promise.all([
          cancelOrder(a.order.id, true, gateway),
          event(success),
        ]);
        assert.equal((await currentOrder(a.order.id)).status, 'PAID');
        assert.equal((await stock()).stockQuantity, 4);
        assert.equal((await stock()).reservedQuantity, 0);
        await reset();
      },
    );
    await t.test(
      'succès anormal après libération : PAYMENT_REVIEW sans stock négatif',
      async () => {
        const a = await order(),
          pi = await ensureIntent(a.order.id, gateway);
        await cancelOrder(a.order.id, false, gateway);
        await event(gateway.succeed(pi.id));
        assert.equal((await currentOrder(a.order.id)).status, 'PAYMENT_REVIEW');
        assert.equal((await stock()).stockQuantity, 5);
        assert.equal((await stock()).reservedQuantity, 0);
      },
    );
    await t.test(
      'filtres SQL : stock réservé exclu, dernières pièces cohérentes',
      async () => {
        const a = await order(3);
        const result = await getCatalogProducts(
          parseCatalogParams({
            category: category.slug,
            availability: 'low-stock',
          }),
        );
        assert.equal(result.total, 1);
        assert.equal(result.products[0]!.availability, 'LOW_STOCK');
        const b = await order(2);
        const empty = await getCatalogProducts(
          parseCatalogParams({
            category: category.slug,
            availability: 'in-stock',
          }),
        );
        assert.equal(empty.total, 0);
        await cancelOrder(a.order.id, false, gateway);
        await cancelOrder(b.order.id, false, gateway);
      },
    );
    await t.test(
      'webhook annulation et requires_action : reprise et libération idempotentes',
      async () => {
        const a = await order(),
          pi = await ensureIntent(a.order.id, gateway);
        gateway.intents.get(pi.id)!.status = 'requires_action';
        await event(
          await gateway.retrieve(pi.id),
          'payment_intent.requires_action',
        );
        assert.equal(
          (await currentOrder(a.order.id)).payment!.status,
          'REQUIRES_ACTION',
        );
        const canceled = await gateway.cancel(pi.id);
        await event(canceled, 'payment_intent.canceled');
        await event(canceled, 'payment_intent.canceled');
        assert.equal((await stock()).reservedQuantity, 0);
        assert.equal((await currentOrder(a.order.id)).status, 'CANCELLED');
        await mutateCheckout(a.token, { kind: 'start' });
        assert.notEqual(
          (await getCheckoutData(a.token))!.session!.id,
          a.sessionId,
        );
      },
    );
    await t.test(
      'création ambiguë depuis 23 heures : revue, aucun nouveau débit',
      async () => {
        const a = await order(),
          pi = await ensureIntent(a.order.id, gateway);
        await db.payment.update({
          where: { orderId: a.order.id },
          data: {
            providerPaymentIntentId: null,
            intentStartedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        });
        const count = gateway.creates;
        await assert.rejects(ensureIntent(a.order.id, gateway));
        assert.equal(gateway.creates, count);
        assert.equal((await currentOrder(a.order.id)).status, 'PAYMENT_REVIEW');
        await event(gateway.succeed(pi.id));
        assert.equal(
          (await currentOrder(a.order.id)).payment!.status,
          'SUCCEEDED',
        );
        assert.equal((await currentOrder(a.order.id)).status, 'PAYMENT_REVIEW');
        // Fixture teardown only: production needs a human inventory reconciliation here.
        await db.stockReservation.updateMany({
          where: { orderId: a.order.id },
          data: { status: 'RELEASED' },
        });
        await db.productVariant.update({
          where: { id: variantId },
          data: { reservedQuantity: { decrement: 1 } },
        });
      },
    );
    await t.test(
      'contraintes DB et saisies malveillantes refusées',
      async () => {
        await assert.rejects(
          db.productVariant.update({
            where: { id: variantId },
            data: { reservedQuantity: 6 },
          }),
        );
        await assert.rejects(
          db.productVariant.update({
            where: { id: variantId },
            data: { stockQuantity: -1 },
          }),
        );
        await assert.rejects(
          prepareOrder(undefined, "x'; DROP TABLE ProductVariant; --"),
        );
        assert.equal((await stock()).stockQuantity, 5);
      },
    );
  } finally {
    const orders = await db.order.findMany({
      where: { items: { some: { productId: product.id } } },
      include: orderInclude,
    });
    for (const row of orders) {
      await db.stockReservation.deleteMany({ where: { orderId: row.id } });
      await db.orderItem.deleteMany({ where: { orderId: row.id } });
      await db.orderAddress.deleteMany({ where: { orderId: row.id } });
      await db.payment.deleteMany({ where: { orderId: row.id } });
      await db.emailDelivery.deleteMany({ where: { orderId: row.id } });
      await db.order.delete({ where: { id: row.id } });
    }
    await db.stripeWebhookEvent.deleteMany({
      where: { stripeEventId: { in: events } },
    });
    await db.cart.deleteMany({
      where: {
        tokenHash: { in: [...tokens].map((token) => cartTokenHash(token)!) },
      },
    });
    await db.shippingMethod.delete({ where: { id: method.id } });
    await db.productVariant.delete({ where: { id: variantId } });
    await db.product.delete({ where: { id: product.id } });
    await db.category.delete({ where: { id: category.id } });
    await db.$disconnect();
  }
});
