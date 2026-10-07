import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { getPrisma } from '../src/lib/db/prisma';
import { purgeTestInvoices } from './helpers/invoices';
import { cartTokenHash } from '../src/lib/cart/identity';
import { parseEmailSnapshot } from '../src/emails/templates';
import { transitionFulfillment } from '../src/lib/fulfillment/service';
import { refundState } from '../src/lib/refunds/amounts';
import {
  RefundProviderError,
  type ProviderRefund,
  type RefundGateway,
} from '../src/lib/refunds/gateway';
import {
  applyProviderRefund,
  processRefundEvent,
  requestRefund,
  syncRefunds,
  type RefundRequest,
} from '../src/lib/refunds/service';
if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1'].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  )
)
  throw new Error('Tests réservés à PostgreSQL local.');
const db = getPrisma();
// The shop's notices go here, whatever the local configuration.
process.env.NOTIFICATION_EMAIL_TO = 'boutique@caldera.test';

/** Stripe stand-in: same key, same refund, like the real idempotency. */
function fakeStripe() {
  const byKey = new Map<string, ProviderRefund>();
  const byId = new Map<string, ProviderRefund>();
  const calls: { amount: number; key: string; metadata: object }[] = [];
  const state = {
    mode: 'succeed' as 'succeed' | 'pending' | 'down' | 'refuse' | 'busy',
  };
  const gateway: RefundGateway = {
    async create(input, key) {
      calls.push({ amount: input.amount, key, metadata: input.metadata });
      if (state.mode === 'down')
        throw new RefundProviderError('STRIPE_INJOIGNABLE', false);
      if (state.mode === 'busy')
        throw new RefundProviderError('idempotency_key_in_use', false);
      if (state.mode === 'refuse')
        throw new RefundProviderError('charge_disputed', true);
      const existing = byKey.get(key);
      if (existing) return existing;
      const refund: ProviderRefund = {
        id: `re_${randomUUID().replaceAll('-', '')}`,
        amount: input.amount,
        currency: 'eur',
        status: state.mode === 'pending' ? 'pending' : 'succeeded',
        paymentIntentId: input.paymentIntent,
        metadata: input.metadata,
        failureReason: null,
      };
      byKey.set(key, refund);
      byId.set(refund.id, refund);
      return refund;
    },
    async retrieve(id) {
      const refund = byId.get(id);
      if (!refund) throw new RefundProviderError('resource_missing', true);
      return { ...refund };
    },
  };
  return { gateway, calls, state, byId };
}

