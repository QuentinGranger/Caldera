/**
 * Deterministic TTC cash forecasting. Inputs are cash movements, not revenue or margin.
 * The current balance already includes settled orders, so settled invoices are excluded.
 */
export type ForecastMovement = {
  kind: 'supplier_invoice' | 'stock_purchase' | 'other_expense' | 'customer_invoice' | 'other_income';
  status: 'committed' | 'proposed' | 'settled' | 'cancelled';
  date: string;
  amount_eur: number;
  reference: string;
};
export type ForecastInput = {
  asOf: string; // Europe/Paris date, YYYY-MM-DD
  openingCash: number | null; // manually entered bank/cash baseline, NOT live bank data
  reserveTarget: number | null;
  monthlyExpenseBudget: number | null; // budget, not actual invoices
  movements: ForecastMovement[];
};

const money = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const inCents = (n: number) => Math.round(n * 100);
const fromCents = (n: number) => n / 100;

export function validForecastDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + 'T00:00:00.000Z');
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function parisToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const p = (key: string) => parts.find((part) => part.type === key)?.value ?? '';
  return `${p('year')}-${p('month')}-${p('day')}`;
}

export function forecastCash(input: ForecastInput) {
  if (!validForecastDate(input.asOf)) throw new Error('Invalid forecast date');
  const finiteAmount = (value: number | null) =>
    value === null || (Number.isFinite(value) && Math.abs(value) <= 100_000_000);
  if (!finiteAmount(input.openingCash) || !finiteAmount(input.reserveTarget) ||
      !finiteAmount(input.monthlyExpenseBudget) || (input.monthlyExpenseBudget ?? 0) < 0)
    throw new Error('Invalid forecast amounts');
  if (input.movements.length > 250) throw new Error('Too many planned movements');
  const validKinds = ['supplier_invoice', 'stock_purchase', 'other_expense', 'customer_invoice', 'other_income'];
  const validStatuses = ['committed', 'proposed', 'settled', 'cancelled'];
  for (const m of input.movements) {
    if (!validForecastDate(m.date) || !validKinds.includes(m.kind) ||
        !validStatuses.includes(m.status) ||
        !Number.isFinite(m.amount_eur) || m.amount_eur <= 0 ||
        m.amount_eur > 1_000_000 ||
        !Number.isInteger(m.amount_eur * 100 + 1e-8) && Math.abs(m.amount_eur * 100 - Math.round(m.amount_eur * 100)) > 1e-7 ||
        typeof m.reference !== 'string' || m.reference.length > 160)
      throw new Error('Invalid planned movement');
  }
  const asOf = new Date(input.asOf + 'T00:00:00.000Z');
  const horizons = [30, 60, 90] as const;
  const cashCents = input.openingCash == null ? null : inCents(input.openingCash);
  const reserveCents = input.reserveTarget == null ? null : inCents(input.reserveTarget);
  return {
    as_of: input.asOf,
    currency: 'EUR',
    opening_cash_eur: input.openingCash == null ? null : fromCents(cashCents!),
    opening_cash_source: 'pilotage_manual_not_bank_connected',
    monthly_budget_eur: input.monthlyExpenseBudget == null ? null : money(input.monthlyExpenseBudget),
    reserve_target_eur: input.reserveTarget == null ? null : fromCents(reserveCents!),
    movement_count: input.movements.filter(m => m.status === 'committed' || m.status === 'proposed').length,
    horizons: horizons.map(days => {
      const cutoff = new Date(asOf);
      cutoff.setUTCDate(cutoff.getUTCDate() + days);
      const cutoffIso = cutoff.toISOString().slice(0, 10);
      const within = input.movements.filter(m =>
        (m.status === 'committed' || m.status === 'proposed') && m.date <= cutoffIso);
      const incoming = (m: ForecastMovement) => m.kind === 'customer_invoice' || m.kind === 'other_income';
      const sum = (ms: ForecastMovement[]) => ms.reduce((n,m) => n + inCents(m.amount_eur),0);
      const receipts = sum(within.filter(m => m.status === 'committed' && incoming(m)));
      const payments = sum(within.filter(m => m.status === 'committed' && !incoming(m)));
      const optionalPurchases = sum(within.filter(m => m.status === 'proposed' && !incoming(m)));
      const optionalReceipts = sum(within.filter(m => m.status === 'proposed' && incoming(m)));
      // 365.25/12 calendar-average days; operating budget is a scenario estimate, not booked expenses.
      const budget = input.monthlyExpenseBudget == null ? null :
        Math.round(inCents(input.monthlyExpenseBudget) * days / (365.25 / 12));
      const baselineProjected = cashCents == null || budget == null ? null :
        cashCents + receipts - payments - budget;
      const includingProposals = baselineProjected == null ? null : baselineProjected - optionalPurchases;
      return {
        days, date: cutoffIso,
        committed_receipts_eur: fromCents(receipts),
        committed_payments_eur: fromCents(payments),
        proposed_purchases_and_expenses_eur: fromCents(optionalPurchases),
        proposed_receipts_excluded_eur: fromCents(optionalReceipts),
        budgeted_charges_eur: budget === null ? null : fromCents(budget),
        cash_budgeted_eur: baselineProjected == null ? null : fromCents(baselineProjected),
        cash_with_proposals_eur: includingProposals == null ? null : fromCents(includingProposals),
        gap_to_reserve_eur: includingProposals == null || reserveCents === null ? null :
          fromCents(Math.max(0, reserveCents - includingProposals)),
      };
    }),
    assumptions: [
      'Opening cash is manually entered in the admin; no connected banking feed.',
      'Recurring operating charges are pro-rated monthly BUDGET, not scheduled bank debits.',
      'Unpaid invoice and planned stock purchase cash movements must be added in the Make planning register.',
      'Paid customer invoices and stock already purchased are not new future cash movements.',
      'Proposed income is excluded; proposed purchases and expenses only appear in the conservative scenario.',
      'Do not add recurring budgeted costs again as cash movements (prevent double counting).',
      'Only active committed/proposed movements are counted; mark settled entries as settled after payment.',
    ],
  };
}
