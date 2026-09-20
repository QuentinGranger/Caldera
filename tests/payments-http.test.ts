import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { getPrisma } from '../src/lib/db/prisma';
import { mutateCart } from '../src/lib/cart/service';
import { mutateCheckout } from '../src/lib/checkout/service';
import { getCheckoutData } from '../src/lib/checkout/queries';
import { emptyAddress } from '../src/lib/checkout/types';
import { prepareOrder } from '../src/lib/orders/prepare';
import { processPaymentEvent } from '../src/lib/payments/events';
import { cartTokenHash } from '../src/lib/cart/identity';
if (process.env.NODE_ENV === 'production')
  throw new Error('Fixtures réservées au développement.');
const db = getPrisma(),
  base = process.env.TEST_BASE_URL ?? 'http://localhost:3001';
const manifest = JSON.parse(
  await readFile('.next/server/server-reference-manifest.json', 'utf8'),
) as { node: Record<string, { exportedName?: string }> };
test('paiement HTTP : confidentialité, confirmation serveur et webhook invalide', async (t) => {
  const key = randomUUID();
  const category = await db.category.create({
    data: { name: 'HTTP paiement', slug: `pay-http-${key}` },
  });
  const product = await db.product.create({
    data: {
      name: 'Produit HTTP paiement',
      slug: `pay-http-${key}`,
      categoryId: category.id,
      status: 'ACTIVE',
      productType: 'ETB',
      variants: {
        create: { sku: `PAY-HTTP-${key}`, price: '59.90', stockQuantity: 2 },
      },
    },
    include: { variants: true },
  });
  const variant = product.variants[0]!;
  const method = await db.shippingMethod.findUniqueOrThrow({
    where: { code: 'DEV-STANDARD' },
  });
  const token = await mutateCart(undefined, {
    kind: 'add',
    variantId: variant.id,
    quantity: 1,
  });
  await mutateCheckout(token, { kind: 'start' });
  const sessionId = (await getCheckoutData(token))!.session!.id;
  await mutateCheckout(token, {
    kind: 'contact',
    sessionId,
    contact: {
      email: 'http-payment@example.com',
      phone: '',
      billingSame: true,
      billing: null,
      shipping: {
        ...emptyAddress(),
        firstName: 'Client',
        lastName: 'HTTP',
        addressLine1: '1 rue du Test',
        postalCode: '75001',
        city: 'Paris',
      },
    },
  });
  await mutateCheckout(token, {
    kind: 'shipping',
    sessionId,
    methodId: method.id,
  });
  await mutateCheckout(token, { kind: 'prepare', sessionId });
  const order = await prepareOrder(token, sessionId),
    cookie = `caldera_cart=${token}`,
    eventId = `evt_http_${key}`;
  async function page(path: string, auth = cookie) {
    const response = await fetch(base + path, {
      headers: { Cookie: auth },
      redirect: 'manual',
    });
    const body = await response.text();
    return {
      response,
      body,
      html: body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, ''),
    };
  }
  try {
    await t.test(
      'commande privée : aucun détail sans le cookie propriétaire',
      async () => {
        for (const path of [
          `/commande/${order.publicId}`,
          `/checkout/paiement/${order.publicId}`,
          `/api/commande/${order.publicId}`,
        ]) {
          const result = await page(path, '');
          assert.equal(result.response.status, 404);
          assert.doesNotMatch(
            result.body,
            /1 rue du Test|http-payment@example.com/,
          );
        }
      },
    );
    await t.test(
      'retour falsifié succeeded : reste en attente, noindex et CSP',
      async () => {
        const result = await page(
          `/commande/${order.publicId}?redirect_status=succeeded&payment_intent=pi_fake`,
        );
        assert.equal(result.response.status, 200);
        assert.match(result.html, /En attente de confirmation/);
        assert.doesNotMatch(result.html, /Votre commande est confirmée/);
        assert.match(result.html, /noindex/);
        assert.match(
          result.response.headers.get('content-security-policy')!,
          /nonce-/,
        );
        assert.equal(
          result.response.headers.get('referrer-policy'),
          'no-referrer',
        );
        assert.match(result.response.headers.get('cache-control')!, /no-store/);
      },
    );
    await t.test(
      'étape paiement et résumé serveur sans champs carte maison',
      async () => {
        const result = await page(`/checkout/paiement/${order.publicId}`);
        assert.equal(result.response.status, 200);
        assert.match(result.html, /Paiement sécurisé/);
        assert.match(result.html, /65,80/);
        assert.doesNotMatch(result.html, /name="(?:card|cardNumber|cvv)"/);
      },
    );
    await t.test(
      'Server Action : préflight autorisé, accès tiers et Origin étrangère refusés',
      async () => {
        const action = Object.entries(manifest.node).find(
          ([, v]) => v.exportedName === 'checkPaymentAction',
        )?.[0];
        assert.ok(action);
        for (const [auth, origin, success] of [
          [cookie, base, true],
          ['', base, false],
          [cookie, 'https://invalid.example', false],
        ] as const) {
          const response = await fetch(
            `${base}/checkout/paiement/${order.publicId}`,
            {
              method: 'POST',
              headers: {
                'Next-Action': action,
                'Content-Type': 'text/plain;charset=UTF-8',
                Accept: 'text/x-component',
                Cookie: auth,
                Origin: origin,
              },
              body: JSON.stringify([order.publicId]),
            },
          );
          const body = await response.text();
          if (success) assert.match(body, /"success":true/);
          else assert.doesNotMatch(body, /"success":true/);
        }
      },
    );
    await t.test(
      'webhook HTTP signé incorrectement : 400 et aucun événement enregistré',
      async () => {
        const response = await fetch(base + '/api/stripe/webhook', {
          method: 'POST',
          headers: {
            'stripe-signature': 'invalid',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: eventId,
            type: 'payment_intent.succeeded',
          }),
        });
        assert.equal(response.status, 400);
        assert.equal(
          await db.stripeWebhookEvent.count({
            where: { stripeEventId: eventId },
          }),
          0,
        );
      },
    );
    await t.test(
      'statut DB final : confirmation exacte et panier vide après webhook métier',
      async () => {
        await db.payment.update({
          where: { orderId: order.id },
          data: { intentStartedAt: new Date() },
        });
        await processPaymentEvent(eventId, 'payment_intent.succeeded', {
          id: `pi_http_${key}`,
          amount: 6580,
          amount_received: 6580,
          currency: 'eur',
          livemode: false,
          client_secret: null,
          status: 'succeeded',
          metadata: { orderId: order.id, orderNumber: order.orderNumber },
        });
        const result = await page(`/commande/${order.publicId}`);
        assert.match(result.html, /Votre commande est confirmée/);
        assert.match(result.html, /1 rue du Test/);
        const status = await page(`/api/commande/${order.publicId}`);
        assert.deepEqual(JSON.parse(status.body), { status: 'PAID' });
        assert.match(
          status.response.headers.get('cache-control')!,
          /private, no-store/,
        );
        const cart = await page('/panier');
        assert.match(cart.html, /panier est vide/i);
      },
    );
  } finally {
    await db.stripeWebhookEvent.deleteMany({
      where: { stripeEventId: eventId },
    });
    await db.stockReservation.deleteMany({ where: { orderId: order.id } });
    await db.orderItem.deleteMany({ where: { orderId: order.id } });
    await db.orderAddress.deleteMany({ where: { orderId: order.id } });
    await db.payment.deleteMany({ where: { orderId: order.id } });
    await db.emailDelivery.deleteMany({ where: { orderId: order.id } });
    await db.order.delete({ where: { id: order.id } });
    await db.cart.deleteMany({ where: { tokenHash: cartTokenHash(token)! } });
    await db.productVariant.delete({ where: { id: variant.id } });
    await db.product.delete({ where: { id: product.id } });
    await db.category.delete({ where: { id: category.id } });
    await db.$disconnect();
  }
});
