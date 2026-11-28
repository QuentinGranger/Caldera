import { getInventoryReport } from '@/lib/inventory/report';
import { cronSecret, isCronAuthorized } from '@/lib/maintenance/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const headers = {
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow',
};

export async function GET(request: Request) {
  const secret = cronSecret(process.env.FINANCE_REPORT_SECRET ?? '');
  if (!secret)
    return Response.json(
      { error: 'Rapport stock indisponible' },
      { headers, status: 503 },
    );
  if (!isCronAuthorized(request.headers.get('authorization'), secret))
    return Response.json({ error: 'Non autorisé' }, { headers, status: 401 });
  try {
    const params = new URL(request.url).searchParams;
    if (params.get('vue') === 'reassort') {
      const after = params.get('after') ?? '';
      if (
        after &&
        !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(after)
      )
        return Response.json(
          { error: 'Curseur de stock invalide' },
          { status: 400, headers },
        );
      const report = await getInventoryReport(new Date(), after);
      return Response.json(report.feed, { headers });
    }
    return Response.json(await getInventoryReport(), { headers });
  } catch {
    console.error('[inventory] report_failed');
    return Response.json(
      { error: 'Données stock temporairement indisponibles' },
      { headers, status: 503 },
    );
  }
}
