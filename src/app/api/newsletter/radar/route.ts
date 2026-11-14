import { cronSecret, isCronAuthorized } from '@/lib/maintenance/auth';
import { getOpeningRadar } from '@/lib/newsletter/radar';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const headers = { 'Cache-Control': 'private, no-store' };

export async function GET(request: Request) {
  const secret = cronSecret(process.env.NEWSLETTER_RADAR_SECRET ?? '');
  if (!secret)
    return Response.json(
      { error: 'Bilan indisponible' },
      { status: 503, headers },
    );
  if (!isCronAuthorized(request.headers.get('authorization'), secret))
    return Response.json({ error: 'Non autorisé' }, { status: 401, headers });
  return Response.json(await getOpeningRadar(), { headers });
}
