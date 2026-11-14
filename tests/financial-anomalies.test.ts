import assert from 'node:assert/strict';
import { test } from 'node:test';
import { forecastCash, type ForecastMovement } from '../src/lib/finance/cashForecast';
import { detectFinancialAnomalies } from '../src/lib/finance/anomalyDetector';

const daily = {
  date: '2026-11-13', paid_orders: 0,
  product_revenue_net_ht: 0, gross_margin_ht: 0,
  margin_available: false, missing_unit_cost_lines: 0,
  collected_orders_ttc: 0,
};
const settings = {
  minimum_margin_rate_pct: 20,
  payment_fee_rate_pct: 1.5,
  payment_fixed_fee_eur: 0.25,
};
function model(opts: {
  daily?: Partial<typeof daily>;
  cash?: number | null;
  reserve?: number | null;
  monthly?: number | null;
  movements?: ForecastMovement[];
  fees?: Partial<typeof settings>;
} = {}) {
  const movements = opts.movements ?? [];
  return detectFinancialAnomalies({
    daily: { ...daily, ...opts.daily },
    settings: { ...settings, ...opts.fees },
    movements,
    forecast: forecastCash({
      asOf: '2026-11-14',
      openingCash: opts.cash === undefined ? null : opts.cash,
      reserveTarget: opts.reserve === undefined ? null : opts.reserve,
      monthlyExpenseBudget: opts.monthly === undefined ? null : opts.monthly,
      movements,
    }),
  });
}

test('Pré-lancement sans ventes ni solde : ne génère aucune fausse alerte', () => {
  const r = model();
  assert.equal(r.alert_count, 0);
  assert.equal(r.status, 'NOT_READY');
  assert.ok(r.data_gaps.some(x => x.includes('solde manuel')));
});

test('Marge produits sous le minimum du pilotage : alerte, sans confondre HT et TTC', () => {
  const r = model({daily:{
    paid_orders: 2, product_revenue_net_ht: 100,
    gross_margin_ht: 12, margin_available: true, collected_orders_ttc: 120,
  },cash:5000,monthly:50,reserve:200});
  assert.ok(r.alerts.some(a => a.code === 'LOW_MARGIN'));
  assert.equal(r.alerts.find(a => a.code === 'LOW_MARGIN')?.severity,'warning');
});

test('Coût historique manquant : signaler marge non vérifiable, pas de fausse marge faible', () => {
  const r=model({daily:{paid_orders:1,product_revenue_net_ht:45,
    gross_margin_ht:null,margin_available:false,missing_unit_cost_lines:1}});
  assert.ok(r.alerts.some(a=>a.code==='MARGIN_MISSING_COST'));
  assert.ok(!r.alerts.some(a=>a.code==='LOW_MARGIN'));
});

test('Frais estimés élevés : alerte explicitement théorique', () => {
  const r=model({daily:{paid_orders:5,product_revenue_net_ht:40,
    gross_margin_ht:20,margin_available:true,collected_orders_ttc:50},
    fees:{payment_fee_rate_pct:2.9,payment_fixed_fee_eur:0.5}});
  const a=r.alerts.find(a=>a.code==='ESTIMATED_PAYMENT_FEES_HIGH');
  assert.ok(a);
  assert.match(a.explanation,/THÉORIQUES/);
  assert.match(a.explanation,/ne sont pas synchronisés/);
});

test('Sortie ponctuelle importante à moins de 30 jours, hors ventes',()=>{
  const r=model({cash:10000,monthly:1000,reserve:500,movements:[
    {kind:'other_expense',status:'proposed',date:'2026-12-01',amount_eur:800,reference:'campagne'},
    {kind:'supplier_invoice',status:'settled',date:'2026-11-25',amount_eur:5000,reference:'déjà payé'},
  ]});
  assert.ok(r.alerts.some(a=>a.code==='LARGE_PLANNED_EXPENSE'));
  assert.ok(!r.alerts.some(a=>a.code==='CASH_NEGATIVE'));
});

test('Risque solde négatif sur trésorerie MANUELLE — priorité critique',()=>{
  const r=model({cash:300,monthly:0,reserve:200,movements:[
    {kind:'stock_purchase',status:'proposed',date:'2026-12-01',amount_eur:400,reference:'réassort'},
  ]});
  assert.equal(r.alerts[0]?.code,'CASH_NEGATIVE');
  assert.equal(r.critical_count,1);
  assert.match(r.discord_message,/MANUEL/);
});

test('Solde inférieur à réserve sans être négatif',()=>{
  const r=model({cash:600,monthly:0,reserve:500,movements:[
    {kind:'supplier_invoice',status:'committed',date:'2026-11-24',amount_eur:200,reference:'facture'},
  ]});
  assert.ok(r.alerts.some(a=>a.code==='CASH_BELOW_RESERVE'));
  assert.ok(!r.alerts.some(a=>a.code==='CASH_NEGATIVE'));
});

test('Dépenses déjà réglées et aucun signal : pas de notification intempestive',()=>{
  const r=model({cash:10000,monthly:200,reserve:500,movements:[
    {kind:'other_expense',status:'settled',date:'2026-12-01',amount_eur:9000,reference:'réglé'},
  ],daily:{paid_orders:3,product_revenue_net_ht:300,gross_margin_ht:150,
    margin_available:true,collected_orders_ttc:360}});
  assert.equal(r.alert_count,0);
  assert.equal(r.status,'NO_ALERTS_WITH_LIMITATIONS');
});
