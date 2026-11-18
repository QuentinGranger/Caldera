import { getCeoOrderSummary } from '@/lib/finance/ceoOrders';
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
  try {
    return Response.json(await getCeoOrderSummary(), { headers });
  } catch {
    console.error('[ceo] operational_order_report_failed');
    return Response.json(
      { error: 'Données commandes indisponibles' },
      { headers, status: 503 },
    );
  }
}
