import { getPrisma } from '@/lib/db/prisma';
import { cronSecret, isCronAuthorized } from '@/lib/maintenance/auth';
import { getDailyFinancialSnapshot, previousParisDay } from '@/lib/finance/dailySnapshot';
import { forecastCash, parisToday, type ForecastMovement } from '@/lib/finance/cashForecast';
import { detectFinancialAnomalies } from '@/lib/finance/anomalyDetector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const responseHeaders = {
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow',
};
const dec = (d: { toString(): string }): number => Number(d.toString());

/** Read-only, private, aggregated financial risk monitor for Make. */
export async function POST(request: Request) {
  const secret = cronSecret(process.env.FINANCE_REPORT_SECRET);
  if (!secret) return Response.json({ error: 'Monitor disabled' },
    { status: 503, headers: responseHeaders });
  if (!isCronAuthorized(request.headers.get('authorization'), secret))
    return Response.json({ error: 'Unauthorized' },
      { status: 401, headers: responseHeaders });

  if (Number(request.headers.get('content-length') || 0) > 40_000)
    return Response.json({ error: 'Payload too large' },
      { status: 413, headers: responseHeaders });
  let movements: ForecastMovement[];
  try {
    const body = await request.text();
    if (body.length > 40_000) return Response.json({ error: 'Payload too large' },
      { status: 413, headers: responseHeaders });
    const decoded: unknown = JSON.parse(body);
    if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded))
      throw new Error('Invalid payload');
    const records = (decoded as Record<string, unknown>).movements;
    if (!Array.isArray(records) || records.length > 250)
      throw new Error('Invalid movements');
    // Make's empty Data Store search outputs one bundle with null fields.
    const valid = records.filter(x => x && typeof x === 'object' &&
      (x as Record<string, unknown>).kind != null);
    movements = valid.map(x => {
      const m = x as Record<string, unknown>;
      if (typeof m.kind !== 'string' || typeof m.status !== 'string' ||
          typeof m.date !== 'string' || typeof m.reference !== 'string' ||
          (typeof m.amount_eur !== 'number' && typeof m.amount_eur !== 'string'))
        throw new Error('Invalid planned event');
      return {
        kind: m.kind, status: m.status, date: m.date,
        reference: m.reference, amount_eur: Number(m.amount_eur),
      } as ForecastMovement;
    });
  } catch {
    return Response.json({ error: 'Invalid input' },
      { status: 400, headers: responseHeaders });
  }

  try {
    const db = getPrisma();
    const [daily, settings] = await Promise.all([
      getDailyFinancialSnapshot(previousParisDay()),
      db.businessPilotageSettings.findUnique({
        where: { id: 'caldera' },
        select: {
          cashBalance: true, cashReserveTarget: true,
          minimumMarginRate: true, paymentFeeRate: true,
          paymentFixedFee: true, monthlyFixedCosts: true,
          monthlyPackagingBudget: true, monthlyShippingBudget: true,
          monthlyMarketingBudget: true, monthlyOtherCosts: true,
        },
      }),
    ]);
    const monthlyBudget = settings
      ? dec(settings.monthlyFixedCosts) + dec(settings.monthlyPackagingBudget) +
        dec(settings.monthlyShippingBudget) + dec(settings.monthlyMarketingBudget) +
        dec(settings.monthlyOtherCosts)
      : null;

    // Also validates all planned expenses/dates/statuses even when no data exists.
    const forecast = forecastCash({
      asOf: parisToday(),
      openingCash: settings ? dec(settings.cashBalance) : null,
      reserveTarget: settings ? dec(settings.cashReserveTarget) : null,
      monthlyExpenseBudget: monthlyBudget,
      movements,
    });

    const result = detectFinancialAnomalies({
      daily,
      forecast,
      settings: {
        minimum_margin_rate_pct: settings ? dec(settings.minimumMarginRate) : null,
        payment_fee_rate_pct: settings ? dec(settings.paymentFeeRate) : null,
        payment_fixed_fee_eur: settings ? dec(settings.paymentFixedFee) : null,
      },
      movements,
    });
    return Response.json({
      ...result,
      as_of: forecast.as_of,
      sales_day: daily.date,
      source: 'LTC PostgreSQL/Stripe-confirmed sales, manual pilotage, Make planned outlays',
      checked_at: new Date().toISOString(),
    }, { headers: responseHeaders });
  } catch (error) {
    if (error instanceof Error && (error.message.startsWith('Invalid') ||
        error.message === 'Too many planned movements'))
      return Response.json({ error: 'Invalid planned events' },
        { status: 400, headers: responseHeaders });
    console.error(JSON.stringify({ scope: 'finance', action: 'anomalies_failed' }));
    return Response.json({ error: 'Anomaly monitor unavailable' },
      { status: 503, headers: responseHeaders });
  }
}
