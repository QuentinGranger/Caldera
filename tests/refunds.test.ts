import assert from 'node:assert/strict';
import { test } from 'node:test';
import { orderStatus } from '../src/lib/account/orderStatus';
import { parseEmailSnapshot, renderEmail } from '../src/emails/templates';
import {
  allocateRefund,
  fromCents,
  lineRefundCents,
  refundFailureLabel,
  refundState,
  stripeReason,
  toCents,
} from '../src/lib/refunds/amounts';

test('remboursements : montants en centimes, sans virgule flottante', () => {
  assert.equal(toCents('59.90'), 5990);
  assert.equal(toCents('0.1'), 10);
  assert.equal(toCents('12'), 1200);
  assert.equal(toCents({ toFixed: () => '0.07' }), 7);
  assert.equal(fromCents(5990), '59.90');
  assert.equal(fromCents(1), '0.01');
  for (const invalid of ['-1', '1.234', '1,50', 'abc', '', '123456789'])
    assert.throws(() => toCents(invalid), RangeError, invalid);
});

test('remboursements : répartition exacte au centime', () => {
  const lines = [
    { orderItemId: 'a', nominalCents: 1000, quantity: 1 },
    { orderItemId: 'b', nominalCents: 1000, quantity: 1 },
    { orderItemId: 'c', nominalCents: 1000, quantity: 1 },
  ];
  // Montant plein : chaque élément garde son prix.
  const full = allocateRefund({ lines, shippingCents: 490, amountCents: 3490 });
  assert.deepEqual(
    full.items.map((item) => item.cents),
    [1000, 1000, 1000],
  );
  assert.equal(full.shippingCents, 490);
  assert.equal(full.nominalCents, 3490);
  // Geste partiel : proportionnel, la somme tombe juste malgré les arrondis.
  const partial = allocateRefund({
    lines,
    shippingCents: 0,
    amountCents: 1000,
  });
  assert.equal(
    partial.items.reduce((sum, item) => sum + item.cents, 0),
    1000,
  );
  assert.ok(partial.items.every((item) => [333, 334].includes(item.cents)));
  const odd = allocateRefund({
    lines: [{ orderItemId: 'a', nominalCents: 17970, quantity: 3 }],
    shippingCents: 690,
    amountCents: 101,
  });
  assert.equal(odd.items[0]!.cents + odd.shippingCents, 101);
  assert.equal(odd.items[0]!.quantity, 3);
  // Jamais plus que la sélection ; rien de sélectionné : rien à répartir.
  assert.throws(
    () => allocateRefund({ lines, shippingCents: 0, amountCents: 3001 }),
    RangeError,
  );
  assert.deepEqual(
    allocateRefund({ lines: [], shippingCents: 0, amountCents: 0 }),
    { items: [], shippingCents: 0, nominalCents: 0 },
  );
});

test('remboursements : prix payé par unité après remise, exact au total', () => {
  // Sans remise : le prix unitaire.
  assert.equal(lineRefundCents(5990 * 3, 3, 0, 1), 5990);
  assert.equal(lineRefundCents(5990 * 3, 3, 1, 2), 11980);
  // 3 unités payées 100,00 € après remise : 33,33 + 33,33 + 33,34.
  const parts = [0, 1, 2].map((refunded) =>
    lineRefundCents(10000, 3, refunded, 1),
  );
  assert.deepEqual(parts, [3333, 3333, 3334]);
  assert.equal(lineRefundCents(10000, 3, 0, 3), 10000);
  assert.equal(
    lineRefundCents(10000, 3, 0, 2) + lineRefundCents(10000, 3, 2, 1),
    10000,
  );
  assert.equal(lineRefundCents(10000, 3, 1, 0), 0);
});

