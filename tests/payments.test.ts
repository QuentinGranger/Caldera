import assert from 'node:assert/strict';
import { test } from 'node:test';
import Stripe from 'stripe';
import { toStripeAmount } from '../src/lib/stripe/amount';
import {
  MAX_WEBHOOK_BODY_BYTES,
  readWebhookBody,
  verifyWebhook,
  WebhookPayloadTooLargeError,
} from '../src/lib/stripe/webhook';
import {
  assertPaymentConfiguration,
  stripeMode,
} from '../src/lib/stripe/stripe';
import { availableQuantity } from '../src/lib/inventory/availability';
test('EUR : centimes exacts, aucune troncature ni montant invalide', () => {
  assert.equal(toStripeAmount('59.90'), 5990);
  assert.equal(toStripeAmount('72.80'), 7280);
  for (const value of ['0', '-1', '0.499', '1.001', 'NaN', '1000000'])
    assert.throws(() => toStripeAmount(value));
});
test('quantité vendable déduit toutes les réservations', () => {
  assert.equal(availableQuantity({ stockQuantity: 5, reservedQuantity: 3 }), 2);
});
test('signature Stripe officielle : valide, altérée, absente et trop ancienne', () => {
  const payload = JSON.stringify({
    id: 'evt_test',
    type: 'payment_intent.succeeded',
  });
  const secret = 'whsec_local_unit_test_only';
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret });
  assert.equal(verifyWebhook(payload, header, secret).id, 'evt_test');
  assert.throws(() => verifyWebhook(payload + ' ', header, secret));
  assert.throws(() => verifyWebhook(payload, '', secret));
  assert.throws(() =>
    verifyWebhook(
      payload,
      Stripe.webhooks.generateTestHeaderString({
        payload,
        secret,
        timestamp: 1,
      }),
      secret,
    ),
  );
});
test('webhook : le corps est limité même sans Content-Length fiable', async () => {
  const payload = JSON.stringify({
    id: 'evt_test',
    type: 'payment_intent.succeeded',
  });
  assert.equal(
    await readWebhookBody(
      new Request('http://localhost/api/stripe/webhook', {
        method: 'POST',
        body: payload,
      }),
    ),
    payload,
  );
  await assert.rejects(
    readWebhookBody(
      new Request('http://localhost/api/stripe/webhook', {
        method: 'POST',
        body: 'x'.repeat(MAX_WEBHOOK_BODY_BYTES + 1),
      }),
    ),
    WebhookPayloadTooLargeError,
  );
  await assert.rejects(
    readWebhookBody(
      new Request('http://localhost/api/stripe/webhook', {
        method: 'POST',
        headers: { 'content-length': String(MAX_WEBHOOK_BODY_BYTES + 1) },
        body: 'small',
      }),
    ),
    WebhookPayloadTooLargeError,
  );
});
test('mode Stripe : déduit de la clé serveur, live réservé au build de production', () => {
  const env = process.env as Record<string, string | undefined>;
  const saved = { key: env.STRIPE_SECRET_KEY, node: env.NODE_ENV };
  try {
    const mode = (key: string | undefined, node: string) => {
      env.STRIPE_SECRET_KEY = key;
      env.NODE_ENV = node;
      return stripeMode();
    };
    assert.equal(mode('rk_test_x', 'development'), 'test');
    assert.equal(mode('sk_test_x', 'production'), 'test');
    assert.equal(mode('rk_live_x', 'production'), 'live');
    assert.equal(mode('sk_live_x', 'development'), null);
    assert.equal(mode('pk_live_x', 'production'), null);
    assert.equal(mode(undefined, 'production'), null);
  } finally {
    env.STRIPE_SECRET_KEY = saved.key;
    env.NODE_ENV = saved.node;
  }
});

test('maintenance : CHECKOUT_PAUSED bloque toute nouvelle commande ou tentative', () => {
  const saved = process.env.CHECKOUT_PAUSED;
  try {
    process.env.CHECKOUT_PAUSED = '1';
    assert.throws(assertPaymentConfiguration, /suspendues quelques minutes/);
  } finally {
    if (saved === undefined) delete process.env.CHECKOUT_PAUSED;
    else process.env.CHECKOUT_PAUSED = saved;
  }
});

test('préouverture : la production reste fermée sans activation explicite', () => {
  const env = process.env as Record<string, string | undefined>;
  const saved = { node: env.NODE_ENV, open: env.STORE_OPEN };
  try {
    env.NODE_ENV = 'production';
    delete env.STORE_OPEN;
    assert.throws(assertPaymentConfiguration, /boutique est en préparation/);
    env.STORE_OPEN = '0';
    assert.throws(assertPaymentConfiguration, /boutique est en préparation/);
  } finally {
    if (saved.node === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = saved.node;
    if (saved.open === undefined) delete env.STORE_OPEN;
    else env.STORE_OPEN = saved.open;
  }
});

test('boutique ouverte en production : une clé Stripe de test est refusée', () => {
  const env = process.env as Record<string, string | undefined>;
  const saved = {
    node: env.NODE_ENV,
    open: env.STORE_OPEN,
    key: env.STRIPE_SECRET_KEY,
    paused: env.CHECKOUT_PAUSED,
  };
  try {
    env.NODE_ENV = 'production';
    env.STORE_OPEN = '1';
    env.STRIPE_SECRET_KEY = 'sk_test_local_only';
    delete env.CHECKOUT_PAUSED;
    assert.throws(assertPaymentConfiguration, /configuration Stripe active/);
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      const name = {
        node: 'NODE_ENV',
        open: 'STORE_OPEN',
        key: 'STRIPE_SECRET_KEY',
        paused: 'CHECKOUT_PAUSED',
      }[key]!;
      if (value === undefined) delete env[name];
      else env[name] = value;
    }
  }
});
