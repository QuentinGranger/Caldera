import { cronSecret, isCronAuthorized } from '@/lib/maintenance/auth';
import { getProcurementSnapshot } from '@/lib/supplier-import/procurement';

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
      { error: 'Rapport achats indisponible' },
      { status: 503, headers },
    );
  if (!isCronAuthorized(request.headers.get('authorization'), secret))
    return Response.json({ error: 'Non autorisé' }, { status: 401, headers });
  try {
    return Response.json(await getProcurementSnapshot(), { headers });
  } catch {
    console.error('[procurement] snapshot_failed');
    return Response.json(
      { error: 'Données achats temporairement indisponibles' },
      { status: 503, headers },
    );
  }
}