test('remboursements : état restant, remboursements en cours compris', () => {
  const paid = { amount: '69.80', shipping: '9.90' };
  assert.deepEqual(
    { ...refundState(paid, []), refundedQuantities: null },
    {
      paidCents: 6980,
      refundedCents: 0,
      pendingCents: 0,
      remainingCents: 6980,
      shippingRemainingCents: 990,
      refundedQuantities: null,
      full: false,
      partial: false,
    },
  );
  const refunds = [
    {
      amount: '29.95',
      shippingAmount: '0',
      status: 'SUCCEEDED',
      items: [{ orderItemId: 'a', quantity: 1 }],
    },
    {
      amount: '9.90',
      shippingAmount: '9.90',
      status: 'PENDING',
      items: [],
    },
    // Un échec ne compte pas : l’argent n’est jamais parti.
    {
      amount: '29.95',
      shippingAmount: '0',
      status: 'FAILED',
      items: [{ orderItemId: 'b', quantity: 1 }],
    },
  ];
  const state = refundState(paid, refunds);
  assert.equal(state.refundedCents, 2995);
  assert.equal(state.pendingCents, 990);
  assert.equal(state.remainingCents, 2995);
  assert.equal(state.shippingRemainingCents, 0);
  assert.equal(state.refundedQuantities.get('a'), 1);
  assert.equal(state.refundedQuantities.get('b'), undefined);
  assert.equal(state.partial, true);
  assert.equal(state.full, false);
  const done = refundState(paid, [
    ...refunds,
    { amount: '29.95', shippingAmount: '0', status: 'SUCCEEDED', items: [] },
  ]);
  assert.equal(done.remainingCents, 0);
  assert.equal(done.full, true);
  assert.equal(done.partial, false);
  // Le reste des frais de port ne dépasse jamais le reste remboursable.
  assert.equal(
    refundState(paid, [
      { amount: '65.00', shippingAmount: '0', status: 'SUCCEEDED', items: [] },
    ]).shippingRemainingCents,
    480,
  );
});

test('remboursements : motifs Stripe et statut vu par le client', () => {
  assert.equal(refundFailureLabel('charge_disputed'), 'Paiement en litige');
  assert.equal(
    refundFailureLabel('unknown_code'),
    'Refusé par Stripe (unknown_code)',
  );
  assert.equal(stripeReason('DUPLICATE'), 'duplicate');
  assert.equal(stripeReason('FRAUD'), 'fraudulent');
  assert.equal(stripeReason('DAMAGED'), 'requested_by_customer');
  assert.deepEqual(
    orderStatus({
      status: 'PAID',
      fulfillmentStatus: 'SHIPPED',
      refund: 'full',
    }),
    { label: 'Remboursée', tone: 'cancelled', step: null },
  );
  assert.deepEqual(
    orderStatus({
      status: 'PAID',
      fulfillmentStatus: 'SHIPPED',
      refund: 'partial',
    }),
    { label: 'Expédiée · remboursement partiel', tone: 'shipped', step: 2 },
  );
  assert.deepEqual(
    orderStatus({ status: 'PAID', fulfillmentStatus: 'SHIPPED', refund: null }),
    orderStatus({ status: 'PAID', fulfillmentStatus: 'SHIPPED' }),
  );
});

test('remboursements : e-mail échappé, montant de ce remboursement', () => {
  const snapshot = {
    version: 1,
    orderNumber: 'CAL-2026-0001\r\nBcc: x@example.com',
    publicId: 'a'.repeat(64),
    shippingMethod: 'Colissimo',
    subtotal: '69.80',
    shipping: '9.90',
    total: '79.70',
    address: ['Client'],
    items: [],
    shipment: null,
    refund: {
      amount: '39.85',
      shipping: '9.90',
      items: [{ name: 'ETB <b>Braise</b>', quantity: 1, amount: '29.95' }],
    },
  };
  const parsed = parseEmailSnapshot(JSON.parse(JSON.stringify(snapshot)));
  const email = renderEmail('ORDER_REFUNDED', parsed, {
    order: 'https://lesterresdecaldera.fr/commande/x?access=y',
    logo: 'https://lesterresdecaldera.fr/logo.png',
  });
  assert.ok(!/[\r\n]/.test(email.subject));
  assert.match(email.subject, /^Remboursement de 39,85\s€/);
  assert.ok(email.html.includes('ETB &lt;b&gt;Braise&lt;/b&gt;'));
  assert.ok(!email.html.includes('<b>Braise'));
  assert.ok(email.html.includes('29,95'));
  assert.ok(email.html.includes('9,90'));
  assert.ok(email.text.includes('39,85'));
  assert.ok(email.text.includes('ETB <b>Braise</b>'));
  // Un remboursement sans snapshot ne part pas avec des montants inventés.
  assert.throws(() =>
    renderEmail(
      'ORDER_REFUNDED',
      parseEmailSnapshot({ ...snapshot, refund: undefined }),
      { order: 'https://x.test', logo: 'https://x.test/logo.png' },
    ),
  );
  for (const refund of [
    null,
    { ...snapshot.refund, amount: 39.85 },
    { ...snapshot.refund, items: [{ name: 'x', quantity: 0, amount: '1' }] },
  ])
    assert.throws(() => parseEmailSnapshot({ ...snapshot, refund }));
});
