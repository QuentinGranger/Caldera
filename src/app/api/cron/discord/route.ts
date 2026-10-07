import { after } from 'next/server';
import { cronSecret, isCronAuthorized } from '@/lib/maintenance/auth';
import { safelyProcessDiscordOutbox } from '@/lib/discord/outbox';
import { launchReadiness } from '@/lib/discord/readiness';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const headers = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
};
export async function GET(request: Request) {
  const secrets = [
    cronSecret(),
    cronSecret(process.env.DISCORD_WORKER_SECRET),
  ].filter((s): s is string => Boolean(s));
  if (!secrets.length)
    return Response.json(
      { error: 'Planificateur indisponible' },
      { status: 503, headers },
    );
  if (
    !secrets.some((s) =>
      isCronAuthorized(request.headers.get('authorization'), s),
    )
  )
    return Response.json({ error: 'Non autorisé' }, { status: 401, headers });
  if (new URL(request.url).searchParams.get('check') === '1')
    return Response.json(await launchReadiness(), { headers });
  after(safelyProcessDiscordOutbox);
  return Response.json({ accepted: true }, { status: 202, headers });
}
