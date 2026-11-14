import {
  getCategorySnapshot,
  lastClosedMonth,
} from '@/lib/finance/categorySnapshot';
import { cronSecret, isCronAuthorized } from '@/lib/maintenance/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const headers = {
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow',
};

export async function GET(request: Request) {
  const secret = cronSecret(process.env.FINANCE_REPORT_SECRET);
  if (!secret)
    return Response.json(
      { error: 'Rapport indisponible' },
      { headers, status: 503 },
    );
  if (!isCronAuthorized(request.headers.get('authorization'), secret))
    return Response.json({ error: 'Non autorisé' }, { headers, status: 401 });

  const last = lastClosedMonth();
  const period = new URL(request.url).searchParams.get('month') ?? last;
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(period) || period > last)
    return Response.json(
      { error: 'Mois clôturé attendu (YYYY-MM)' },
      { headers, status: 400 },
    );
  try {
    return Response.json(await getCategorySnapshot(period), { headers });
  } catch {
    console.error('[finance] category_report_failed');
    return Response.json(
      { error: 'Données temporairement indisponibles' },
      { headers, status: 503 },
    );
  }
}
