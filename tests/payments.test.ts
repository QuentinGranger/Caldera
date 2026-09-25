import assert from 'node:assert/strict';
import { test } from 'node:test';
import Stripe from 'stripe';
import { toStripeAmount } from '../src/lib/stripe/amount';
import { verifyWebhook } from '../src/lib/stripe/webhook';
import { stripeMode } from '../src/lib/stripe/stripe';
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
