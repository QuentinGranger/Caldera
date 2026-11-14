import { getDailyFinancialSnapshot, previousParisDay, validDay } from '@/lib/finance/dailySnapshot';
import { cronSecret, isCronAuthorized } from '@/lib/maintenance/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const headers = {
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow',
};

export async function GET(request: Request) {
  const secret = cronSecret(process.env.FINANCE_REPORT_SECRET);
  if (!secret) return Response.json(
    { error: 'Rapport financier indisponible' }, { status: 503, headers },
  );
  if (!isCronAuthorized(request.headers.get('authorization'), secret))
    return Response.json({ error: 'Non autorisé' }, { status: 401, headers });

  const day = new URL(request.url).searchParams.get('date') ?? previousParisDay();
  if (!validDay(day)) return Response.json(
    { error: 'Paramètre date invalide (YYYY-MM-DD)' },
    { status: 400, headers },
  );
  try {
    return Response.json(await getDailyFinancialSnapshot(day), { headers });
  } catch {
    console.error(JSON.stringify({ scope: 'finance', action: 'daily_report_failed' }));
    return Response.json({ error: 'Données financières temporairement indisponibles' },
      { status: 503, headers });
  }
}
