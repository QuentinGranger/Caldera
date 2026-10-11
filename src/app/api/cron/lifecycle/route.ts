import { after } from 'next/server';
import { cronSecret, isCronAuthorized } from '@/lib/maintenance/auth';
import { runLifecycle } from '@/lib/lifecycle/run';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'no-store' };
  const secret = cronSecret(process.env.LIFECYCLE_CRON_SECRET) ?? cronSecret();
  if (!secret)
    return Response.json(
      { error: 'Planificateur indisponible' },
      { status: 503, headers },
    );
  if (!isCronAuthorized(request.headers.get('authorization'), secret))
    return Response.json({ error: 'Non autorisé' }, { status: 401, headers });
  after(async () => {
    await runLifecycle();
  });
  return Response.json({ accepted: true }, { status: 202, headers });
}
