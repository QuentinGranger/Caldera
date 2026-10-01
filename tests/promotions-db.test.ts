import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { getPrisma } from '../src/lib/db/prisma';
import { purgeTestInvoices } from './helpers/invoices';
import { mutateCart } from '../src/lib/cart/service';
import { cartTokenHash } from '../src/lib/cart/identity';
import {
  applyPromotionFromCart,
  mutateCheckout,
} from '../src/lib/checkout/service';
import { getCheckoutData } from '../src/lib/checkout/queries';
import { getCheckoutSummary } from '../src/lib/checkout/validation';
import { emptyAddress } from '../src/lib/checkout/types';
import { prepareOrder } from '../src/lib/orders/prepare';
import { cancelOrder } from '../src/lib/payments/cancel';
import { ensureIntent } from '../src/lib/payments/intents';
import { processPaymentEvent } from '../src/lib/payments/events';
import type { Intent, PaymentGateway } from '../src/lib/stripe/stripe';
import { parseEmailSnapshot, renderEmail } from '../src/emails/templates';
import { deletePromotion, savePromotion } from '../src/lib/promotions/admin';
import { requestRefund } from '../src/lib/refunds/service';
import type { RefundGateway } from '../src/lib/refunds/gateway';
if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1'].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  )
)
  throw new Error('Tests réservés à PostgreSQL local.');
const db = getPrisma();

class Gateway implements PaymentGateway {
  intents = new Map<string, Intent>();
  keys = new Map<string, string>();
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
    const id = `pi_promo_${randomUUID().replaceAll('-', '')}`;
    this.intents.set(id, {
      ...input,
      id,
      amount_received: 0,
      status: 'requires_payment_method',
      livemode: false,
      client_secret: 'local-test-only',
    });
    this.keys.set(key, id);
    return this.retrieve(id);
  }
  async retrieve(id: string) {
    return { ...this.intents.get(id)! };
  }
  async cancel(id: string) {
    const current = this.intents.get(id)!;
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

const refunds: RefundGateway = {
  async create(input) {
    return {
      id: `re_promo_${randomUUID().replaceAll('-', '')}`,
      amount: input.amount,
      currency: 'eur',
      status: 'succeeded',
      paymentIntentId: input.paymentIntent,
      metadata: input.metadata,
      failureReason: null,
    };
  },
  async retrieve() {
    throw new Error('unused');
  },
};

function form(values: Record<string, string | boolean>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(values))
    if (value !== false) data.set(name, value === true ? 'on' : value);
  return data;
}

