import { getPrisma } from '@/lib/db/prisma';
import { cronSecret, isCronAuthorized } from '@/lib/maintenance/auth';
import { forecastCash, parisToday, type ForecastMovement } from '@/lib/finance/cashForecast';
import { landedCost } from '@/lib/finance/landedCost';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = {
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow',
};
const number = (value: { toString(): string } | null | undefined): number =>
  value == null ? 0 : Number(value.toString());

export async function POST(request: Request) {
  const secret = cronSecret(process.env.FINANCE_REPORT_SECRET);
  if (!secret) return Response.json({ error: 'Forecast disabled' }, { status: 503, headers });
  if (!isCronAuthorized(request.headers.get('authorization'), secret))
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 40_000) return Response.json({ error: 'Payload too large' }, { status: 413, headers });
  try {
    const body = await request.text();
    if (body.length > 40_000) return Response.json({ error: 'Payload too large' }, { status: 413, headers });
    const payload: unknown = JSON.parse(body);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload))
      return Response.json({ error: 'Invalid payload' }, { status: 400, headers });
    const data = payload as Record<string, unknown>;
    if (!Array.isArray(data.movements) || data.movements.length > 250)
      return Response.json({ error: 'Invalid movements' }, { status: 400, headers });
    // An empty Data Store search may produce one empty Make bundle; it isn't a movement.
    const rawMovements = data.movements.filter(x =>
      x && typeof x === 'object' && (x as Record<string, unknown>).kind);
    if (rawMovements.length > 250)
      return Response.json({ error: 'Too many movements' }, { status: 400, headers });
    const movements = rawMovements.map((value) => {
      const record = value as Record<string, unknown>;
      if (typeof record.kind !== 'string' || typeof record.status !== 'string' ||
          typeof record.date !== 'string' || typeof record.reference !== 'string' ||
          (typeof record.amount_eur !== 'number' && typeof record.amount_eur !== 'string')) {
        throw new Error('Invalid movement fields');
      }
      return {
        kind: record.kind, status: record.status, date: record.date,
        reference: record.reference, amount_eur: Number(record.amount_eur),
      } as ForecastMovement;
    });
    const db = getPrisma();
    const [settings, variants] = await Promise.all([
      db.businessPilotageSettings.findUnique({ where: { id: 'caldera' },
        select: { cashBalance: true, cashReserveTarget: true,
          monthlyFixedCosts: true, monthlyPackagingBudget: true,
          monthlyShippingBudget: true, monthlyMarketingBudget: true,
          monthlyOtherCosts: true, updatedAt: true } }),
      db.productVariant.findMany({
        where: { isActive: true, product: { status: { not: 'ARCHIVED' } } },
        select: { stockQuantity: true, costPrice: true,
          inboundShippingCost: true, procurementFees: true },
      }),
    ]);
    const monthlyBudget = settings ? number(settings.monthlyFixedCosts) +
      number(settings.monthlyPackagingBudget) + number(settings.monthlyShippingBudget) +
      number(settings.monthlyMarketingBudget) + number(settings.monthlyOtherCosts) : null;
    const model = forecastCash({
      asOf: parisToday(),
      openingCash: settings ? number(settings.cashBalance) : null,
      reserveTarget: settings ? number(settings.cashReserveTarget) : null,
      monthlyExpenseBudget: monthlyBudget,
      movements,
    });
    let stockUnits = 0;
    let unvaluedUnits = 0;
    let stockValue = 0;
    for (const variant of variants) {
      if (variant.stockQuantity <= 0) continue;
      stockUnits += variant.stockQuantity;
      const unitCost = landedCost(variant);
      if (unitCost === null) unvaluedUnits += variant.stockQuantity;
      else stockValue += Number(unitCost.toString()) * variant.stockQuantity;
    }
    return Response.json({
      ...model, status: settings ? 'PROVISIONAL_MANUAL_BASELINE' : 'MISSING_CASH_BASELINE',
      source: 'Caldera pilotage settings + Make planned cash movements',
      base_settings_updated_at: settings?.updatedAt.toISOString() ?? null,
      stock: {
        units_on_hand: stockUnits,
        acquisition_cost_eur: unvaluedUnits ? null : Math.round(stockValue * 100) / 100,
        units_missing_cost: unvaluedUnits,
        note: 'Existing inventory is cash already invested, not a future cash payment. Proposed acquisitions come only from entered stock_purchase events.',
      },
      invoice_coverage: 'Customer invoices are issued after checkout payment. Future supplier invoices and receivables require manually scheduled entries in Make; not synchronized with accounting.',
      generated_at: new Date().toISOString(),
    }, { headers });
  } catch (error) {
    if (error instanceof Error && (error.message.startsWith('Invalid') || error.message === 'Too many planned movements'))
      return Response.json({ error: 'Invalid forecast inputs' }, { status: 400, headers });
    console.error(JSON.stringify({ scope: 'finance', action: 'forecast_failed' }));
    return Response.json({ error: 'Forecast temporarily unavailable' }, { status: 503, headers });
  }
}
