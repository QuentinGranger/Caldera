import 'server-only';
import { getPrisma } from '@/lib/db/prisma';

const ZONE = 'Europe/Paris';
const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const number = (value: { toString(): string } | null | undefined) =>
  value == null ? 0 : Number(value.toString());

export function validDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const candidate = new Date(value + 'T00:00:00.000Z');
  return !Number.isNaN(candidate.getTime()) &&
    candidate.toISOString().slice(0, 10) === value;
}

export function previousParisDay(reference = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(reference);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const localDay = `${part('year')}-${part('month')}-${part('day')}`;
  const date = new Date(localDay + 'T00:00:00.000Z');
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/** Convert Paris midnight to UTC; each boundary is resolved independently for DST. */
export function parisMidnightUtc(day: string) {
  if (!validDay(day)) throw new Error('Invalid report date');
  const utcMidnight = new Date(day + 'T00:00:00.000Z');
  const zoneName = new Intl.DateTimeFormat('en-GB', {
    timeZone: ZONE, timeZoneName: 'longOffset',
  }).formatToParts(utcMidnight).find((p) => p.type === 'timeZoneName')?.value;
  const offset = /^GMT([+-])(\d{2}):(\d{2})$/.exec(zoneName ?? '');
  if (!offset) throw new Error('Europe/Paris offset unavailable');
  const sign = offset[1] === '+' ? 1 : -1;
  const minutes = sign * (Number(offset[2]) * 60 + Number(offset[3]));
  return new Date(utcMidnight.getTime() - minutes * 60_000);
}

export async function getDailyFinancialSnapshot(day: string) {
  if (!validDay(day)) throw new Error('Invalid report date');
  const start = parisMidnightUtc(day);
  const following = new Date(day + 'T00:00:00.000Z');
  following.setUTCDate(following.getUTCDate() + 1);
  const end = parisMidnightUtc(following.toISOString().slice(0, 10));
  const db = getPrisma();

  const [orders, refunds, pilotage] = await Promise.all([
    db.order.findMany({
      where: { status: 'PAID', currency: 'EUR', paidAt: { gte: start, lt: end } },
      select: {
        totalAmount: true,
        items: { select: {
          lineTotal: true, discountAmount: true, taxAmount: true, taxRate: true,
          unitCost: true, quantity: true,
        } },
      },
    }),
    db.refund.findMany({
      where: {
        status: 'SUCCEEDED', currency: 'EUR',
        succeededAt: { gte: start, lt: end },
      },
      select: {
        amount: true, shippingAmount: true, restockedAt: true,
        items: { select: {
          amount: true, quantity: true,
          orderItem: { select: {
            lineTotal: true, discountAmount: true, taxAmount: true,
            unitCost: true,
          } },
        } },
      },
    }),
    db.businessPilotageSettings.findUnique({
      where: { id: 'caldera' },
      select: { cashBalance: true, monthlyFixedCosts: true,
        monthlyPackagingBudget: true, monthlyShippingBudget: true,
        monthlyMarketingBudget: true, monthlyOtherCosts: true },
    }),
  ]);

  let gross = 0;
  let discounts = 0;
  let cost = 0;
  let costMissing = 0;
  for (const order of orders) {
    for (const item of order.items) {
      // VAT is recorded on the discounted amount. Convert both the gross
      // product sale and the promotion discount to HT using the same factor.
      const lineTtcAfterDiscount = number(item.lineTotal) - number(item.discountAmount);
      const lineHtAfterDiscount = lineTtcAfterDiscount - number(item.taxAmount);
      const htFactor = lineTtcAfterDiscount > 0
        ? Math.max(0, lineHtAfterDiscount / lineTtcAfterDiscount)
        : item.taxRate == null
          ? 1
          : 1 / (1 + number(item.taxRate) / 100);
      const discountHt = number(item.discountAmount) * htFactor;
      gross += lineHtAfterDiscount + discountHt;
      discounts += discountHt;
      if (item.unitCost == null) costMissing++;
      else cost += number(item.unitCost) * item.quantity;
    }
  }

  let refundedProducts = 0;
  let refundedShippingTtc = 0;
  let refundedTotalTtc = 0;
  let unknownRefundTax = false;
  for (const refund of refunds) {
    refundedTotalTtc += number(refund.amount);
    refundedShippingTtc += number(refund.shippingAmount);
    const itemRefundTotal = refund.items.reduce((sum, item) => sum + number(item.amount), 0);
    // A goodwill-only refund has no item tax allocation: keep it separate from HT totals.
    if (number(refund.amount) - number(refund.shippingAmount) - itemRefundTotal > 0.009) {
      unknownRefundTax = true;
    }
    for (const item of refund.items) {
      const originalGross = number(item.orderItem.lineTotal) - number(item.orderItem.discountAmount);
      const vatShare = originalGross > 0
        ? Math.min(1, Math.max(0, number(item.orderItem.taxAmount) / originalGross))
        : 0;
      refundedProducts += number(item.amount) * (1 - vatShare);
      if (refund.restockedAt) {
        if (item.orderItem.unitCost == null) costMissing++;
        else cost -= number(item.orderItem.unitCost) * item.quantity;
      }
    }
  }

  const revenue = round(gross - discounts - refundedProducts);
  const marginAvailable = costMissing === 0 && !unknownRefundTax;
  const paidGrossTtc = orders.reduce((sum, o) => sum + number(o.totalAmount), 0);
  // NOT bank balance or actual booked expenses. Budget is a manually maintained estimate.
  const monthlyBudget = pilotage
    ? number(pilotage.monthlyFixedCosts) + number(pilotage.monthlyPackagingBudget) +
      number(pilotage.monthlyShippingBudget) + number(pilotage.monthlyMarketingBudget) +
      number(pilotage.monthlyOtherCosts)
    : null;

  return {
    date: day,
    timezone: ZONE,
    period_start_utc: start.toISOString(),
    period_end_utc: end.toISOString(),
    source: 'Caldera PostgreSQL / Stripe-confirmed orders',
    sales_source_connected: true,
    accounting_source_connected: false,
    paid_orders: orders.length,
    gross_sales_ht: round(gross),
    discounts_ht: round(discounts),
    refunds_ht: unknownRefundTax ? null : round(refundedProducts),
    cogs_ht: marginAvailable ? round(cost) : null,
    margin_available: marginAvailable && (orders.length > 0 || refunds.length > 0),
    margin_coverage_complete: marginAvailable,
    product_revenue_net_ht: unknownRefundTax ? null : revenue,
    gross_margin_ht: marginAvailable ? round(revenue - cost) : null,
    collected_orders_ttc: round(paidGrossTtc),
    refunded_total_ttc: round(refundedTotalTtc),
    refunded_shipping_ttc: round(refundedShippingTtc),
    refund_tax_allocation_complete: !unknownRefundTax,
    missing_unit_cost_lines: costMissing,
    operating_expenses_ht: null,
    cash_available_eur: null,
    cash_balance_manual_eur: pilotage ? round(number(pilotage.cashBalance)) : null,
    monthly_operating_budget_eur: monthlyBudget === null ? null : round(monthlyBudget),
    source_note: 'CA produits HT hors frais de livraison. Remboursements attribués à leur jour de succès. Frais réels et solde bancaire non connectés. Le solde de pilotage est manuel, non bancaire. Marge indisponible si coûts historiques ou ventilation de remboursement incomplets.',
    updated_at: new Date().toISOString(),
  };
}
