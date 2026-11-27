import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOrderTrackingBatch } from '../scripts/make/order-tracking.cjs';
import { buildOrderHandover } from '../scripts/make/order-handover.cjs';

const at = '2026-11-26T23:05:00.000Z';
const book = (control, references = [], versions = []) => ({
  valueRanges: [
    { values: [control] },
    { values: references },
    { values: versions },
  ],
});
const event = {
  cursor: '40:6',
  reference: 'C-01',
  kind: 'CHANGED',
  status: 'PAID',
  fulfillment: 'PREPARING',
  previousStatus: 'PAID',
  previousFulfillment: 'UNFULFILLED',
  at,
};
const sync = (state, events, after = '0:0') =>
  JSON.parse(
    buildOrderTrackingBatch({
      book: state,
      page: { schema: 1, after, events, asOf: at, hasMore: false },
    }).body,
  ).requests;
const values = (req) =>
  req.updateCells.rows[0].values.map(
    (v) => Object.values(v.userEnteredValue)[0],
  );
test('Rejouer un lot produit les mêmes écritures et une seule fiche par référence', () => {
  const state = book(['0:0', 2, 1000]);
  const first = {
    ...event,
    cursor: '39:5',
    kind: 'CREATED',
    status: 'PENDING_PAYMENT',
    fulfillment: 'UNFULFILLED',
    previousStatus: null,
    previousFulfillment: null,
  };
  const patch = sync(state, [first, event]);
  assert.deepEqual(sync(state, [first, event]), patch);
  assert.equal(
    patch.filter((p) => p.updateCells.start.sheetId === 12).length,
    2,
  );
  assert.equal(values(patch[2])[1], 'Payée');
  assert.equal(values(patch[2])[7], '6');
  assert.equal(values(patch[3])[0], '40:6');
  assert.throws(() => sync(state, [event, first]), /désordonné/);
});
test('Une transaction ancienne validée tardivement laisse la fiche la plus récente en place', () => {
  const state = book(['39:9', 1001, 1000], [['C-01']], [['9']]);
  const patch = sync(state, [event], '39:9');
  assert.equal(patch.filter((p) => p.appendDimension).length, 2);
  assert.equal(
    patch.filter((p) => p.updateCells?.start.sheetId === 1752596731).length,
    0,
  );
  assert.equal(values(patch.at(-1))[1], 1002);
});
test('Une relève par jour de Paris, alerte de registre périmé et précommandes distinctes', () => {
  const report = {
    schema: 1,
    asOf: at,
    toPrepare: 0,
    preparing: 0,
    readyToShip: 0,
    waitingPreorder: 4,
    awaitingShipment48h: 0,
    paymentReview: 1,
    paymentProcessing1h: 0,
    inconsistentPaidOrders: 0,
    refundActionRequired: 0,
    refundPending24h: 0,
  };
  const rows = JSON.parse(
    buildOrderHandover({
      book: book(['0:0', 2, 1000, '2026-11-26T10:00:00Z'], [['2026-11-27']]),
      report,
    }).body,
  ).requests;
  assert.equal(rows[0].updateCells.start.rowIndex, 1);
  const row = values(rows[0]);
  assert.deepEqual(row.slice(0, 7), [
    '2026-11-27',
    'Prioritaire',
    0,
    0,
    0,
    4,
    0,
  ]);
  assert.match(row[12], /retard/);
  assert.throws(
    () => buildOrderHandover({ book: book([]), report: {} }),
    /incomplet/,
  );
});
