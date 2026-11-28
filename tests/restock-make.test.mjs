import { test } from 'node:test';
import assert from 'node:assert/strict';
import { manageRestock } from '../scripts/make/restock.cjs';
const id = '00000000-0000-4000-8000-000000000001';
const second = '00000000-0000-4000-8000-000000000002';
function workflow() {
  let ledger = { schema: 1, after: '', cycle: 1, cases: [] },
    tick = 0;
  const at = () => new Date(Date.UTC(2026, 10, 28, 8, 0, tick++));
  const run = (args) => {
    const r = manageRestock({ ledger, ...args }, at());
    ledger = JSON.parse(r.payload);
    return JSON.parse(r.details);
  };
  const observation = (values = {}) => ({
    id,
    sku: 'ABC',
    name: 'Booster',
    available: 0,
    reserved: 2,
    threshold: 5,
    unitsSold28d: 28,
    leadTimeDays: 4,
    discrepancy: false,
    ...values,
  });
  const page = (variants, after = '', next = '') => ({
    schema: 1,
    scope: 'reassort',
    generatedAt: at().toISOString(),
    after,
    next,
    variants,
  });
  const sync = (variants, after = '', next = '') =>
    run({ action: 'synchroniser', page: page(variants, after, next) });
  const cmd = (action, quantite, extra = {}) =>
    run({
      action,
      quantite,
      dossier: id,
      version: ledger.cases.find((c) => c.id === id).version,
      ...extra,
    }).dossiers[0];
  return { run, observation, page, sync, cmd, ledger: () => ledger };
}
test('Seuil inclus, sortie réservée, pages rejouées et référence absente', () => {
  const w = workflow(),
    p = w.page([w.observation({ available: 5 })], '', id);
  const state = w.run({ action: 'synchroniser', page: p });
  assert.equal(state.dossiers[0].stock, 'Seuil atteint');
  assert.equal(state.dossiers[0].proposition, 7);
  w.run({ action: 'synchroniser', page: p });
  assert.equal(w.ledger().cycle, 1);
  w.sync([w.observation({ id: second, available: 20 })], id);
  w.sync([]);
  assert.equal(w.ledger().cases[0].unseen, true);
  assert.throws(() => w.cmd('valider', 10), /Vérifier le stock/);
  w.sync([w.observation({ available: 10 })]);
  assert.equal(w.ledger().cases[0].stage, 'Clos');
});
test('Une réception partielle garde le solde et une relance ne le décrémente pas deux fois', () => {
  const w = workflow();
  w.sync([w.observation()]);
  w.cmd('valider', 12);
  assert.throws(
    () => w.cmd('commander', 13, { reference: 'PO-1', echeance: '2026-11-25' }),
    /supérieure/,
  );
  const order = w.cmd('commander', 12, {
    reference: 'PO-1',
    echeance: '2026-11-25',
  });
  assert.equal(order.retard, true);
  const args = {
    action: 'recevoir',
    quantite: 5,
    dossier: id,
    version: order.version,
  };
  const first = w.run(args).dossiers[0],
    repeat = w.run(args).dossiers[0];
  assert.equal(first.reste, 7);
  assert.deepEqual(first, repeat);
  assert.throws(() => w.run({ ...args, quantite: 6 }), /version/);
  w.sync([w.observation({ available: 20 })]);
  assert.equal(w.ledger().cases[0].stage, 'Partiellement reçu');
  w.cmd('recevoir', 12);
  assert.equal(w.ledger().cases[0].stage, 'Réception à vérifier');
  w.sync([w.observation({ available: 20 })]);
  assert.equal(w.ledger().cases[0].stage, 'Clos');
  w.sync([w.observation()]);
  assert.equal(w.ledger().cases[0].stage, 'À étudier');
});
test('Un écart de comptage bloque la validation et une annulation est traçable', () => {
  const w = workflow();
  const item = w.observation({ discrepancy: true, leadTimeDays: null });
  assert.equal(w.sync([item]).dossiers[0].proposition, null);
  assert.throws(() => w.cmd('valider', 3), /Vérifier le stock/);
  w.sync([w.observation()]);
  w.cmd('valider', 3);
  w.cmd('commander', 3, { reference: 'PO-2', echeance: '2026-11-30' });
  assert.throws(() => w.cmd('annuler', 0), /Motif/);
  const reopened = w.cmd('annuler', 0, { motif: 'Fournisseur indisponible' });
  assert.equal(reopened.etape, 'À étudier');
  assert.equal(reopened.reste, 0);
  assert.ok(
    w
      .ledger()
      .cases[0].history.some((h) =>
        h.detail.includes('Fournisseur indisponible'),
      ),
  );
});
