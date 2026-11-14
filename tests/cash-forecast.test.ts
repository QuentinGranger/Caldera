import assert from 'node:assert/strict';
import { test } from 'node:test';
import { forecastCash, parisToday, validForecastDate } from '../src/lib/finance/cashForecast';

test('Paris day and UTC-independent cutoff dates', () => {
  assert.equal(parisToday(new Date('2026-11-14T23:30:00Z')), '2026-11-15');
  assert.equal(validForecastDate('2026-02-29'), false);
  assert.equal(validForecastDate('2028-02-29'), true);
});

test('30 60 90: committed invoices, stock acquisitions and optional purchases', () => {
  const r = forecastCash({
    asOf: '2026-11-14', openingCash: 3000, reserveTarget: 500,
    monthlyExpenseBudget: 300,
    movements: [
      { kind: 'customer_invoice', status: 'committed', date: '2026-11-28', amount_eur: 500, reference: 'receivable' },
      { kind: 'supplier_invoice', status: 'committed', date: '2026-12-01', amount_eur: 400, reference: 'invoice' },
      { kind: 'stock_purchase', status: 'proposed', date: '2026-12-03', amount_eur: 200, reference: 'stock plan' },
      { kind: 'stock_purchase', status: 'committed', date: '2027-01-02', amount_eur: 150, reference: 'approved order' },
      { kind: 'customer_invoice', status: 'proposed', date: '2026-11-30', amount_eur: 999, reference: 'unconfirmed sale' },
      { kind: 'supplier_invoice', status: 'settled', date: '2026-11-17', amount_eur: 5000, reference: 'paid' },
    ],
  });
  assert.deepEqual(r.horizons.map(h=>h.days), [30,60,90]);
  assert.equal(r.horizons[0]!.committed_receipts_eur, 500);
  assert.equal(r.horizons[0]!.committed_payments_eur, 400);
  assert.equal(r.horizons[0]!.proposed_purchases_and_expenses_eur, 200);
  assert.equal(r.horizons[0]!.proposed_receipts_excluded_eur, 999);
  assert.equal(r.horizons[1]!.committed_payments_eur, 550);
  assert.equal(r.horizons[2]!.committed_payments_eur, 550);
  assert.equal(r.horizons[0]!.cash_with_proposals_eur, r.horizons[0]!.cash_budgeted_eur! - 200);
  assert.ok(r.horizons[2]!.cash_budgeted_eur! < r.horizons[1]!.cash_budgeted_eur!);
});

test('Unentered cash is NOT silently treated as 0', () => {
  const r = forecastCash({asOf:'2026-11-14',openingCash:null,reserveTarget:null,monthlyExpenseBudget:null,movements:[]});
  assert.equal(r.horizons[0]!.cash_budgeted_eur,null);
  assert.equal(r.horizons[2]!.cash_with_proposals_eur,null);
});

test('Overdue unpaid invoices are due immediately, settled excluded', () => {
  const r=forecastCash({asOf:'2026-11-14',openingCash:250,reserveTarget:100,monthlyExpenseBudget:0,movements:[
    {kind:'supplier_invoice',status:'committed',date:'2026-11-01',amount_eur:160,reference:'late'},
    {kind:'supplier_invoice',status:'settled',date:'2026-11-01',amount_eur:120,reference:'paid'}
  ]});
  assert.equal(r.horizons[0]!.cash_budgeted_eur,90);
  assert.equal(r.horizons[0]!.gap_to_reserve_eur,10);
});

test('Reject invalid dates, statuses and quantities', () => {
  assert.throws(()=>forecastCash({asOf:'2026-13-32',openingCash:0,reserveTarget:0,monthlyExpenseBudget:0,movements:[]}));
  assert.throws(()=>forecastCash({asOf:'2026-11-14',openingCash:0,reserveTarget:0,monthlyExpenseBudget:0,movements:[{kind:'supplier_invoice',status:'committed',date:'2026-11-14',amount_eur:-30,reference:'negative'}]}));
});