test('codes promo : checkout, commande, limites et remboursement', async (t) => {
  const key = randomUUID();
  const suffix = key.slice(0, 8).toUpperCase();
  const tokens = new Set<string>();
  const events: string[] = [];
  const gateway = new Gateway();
  const admin = await db.adminUser.create({
    data: { name: 'Admin promo', email: `promo-${key}@example.com` },
  });
  const game = await db.game.create({
    data: { name: `Jeu promo ${suffix}`, slug: `jeu-promo-${key}` },
  });
  const parent = await db.category.create({
    data: { name: 'Promo parent', slug: `promo-parent-${key}` },
  });
  const child = await db.category.create({
    data: {
      name: 'Promo enfant',
      slug: `promo-enfant-${key}`,
      parentId: parent.id,
    },
  });
  const other = await db.category.create({
    data: { name: 'Promo autre', slug: `promo-autre-${key}` },
  });
  const boxed = await db.product.create({
    data: {
      name: 'Coffret promo',
      slug: `coffret-promo-${key}`,
      categoryId: child.id,
      gameId: game.id,
      status: 'ACTIVE',
      productType: 'ETB',
      variants: {
        create: { sku: `PROMO-A-${key}`, price: '59.90', stockQuantity: 20 },
      },
    },
    include: { variants: true },
  });
  const sleeves = await db.product.create({
    data: {
      name: 'Protège-cartes promo',
      slug: `protege-promo-${key}`,
      categoryId: other.id,
      status: 'ACTIVE',
      productType: 'ACCESSORY',
      variants: {
        create: { sku: `PROMO-B-${key}`, price: '19.90', stockQuantity: 20 },
      },
    },
    include: { variants: true },
  });
  const boxVariant = boxed.variants[0]!.id;
  const sleeveVariant = sleeves.variants[0]!.id;
  const country = await db.shippingCountry.findFirstOrThrow({
    where: { isActive: true },
  });
  const method = await db.shippingMethod.create({
    data: {
      code: `PROMO-${key}`,
      name: 'Livraison promo',
      price: '5.90',
      freeFromAmount: '100.00',
      countries: { connect: { code: country.code } },
    },
  });
  const address = {
    ...emptyAddress(),
    firstName: 'Client',
    lastName: 'Promo',
    addressLine1: '1 rue des Tests',
    postalCode: '75001',
    city: 'Ville test',
    countryCode: country.code,
  };
  async function cart(lines: [string, number][], email: string) {
    let token: string | undefined;
    for (const [variantId, quantity] of lines)
      token = await mutateCart(token, { kind: 'add', variantId, quantity });
    tokens.add(token!);
    await mutateCheckout(token, { kind: 'start' });
    const sessionId = (await getCheckoutData(token))!.session!.id;
    await mutateCheckout(token, {
      kind: 'contact',
      sessionId,
      contact: {
        email,
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
    const view = async () =>
      getCheckoutSummary((await getCheckoutData(token))!);
    const apply = (code: string) =>
      mutateCheckout(token, { kind: 'promotion', sessionId, code });
    const prepare = () => mutateCheckout(token, { kind: 'prepare', sessionId });
    const order = async () => {
      await prepare();
      return prepareOrder(token, sessionId);
    };
    return { token: token!, sessionId, view, apply, prepare, order };
  }
  const code = `TEST-${suffix}`;
  const shippingCode = `PORT-${suffix}`;
  const lastCode = `DERNIER-${suffix}`;
  let codeId = '';

  try {
    await t.test('création admin : validations et unicité', async () => {
      const base = {
        code: code.toLowerCase(),
        label: 'Coffrets −20 %',
        type: 'PERCENTAGE',
        percentOff: '20',
        gameId: game.id,
        categoryId: parent.id,
        maxRedemptions: '5',
        maxPerCustomer: '1',
        isActive: true,
      };
      await assert.rejects(
        savePromotion(admin.id, form({ ...base, code: '-x' })),
        /Code invalide/,
      );
      await assert.rejects(
        savePromotion(admin.id, form({ ...base, percentOff: '95' })),
        /Pourcentage/,
      );
      await assert.rejects(
        savePromotion(admin.id, form({ ...base, extra: 'x' })),
        /Champ non autorisé/,
      );
      await assert.rejects(
        savePromotion(
          admin.id,
          form({ ...base, startsAt: '2026-10-10', endsAt: '2026-10-01' }),
        ),
        /date de fin/,
      );
      const created = await savePromotion(admin.id, form(base));
      codeId = created.id;
      assert.equal(created.code, code);
      assert.equal(created.createdById, admin.id);
      await assert.rejects(savePromotion(admin.id, form(base)), /existe déjà/);
      await savePromotion(
        admin.id,
        form({
          code: shippingCode,
          label: 'Port offert',
          type: 'FREE_SHIPPING',
          isActive: true,
        }),
      );
      await savePromotion(
        admin.id,
        form({
          code: lastCode,
          label: 'Dernier',
          type: 'FIXED_AMOUNT',
          amountOff: '5,00',
          maxRedemptions: '1',
          isActive: true,
        }),
      );
    });

    await t.test(
      'panier : code appliqué avant les coordonnées et conservé au checkout',
      async () => {
        const token = await mutateCart(undefined, {
          kind: 'add',
          variantId: boxVariant,
          quantity: 1,
        });
        tokens.add(token);

        const cartView = await applyPromotionFromCart(
          token,
          `  ${code.toLowerCase()}  `,
        );
        assert.equal(cartView.requiredStep, 'contact');
        assert.equal(cartView.promotion?.code, code);
        assert.equal(cartView.promotion?.discount, '11.98');
        assert.equal(cartView.provisionalTotal, '47.92');

        const persisted = await getCheckoutData(token);
        assert.ok(persisted?.session);
        assert.equal(persisted.session.promotionId, codeId);

        // Starting the checkout again must reuse the same draft, not lose the code.
        await mutateCheckout(token, { kind: 'start' });
        const afterStart = await getCheckoutData(token);
        assert.ok(afterStart);
        const checkoutView = getCheckoutSummary(afterStart);
        assert.equal(checkoutView.promotion?.code, code);
        assert.equal(checkoutView.promotion?.discount, '11.98');
        assert.equal(checkoutView.provisionalTotal, '47.92');
      },
    );

    await t.test(
      'checkout : réduction sur les articles concernés, seuil de port après remise',
      async () => {
        const buyer = await cart(
          [
            [boxVariant, 2],
            [sleeveVariant, 1],
          ],
          'Acheteur@Example.com',
        );
        await assert.rejects(buyer.apply('INCONNU-42'), /n’est pas valable/);
        // 139,70 € d’articles : port offert (seuil 100 €) avant le code.
        assert.equal((await buyer.view()).shippingAmount, '0.00');
        await buyer.apply(` ${code.toLowerCase()} `);
        const view = await buyer.view();
        assert.ok(view.promotion);
        // 20 % des seuls coffrets (119,80 €) = 23,96 €.
        assert.equal(view.promotion.discount, '23.96');
        assert.deepEqual(
          view.promotion.items.map((item) => item.amount),
          ['23.96'],
        );
        // 139,70 − 23,96 = 115,74 € : toujours au-dessus du seuil.
        assert.equal(view.shippingAmount, '0.00');
        assert.equal(view.total, '115.74');
        // Avant le choix de la livraison, le total provisoire est déjà remisé.
        assert.equal(view.provisionalTotal, '115.74');
        await buyer.prepare();
        assert.equal((await buyer.view()).status, 'READY_FOR_PAYMENT');

        const order = await prepareOrder(buyer.token, buyer.sessionId);
        assert.equal(order.subtotalAmount.toFixed(2), '139.70');
        assert.equal(order.discountAmount.toFixed(2), '23.96');
        assert.equal(order.totalAmount.toFixed(2), '115.74');
        assert.equal(order.payment!.amount.toFixed(2), '115.74');
        assert.equal(order.promotionCode, code);
        assert.equal(
          order.items
            .reduce((sum, item) => sum + Number(item.discountAmount), 0)
            .toFixed(2),
          '23.96',
        );
        const redemption = await db.promotionRedemption.findUniqueOrThrow({
          where: { orderId: order.id },
        });
        assert.equal(redemption.status, 'RESERVED');
        assert.equal(redemption.email, 'acheteur@example.com');

        // Même client, autre panier : limite d’une utilisation par e-mail.
        const again = await cart([[boxVariant, 1]], 'acheteur@example.com');
        await assert.rejects(again.apply(code), /déjà utilisé/);

        // Paiement abandonné : l’utilisation est libérée.
        await cancelOrder(order.id, false, gateway);
        assert.equal(
          (
            await db.promotionRedemption.findUniqueOrThrow({
              where: { orderId: order.id },
            })
          ).status,
          'RELEASED',
        );
        await again.apply(code);
        const discounted = await again.view();
        assert.equal(discounted.promotion?.discount, '11.98');
        assert.equal(discounted.provisionalTotal, '47.92');
      },
    );

    await t.test(
      'livraison offerte et code désactivé en cours de route',
      async () => {
        const buyer = await cart([[sleeveVariant, 1]], 'port@example.com');
        await buyer.apply(shippingCode);
        const view = await buyer.view();
        assert.equal(view.shippingAmount, '5.90');
        assert.equal(view.promotion?.shippingDiscount, '5.90');
        assert.equal(view.total, '19.90');
        await buyer.prepare();
        // L’admin désactive le code avant le paiement.
        const promotion = await db.promotion.findUniqueOrThrow({
          where: { code: shippingCode },
        });
        await db.promotion.update({
          where: { id: promotion.id },
          data: { isActive: false },
        });
        const stale = await buyer.view();
        assert.equal(stale.status, 'IN_PROGRESS');
        assert.equal(stale.promotion, null);
        assert.match(stale.promotionIssue?.message ?? '', /n’est pas valable/);
        assert.equal(stale.total, '25.80');
        await assert.rejects(buyer.prepare(), /Retirez le code/);
        await db.promotion.update({
          where: { id: promotion.id },
          data: { isActive: true },
        });
        await buyer.prepare();
        const order = await prepareOrder(buyer.token, buyer.sessionId);
        assert.equal(order.shippingAmount.toFixed(2), '0.00');
        assert.equal(order.shippingDiscountAmount.toFixed(2), '5.90');
        assert.equal(order.totalAmount.toFixed(2), '19.90');
        await cancelOrder(order.id, false, gateway);
      },
    );

    await t.test(
      'dernière utilisation : une seule commande l’obtient',
      async () => {
        const a = await cart([[boxVariant, 1]], 'a@example.com');
        const b = await cart([[boxVariant, 1]], 'b@example.com');
        await a.apply(lastCode);
        await b.apply(lastCode);
        await a.prepare();
        await b.prepare();
        const race = await Promise.allSettled([
          prepareOrder(a.token, a.sessionId),
          prepareOrder(b.token, b.sessionId),
        ]);
        const won = race.filter((result) => result.status === 'fulfilled');
        assert.equal(won.length, 1);
        const lost = race.find((result) => result.status === 'rejected')!;
        assert.match(String(lost.reason), /limite d’utilisation/);
        await cancelOrder(won[0]!.value.id, false, gateway);
      },
    );

    await t.test(
      'paiement : utilisation consommée, e-mail et remboursement au prix payé',
      async () => {
        const buyer = await cart([[boxVariant, 3]], 'paye@example.com');
        await buyer.apply(code);
        const order = await buyer.order();
        // 3 × 59,90 = 179,70 ; −20 % = 35,94 ; 143,76 € payés, port offert.
        assert.equal(order.totalAmount.toFixed(2), '143.76');
        const intent = await ensureIntent(order.id, gateway);
        events.push(`evt_promo_${key}`);
        await processPaymentEvent(
          events.at(-1)!,
          'payment_intent.succeeded',
          gateway.succeed(intent.id),
        );
        const paid = await db.order.findUniqueOrThrow({
          where: { id: order.id },
          include: { promotionRedemption: true, emails: true },
        });
        assert.equal(paid.status, 'PAID');
        assert.equal(paid.promotionRedemption?.status, 'CONSUMED');
        const email = renderEmail(
          'ORDER_CONFIRMATION',
          parseEmailSnapshot(paid.emails[0]!.snapshot),
          { order: 'https://example.com/o', logo: 'https://example.com/l.png' },
        );
        assert.match(
          email.text,
          new RegExp(`Réduction \\(${code}\\) : −35,94`),
        );
        assert.match(email.text, /Total : 143,76/);

        // Chaque unité coûte 47,92 € après remise : jamais 59,90 €.
        const refund = await requestRefund(
          admin.id,
          {
            orderId: order.id,
            idempotencyKey: randomUUID(),
            lines: [{ orderItemId: order.items[0]!.id, quantity: 1 }],
            includeShipping: false,
            amountCents: null,
            reason: 'CUSTOMER_REQUEST',
            note: '',
            restock: false,
          },
          refunds,
        );
        assert.equal(refund.amount, '47.92');
        const rest = await requestRefund(
          admin.id,
          {
            orderId: order.id,
            idempotencyKey: randomUUID(),
            lines: [{ orderItemId: order.items[0]!.id, quantity: 2 }],
            includeShipping: false,
            amountCents: null,
            reason: 'CUSTOMER_REQUEST',
            note: '',
            restock: false,
          },
          refunds,
        );
        // 143,76 − 47,92 = 95,84 : le total remboursé égale le total payé.
        assert.equal(rest.amount, '95.84');
      },
    );

    await t.test('suppression : seulement un code jamais utilisé', async () => {
      await assert.rejects(
        deletePromotion(admin.id, form({ id: codeId })),
        /désactivez-le/,
      );
      const unused = await savePromotion(
        admin.id,
        form({ code: `JAMAIS-${suffix}`, label: 'x', type: 'FREE_SHIPPING' }),
      );
      await deletePromotion(admin.id, form({ id: unused.id }));
      assert.equal(await db.promotion.count({ where: { id: unused.id } }), 0);
    });
  } finally {
    const orders = await db.order.findMany({
      where: {
        items: { some: { productId: { in: [boxed.id, sleeves.id] } } },
      },
      select: { id: true },
    });
    const ids = orders.map((row) => row.id);
    await purgeTestInvoices(db, ids);
    await db.refund.deleteMany({ where: { orderId: { in: ids } } });
    await db.promotionRedemption.deleteMany({
      where: { orderId: { in: ids } },
    });
    await db.stockReservation.deleteMany({ where: { orderId: { in: ids } } });
    await db.emailDelivery.deleteMany({ where: { orderId: { in: ids } } });
    await db.orderItem.deleteMany({ where: { orderId: { in: ids } } });
    await db.orderAddress.deleteMany({ where: { orderId: { in: ids } } });
    await db.payment.deleteMany({ where: { orderId: { in: ids } } });
    await db.order.deleteMany({ where: { id: { in: ids } } });
    await db.stripeWebhookEvent.deleteMany({
      where: { stripeEventId: { in: events } },
    });
    await db.cart.deleteMany({
      where: {
        tokenHash: { in: [...tokens].map((token) => cartTokenHash(token)!) },
      },
    });
    await db.promotion.deleteMany({ where: { createdById: admin.id } });
    await db.adminAuditLog.deleteMany({ where: { adminUserId: admin.id } });
    await db.shippingMethod.delete({ where: { id: method.id } });
    await db.productVariant.deleteMany({
      where: { productId: { in: [boxed.id, sleeves.id] } },
    });
    await db.product.deleteMany({
      where: { id: { in: [boxed.id, sleeves.id] } },
    });
    await db.category.delete({ where: { id: child.id } });
    await db.category.deleteMany({
      where: { id: { in: [parent.id, other.id] } },
    });
    await db.game.delete({ where: { id: game.id } });
    await db.adminUser.delete({ where: { id: admin.id } });
    await db.$disconnect();
  }
});
