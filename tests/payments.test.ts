import assert from 'node:assert/strict';
import { test } from 'node:test';
import Stripe from 'stripe';
import { toStripeAmount } from '../src/lib/stripe/amount';
import { verifyWebhook } from '../src/lib/stripe/webhook';
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
