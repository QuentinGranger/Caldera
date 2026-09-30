import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseEmailSnapshot, renderEmail } from '../src/emails/templates';
import {
  canMoveReturn,
  canReportProblem,
  canWithdraw,
  endOfDayAfter,
  refundReasonForReturn,
  returnableQuantities,
  withdrawalDeadline,
} from '../src/lib/returns/rules';

test('retours : délai de rétractation compté en jours de Paris', () => {
  // Reçu le 1er octobre à 10 h (Paris) : fin le 15 octobre à minuit.
  const delivered = new Date('2026-10-01T08:00:00Z');
  assert.equal(
    withdrawalDeadline(delivered)!.toISOString(),
    '2026-10-15T22:00:00.000Z',
  );
  // Livraison tard le soir : le jour de Paris compte, pas celui de l’UTC.
  assert.equal(
    endOfDayAfter(new Date('2026-10-01T22:30:00Z'), 14).toISOString(),
    '2026-10-16T22:00:00.000Z',
  );
  // Changement d’heure (25 octobre) : minuit reste minuit à Paris.
  assert.equal(
    endOfDayAfter(new Date('2026-10-20T10:00:00Z'), 14).toISOString(),
    '2026-11-03T23:00:00.000Z',
  );
  assert.equal(withdrawalDeadline(null), null);
  assert.equal(canWithdraw(null), true);
  assert.equal(canWithdraw(delivered, new Date('2026-10-15T21:59:59Z')), true);
  assert.equal(canWithdraw(delivered, new Date('2026-10-15T22:00:00Z')), false);
});

test('retours : garantie légale de deux ans', () => {
  const now = new Date('2026-10-01T10:00:00Z');
  assert.equal(
    canReportProblem({ paidAt: null, deliveredAt: null }, now),
    false,
  );
  assert.equal(
    canReportProblem(
      { paidAt: new Date('2024-01-01T10:00:00Z'), deliveredAt: null },
      now,
    ),
    false,
  );
  assert.equal(
    canReportProblem(
      {
        paidAt: new Date('2024-01-01T10:00:00Z'),
        deliveredAt: new Date('2025-01-01T10:00:00Z'),
      },
      now,
    ),
    true,
  );
});

test('retours : transitions, quantités et motif de remboursement', () => {
  assert.ok(canMoveReturn('REQUESTED', 'APPROVED'));
  assert.ok(canMoveReturn('REQUESTED', 'RECEIVED'));
  assert.ok(canMoveReturn('APPROVED', 'RECEIVED'));
  assert.ok(!canMoveReturn('APPROVED', 'REJECTED'));
  assert.ok(!canMoveReturn('RECEIVED', 'APPROVED'));
  for (const closed of ['REFUNDED', 'REJECTED', 'CANCELED'] as const)
    assert.ok(!canMoveReturn(closed, 'CANCELED'));

  const left = returnableQuantities(
    [
      { id: 'a', quantity: 3 },
      { id: 'b', quantity: 1 },
      { id: 'c', quantity: 2 },
    ],
    [{ items: [{ orderItemId: 'a', quantity: 1 }] }],
    new Map([
      ['a', 1],
      ['c', 5],
    ]),
  );
  assert.deepEqual(Object.fromEntries(left), { a: 1, b: 1, c: 0 });

  assert.equal(refundReasonForReturn('WITHDRAWAL'), 'RETURN_RECEIVED');
  assert.equal(refundReasonForReturn('DEFECTIVE'), 'DAMAGED');
  assert.equal(refundReasonForReturn('WRONG_ITEM'), 'OTHER');
});

test('retours : accusé de rétractation sur support durable, échappé', () => {
  const snapshot = {
    version: 1,
    orderNumber: 'CAL-2026-ABC',
    publicId: 'a'.repeat(64),
    shippingMethod: 'Colissimo',
    subtotal: '59.90',
    shipping: '0.00',
    total: '59.90',
    address: ['Client'],
    items: [],
    shipment: null,
    returnRequest: {
      number: 'RET-2026-0A1B2C3D',
      reason: 'Rétractation (14 jours)',
      withdrawal: true,
      requestedAt: '2026-10-01T08:00:00.000Z',
      items: [{ name: 'ETB <Braise>', quantity: 1 }],
      resolution: null,
    },
  };
  const urls = {
    order: 'https://lesterresdecaldera.fr/commande/x?access=y',
    logo: 'https://lesterresdecaldera.fr/logo.png',
  };
  const parsed = parseEmailSnapshot(JSON.parse(JSON.stringify(snapshot)));
  const ack = renderEmail('RETURN_REQUESTED', parsed, urls);
  assert.equal(
    ack.subject,
    'Accusé de rétractation RET-2026-0A1B2C3D — CAL-2026-ABC',
  );
  assert.match(ack.text, /enregistrée le 1 octobre 2026 à 10:00/);
  assert.match(ack.text, /74 rue Pierre Valdo/);
  assert.match(ack.text, /au plus tard 14 jours/);
  assert.ok(ack.html.includes('ETB &lt;Braise&gt;'));
  assert.ok(!ack.html.includes('<Braise>'));

  const rejected = renderEmail(
    'RETURN_REJECTED',
    parseEmailSnapshot({
      ...snapshot,
      returnRequest: {
        ...snapshot.returnRequest,
        withdrawal: false,
        reason: 'Autre motif',
        resolution: 'Délai <dépassé>',
      },
    }),
    urls,
  );
  assert.ok(!rejected.text.includes('Pierre Valdo'));
  assert.ok(rejected.html.includes('Délai &lt;dépassé&gt;'));
  assert.match(rejected.subject, /^Demande de retour RET-2026-0A1B2C3D/);

  const approved = renderEmail('RETURN_APPROVED', parsed, urls);
  assert.match(approved.text, /est acceptée/);
  assert.match(approved.text, /Pierre Valdo/);

  for (const returnRequest of [
    null,
    { ...snapshot.returnRequest, withdrawal: 'oui' },
    { ...snapshot.returnRequest, requestedAt: 'hier' },
    { ...snapshot.returnRequest, items: [{ name: 'x', quantity: 0 }] },
  ])
    assert.throws(() => parseEmailSnapshot({ ...snapshot, returnRequest }));
  assert.throws(() =>
    renderEmail(
      'RETURN_REQUESTED',
      parseEmailSnapshot({ ...snapshot, returnRequest: undefined }),
      urls,
    ),
  );
});