test('remboursements depuis l’administration, PostgreSQL', async (t) => {
  const key = randomUUID();
  const intent = `pi_refund_${key.replaceAll('-', '')}`;
  const admin = await db.adminUser.create({
    data: { name: 'Test remboursement', email: `refund-${key}@example.com` },
  });
  const category = await db.category.create({
    data: { name: 'Catégorie remboursement', slug: `refund-${key}` },
  });
  const product = await db.product.create({
    data: {
      name: `Produit remboursement ${key}`,
      slug: `refund-${key}`,
      categoryId: category.id,
      productType: 'ETB',
      status: 'ACTIVE',
      variants: {
        create: [
          {
            sku: `REF-A-${key}`,
            price: '29.95',
            stockQuantity: 5,
            isDefault: true,
          },
          { sku: `REF-B-${key}`, price: '19.90', stockQuantity: 5 },
        ],
      },
    },
    include: { variants: { orderBy: { price: 'desc' } } },
  });
  const [variantA, variantB] = product.variants as [
    (typeof product.variants)[0],
    (typeof product.variants)[0],
  ];
  const cart = await db.cart.create({
    data: {
      tokenHash: cartTokenHash(randomUUID().replaceAll('-', '').repeat(2))!,
      expiresAt: new Date(Date.now() + 86400000),
    },
  });
  const checkout = await db.checkoutSession.create({
    data: { cartId: cart.id, expiresAt: new Date(Date.now() + 86400000) },
  });
  const line = (variant: typeof variantA, quantity: number) => ({
    productId: product.id,
    variantId: variant.id,
    productName: `Article ${variant.sku}`,
    productSlug: product.slug,
    sku: variant.sku,
    language: 'FR' as const,
    unitPrice: variant.price,
    quantity,
    lineTotal: variant.price.mul(quantity),
    imageUrl: '/assets/products/placeholder-sealed.png',
  });
  // 2 × 29,95 + 19,90 + 6,90 de port = 86,70 €
  const order = await db.order.create({
    data: {
      checkoutSessionId: checkout.id,
      publicId: randomUUID().replaceAll('-', '').repeat(2),
      orderNumber: `REFUND-${key}`,
      status: 'PAID',
      email: `customer-${key}@example.com`,
      currency: 'EUR',
      subtotalAmount: '79.80',
      shippingAmount: '6.90',
      totalAmount: '86.70',
      shippingMethodCode: 'TEST',
      shippingMethodName: 'Livraison test',
      paidAt: new Date(),
      items: { create: [line(variantA, 2), line(variantB, 1)] },
      payment: {
        create: {
          status: 'SUCCEEDED',
          amount: '86.70',
          currency: 'EUR',
          providerPaymentIntentId: intent,
          paidAt: new Date(),
        },
      },
      addresses: {
        create: {
          role: 'SHIPPING',
          firstName: 'Test',
          lastName: 'Remboursement',
          addressLine1: '1 rue du Test',
          postalCode: '75001',
          city: 'Paris',
          countryCode: 'FR',
        },
      },
      reservations: {
        create: [
          { variantId: variantA.id, quantity: 2 },
          { variantId: variantB.id, quantity: 1 },
        ].map((reservation) => ({
          ...reservation,
          status: 'CONSUMED' as const,
          expiresAt: new Date(),
        })),
      },
    },
    include: { items: true },
  });
  const itemA = order.items.find((item) => item.variantId === variantA.id)!;
  const itemB = order.items.find((item) => item.variantId === variantB.id)!;
  const stripe = fakeStripe();
  const events: string[] = [];
  const ask = (request: Partial<RefundRequest>) =>
    requestRefund(
      admin.id,
      {
        orderId: order.id,
        idempotencyKey: randomUUID(),
        lines: [],
        includeShipping: false,
        amountCents: null,
        reason: 'CUSTOMER_REQUEST',
        note: '',
        restock: false,
        ...request,
      },
      stripe.gateway,
    );
  const remaining = async () =>
    refundState(
      { amount: '86.70', shipping: '6.90' },
      await db.refund.findMany({
        where: { orderId: order.id },
        include: { items: true },
      }),
    );
  const stock = async (id: string) =>
    (await db.productVariant.findUniqueOrThrow({ where: { id } }))
      .stockQuantity;
  const shopNotices = () =>
    db.emailDelivery.findMany({
      where: { orderId: order.id, type: 'SHOP_REFUND_FAILED' },
      orderBy: { createdAt: 'asc' },
    });
  const refundEmails = () =>
    db.emailDelivery.findMany({
      where: { orderId: order.id, type: 'ORDER_REFUNDED' },
      orderBy: { createdAt: 'asc' },
    });
  const audits = (action: string) =>
    db.adminAuditLog.count({
      where: { adminUserId: admin.id, entityId: order.id, action },
    });
  let goodwillId = '';

  try {
    await t.test(
      'article remboursé, remis en stock, client prévenu, une seule fois',
      async () => {
        const form = randomUUID();
        const outcome = await ask({
          idempotencyKey: form,
          lines: [{ orderItemId: itemA.id, quantity: 1 }],
          restock: true,
          reason: 'RETURN_RECEIVED',
          note: 'Colis revenu intact',
        });
        assert.equal(outcome.status, 'SUCCEEDED');
        assert.equal(outcome.amount, '29.95');
        assert.equal(outcome.sent, true);
        assert.equal(stripe.calls.length, 1);
        assert.equal(stripe.calls[0]!.amount, 2995);
        assert.equal(stripe.calls[0]!.key, `caldera-refund:${outcome.id}`);
        assert.deepEqual(stripe.calls[0]!.metadata, {
          refundId: outcome.id,
          orderId: order.id,
          orderNumber: order.orderNumber,
        });
        const refund = await db.refund.findUniqueOrThrow({
          where: { id: outcome.id },
          include: { items: true },
        });
        assert.equal(refund.createdById, admin.id);
        assert.equal(refund.reason, 'RETURN_RECEIVED');
        assert.ok(refund.settledAt && refund.restockedAt && refund.succeededAt);
        assert.deepEqual(
          refund.items.map((item) => [item.orderItemId, item.quantity]),
          [[itemA.id, 1]],
        );
        assert.equal(await stock(variantA.id), 6);
        assert.equal(
          await db.inventoryAdjustment.count({
            where: { variantId: variantA.id, type: 'RETURN' },
          }),
          1,
        );
        const [email] = await refundEmails();
        assert.equal(
          email!.dedupeKey,
          `${order.id}:ORDER_REFUNDED:${refund.id}`,
        );
        const snapshot = parseEmailSnapshot(email!.snapshot);
        assert.deepEqual(snapshot.refund, {
          amount: '29.95',
          shipping: '0.00',
          items: [{ name: itemA.productName, quantity: 1, amount: '29.95' }],
        });
        assert.equal(await audits('REFUND_REQUESTED'), 1);
        assert.equal(await audits('REFUND_SUCCEEDED'), 1);

        // Double clic sur le même formulaire : même remboursement, Stripe
        // n’est pas rappelé.
        const again = await ask({
          idempotencyKey: form,
          lines: [{ orderItemId: itemA.id, quantity: 1 }],
          restock: true,
        });
        assert.equal(again.id, outcome.id);
        assert.equal(stripe.calls.length, 1);
        // Stripe renvoie l’état final plusieurs fois : stock et e-mail une fois.
        await applyProviderRefund(
          refund.id,
          await stripe.gateway.retrieve(refund.providerRefundId!),
        );
        assert.equal(await stock(variantA.id), 6);
        assert.equal((await refundEmails()).length, 1);
        assert.equal(await audits('REFUND_SUCCEEDED'), 1);
      },
    );

    await t.test('jamais plus que commandé, payé ou sélectionné', async () => {
      const before = stripe.calls.length;
      await assert.rejects(
        ask({ lines: [{ orderItemId: itemA.id, quantity: 2 }] }),
        /1 au plus/,
      );
      await assert.rejects(
        ask({
          lines: [{ orderItemId: itemB.id, quantity: 1 }],
          amountCents: 2000,
        }),
        /ne peut pas dépasser/,
      );
      await assert.rejects(
        ask({
          lines: [
            { orderItemId: itemB.id, quantity: 1 },
            { orderItemId: itemB.id, quantity: 1 },
          ],
        }),
        /Formulaire invalide/,
      );
      await assert.rejects(
        ask({ lines: [{ orderItemId: randomUUID(), quantity: 1 }] }),
        /introuvable/,
      );
      await assert.rejects(ask({ amountCents: 999999 }), /reste remboursable/);
      await assert.rejects(ask({}), /Choisissez/);
      await assert.rejects(
        ask({ amountCents: 100, restock: true }),
        /remettre en stock/,
      );
      const outsider = await db.adminUser.create({
        data: {
          name: 'Désactivé',
          email: `refund-off-${key}@example.com`,
          isActive: false,
        },
      });
      try {
        await assert.rejects(
          requestRefund(
            outsider.id,
            {
              orderId: order.id,
              idempotencyKey: randomUUID(),
              lines: [],
              includeShipping: false,
              amountCents: 100,
              reason: 'OTHER',
              note: '',
              restock: false,
            },
            stripe.gateway,
          ),
          /Session administrateur invalide/,
        );
      } finally {
        await db.adminUser.delete({ where: { id: outsider.id } });
      }
      await db.payment.update({
        where: { orderId: order.id },
        data: { status: 'PROCESSING' },
      });
      await assert.rejects(
        ask({ amountCents: 100 }),
        /Seule une commande payée/,
      );
      await db.payment.update({
        where: { orderId: order.id },
        data: { status: 'SUCCEEDED' },
      });
      assert.equal(stripe.calls.length, before);
      assert.equal(await db.refund.count({ where: { orderId: order.id } }), 1);
    });

    await t.test(
      'geste commercial sans article, puis échec tardif Stripe',
      async () => {
        const outcome = await ask({ amountCents: 500, reason: 'DAMAGED' });
        assert.equal(outcome.status, 'SUCCEEDED');
        assert.equal(outcome.amount, '5.00');
        goodwillId = outcome.id;
        assert.equal((await remaining()).remainingCents, 8670 - 2995 - 500);
        assert.equal((await refundEmails()).length, 2);
        // La banque refuse après coup (carte fermée) : l’argent n’est pas parti.
        const provider = await stripe.gateway.retrieve(
          (await db.refund.findUniqueOrThrow({ where: { id: goodwillId } }))
            .providerRefundId!,
        );
        events.push(`evt_late_${key}`);
        await processRefundEvent(events.at(-1)!, {
          ...provider,
          status: 'failed',
          failureReason: 'expired_or_canceled_card',
        });
        const failed = await db.refund.findUniqueOrThrow({
          where: { id: goodwillId },
        });
        assert.equal(failed.status, 'FAILED');
        assert.equal(failed.failureReason, 'expired_or_canceled_card');
        assert.equal(await audits('REFUND_FAILED'), 1);
        // Refused after the fact: the shop learns it by e-mail.
        assert.deepEqual(
          (await shopNotices()).map((row) => row.dedupeKey),
          [`${order.id}:SHOP_REFUND_FAILED:${goodwillId}`],
        );
        assert.equal((await remaining()).remainingCents, 8670 - 2995);
      },
    );

    await t.test(
      'Stripe injoignable : conservé, bloque les suivants, repris par la synchronisation',
      async () => {
        stripe.state.mode = 'down';
        const outcome = await ask({
          lines: [{ orderItemId: itemB.id, quantity: 1 }],
        });
        assert.equal(outcome.status, 'PENDING');
        assert.equal(outcome.sent, false);
        assert.equal(outcome.failureReason, 'STRIPE_INJOIGNABLE');
        // Le montant reste réservé pendant l’attente.
        assert.equal((await remaining()).pendingCents, 1990);
        await assert.rejects(ask({ amountCents: 100 }), /attend encore/);
        // Un second envoi pendant que le premier est en vol n’est pas un refus.
        stripe.state.mode = 'busy';
        assert.equal(
          (await syncRefunds({ gateway: stripe.gateway, orderId: order.id }))
            .synced,
          1,
        );
        const busy = await db.refund.findUniqueOrThrow({
          where: { id: outcome.id },
        });
        assert.equal(busy.status, 'PENDING');
        stripe.state.mode = 'succeed';
        const sync = await syncRefunds({
          gateway: stripe.gateway,
          orderId: order.id,
        });
        assert.deepEqual(sync, { synced: 1, failed: 0 });
        const refund = await db.refund.findUniqueOrThrow({
          where: { id: outcome.id },
        });
        assert.equal(refund.status, 'SUCCEEDED');
        assert.equal(refund.failureReason, null);
        assert.equal(refund.restockedAt, null);
        assert.equal(await stock(variantB.id), 5);
        // Même clé Stripe à chaque tentative.
        assert.deepEqual(
          [
            ...new Set(
              stripe.calls
                .filter((call) => call.key.endsWith(outcome.id))
                .map((call) => call.key),
            ),
          ],
          [`caldera-refund:${outcome.id}`],
        );
      },
    );

    await t.test(
      'refus définitif, puis remboursement confirmé par webhook',
      async () => {
        stripe.state.mode = 'refuse';
        const refused = await ask({ includeShipping: true });
        assert.equal(refused.status, 'FAILED');
        assert.equal(refused.failureReason, 'charge_disputed');
        assert.equal(await audits('REFUND_FAILED'), 2);
        assert.equal((await shopNotices()).length, 2);
        assert.equal((await remaining()).shippingRemainingCents, 690);

        stripe.state.mode = 'pending';
        const pending = await ask({ includeShipping: true, reason: 'OTHER' });
        assert.equal(pending.status, 'PENDING');
        assert.equal(pending.sent, true);
        const refund = await db.refund.findUniqueOrThrow({
          where: { id: pending.id },
        });
        assert.equal(refund.shippingAmount.toFixed(2), '6.90');
        // Rien n’est encore annoncé au client.
        const emails = (await refundEmails()).length;
        const provider = stripe.byId.get(refund.providerRefundId!)!;
        provider.status = 'succeeded';
        events.push(`evt_success_${key}`);
        await processRefundEvent(events.at(-1)!, { ...provider });
        await processRefundEvent(events.at(-1)!, { ...provider });
        assert.equal(
          (await db.refund.findUniqueOrThrow({ where: { id: pending.id } }))
            .status,
          'SUCCEEDED',
        );
        assert.equal((await refundEmails()).length, emails + 1);
        // Un objet Stripe qui ne correspond pas n’est jamais appliqué.
        await assert.rejects(
          applyProviderRefund(pending.id, { ...provider, amount: 1 }),
          /REMBOURSEMENT_INCOHERENT/,
        );
        await assert.rejects(
          applyProviderRefund(pending.id, {
            ...provider,
            paymentIntentId: 'pi_other',
          }),
          /REMBOURSEMENT_INCOHERENT/,
        );
      },
    );

    await t.test('remboursement fait depuis le Dashboard Stripe', async () => {
      const external: ProviderRefund = {
        id: `re_dashboard_${key.replaceAll('-', '')}`,
        amount: 100,
        currency: 'eur',
        status: 'succeeded',
        paymentIntentId: intent,
        metadata: {},
        failureReason: null,
      };
      events.push(`evt_dashboard_${key}`);
      await processRefundEvent(events.at(-1)!, external);
      events.push(`evt_dashboard_again_${key}`);
      await processRefundEvent(events.at(-1)!, external);
      const recorded = await db.refund.findMany({
        where: { providerRefundId: external.id },
      });
      assert.equal(recorded.length, 1);
      assert.equal(recorded[0]!.status, 'SUCCEEDED');
      assert.equal(recorded[0]!.createdById, null);
      assert.equal(recorded[0]!.amount.toFixed(2), '1.00');
      // Paiement inconnu : ignoré, rien n’est créé.
      events.push(`evt_unknown_${key}`);
      await processRefundEvent(events.at(-1)!, {
        ...external,
        id: `re_unknown_${key.replaceAll('-', '')}`,
        paymentIntentId: 'pi_unknown',
      });
      assert.equal(
        await db.refund.count({
          where: { providerRefundId: `re_unknown_${key.replaceAll('-', '')}` },
        }),
        0,
      );
    });

    await t.test(
      'entièrement remboursée : plus rien à rembourser ni à expédier',
      async () => {
        stripe.state.mode = 'succeed';
        const left = await remaining();
        assert.equal(left.remainingCents, 8670 - 2995 - 1990 - 690 - 100);
        await assert.rejects(
          ask({ lines: [{ orderItemId: itemA.id, quantity: 1 }] }),
          /reste remboursable/,
        );
        // Deux administrateurs remboursent le reste au même instant : un seul
        // passe, l’autre voit qu’il ne reste rien.
        const race = await Promise.allSettled(
          [0, 1].map(() =>
            ask({
              lines: [{ orderItemId: itemA.id, quantity: 1 }],
              amountCents: left.remainingCents,
              restock: true,
            }),
          ),
        );
        const won = race.filter((result) => result.status === 'fulfilled');
        assert.equal(won.length, 1);
        assert.equal(won[0]!.value.status, 'SUCCEEDED');
        const lost = race.find((result) => result.status === 'rejected')!;
        assert.match(
          String(lost.reason),
          /1 au plus|entièrement remboursée|reste remboursable/,
        );
        assert.equal(await stock(variantA.id), 7);
        const done = await remaining();
        assert.equal(done.full, true);
        assert.equal(done.refundedCents, 8670);
        await assert.rejects(
          ask({ amountCents: 100 }),
          /entièrement remboursée/,
        );
        const next = new FormData();
        next.set('orderId', order.id);
        next.set('next', 'PREPARING');
        await assert.rejects(
          transitionFulfillment(admin.id, next),
          /remboursée/,
        );
        assert.equal(
          (await db.order.findUniqueOrThrow({ where: { id: order.id } }))
            .fulfillmentStatus,
          'UNFULFILLED',
        );
        // Rien d’autre n’attend : la synchronisation n’a plus rien à faire.
        assert.deepEqual(
          await syncRefunds({ gateway: stripe.gateway, orderId: order.id }),
          { synced: 0, failed: 0 },
        );
        void goodwillId;
      },
    );
  } finally {
    await purgeTestInvoices(db, [order.id]);
    await db.refund.deleteMany({ where: { orderId: order.id } });
    await db.stripeWebhookEvent.deleteMany({
      where: { stripeEventId: { in: events } },
    });
    await db.emailDelivery.deleteMany({ where: { orderId: order.id } });
    await db.stockReservation.deleteMany({ where: { orderId: order.id } });
    await db.inventoryAdjustment.deleteMany({
      where: { variantId: { in: [variantA.id, variantB.id] } },
    });
    await db.orderItem.deleteMany({ where: { orderId: order.id } });
    await db.orderAddress.deleteMany({ where: { orderId: order.id } });
    await db.payment.deleteMany({ where: { orderId: order.id } });
    await db.order.delete({ where: { id: order.id } });
    await db.checkoutSession.delete({ where: { id: checkout.id } });
    await db.cart.delete({ where: { id: cart.id } });
    await db.adminAuditLog.deleteMany({ where: { adminUserId: admin.id } });
    await db.productVariant.deleteMany({ where: { productId: product.id } });
    await db.product.delete({ where: { id: product.id } });
    await db.category.delete({ where: { id: category.id } });
    await db.adminUser.delete({ where: { id: admin.id } });
    await db.$disconnect();
  }
});
