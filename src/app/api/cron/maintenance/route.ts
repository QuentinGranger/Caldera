import { after } from 'next/server';
import { cronSecret, isCronAuthorized } from '@/lib/maintenance/auth';
import { runMaintenance } from '@/lib/maintenance/jobs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Upper bound for the after() work; an interrupted batch resumes safely on the next run.
export const maxDuration = 60;

const headers = { 'Cache-Control': 'no-store' };

export async function GET(request: Request) {
  const secret = cronSecret();
  if (!secret) {
    console.error(
      JSON.stringify({ scope: 'maintenance', action: 'cron_secret_missing' }),
    );
    return Response.json(
      { error: 'Planificateur indisponible' },
      { status: 503, headers },
    );
  }

  if (!isCronAuthorized(request.headers.get('authorization'), secret)) {
    console.error(
      JSON.stringify({ scope: 'maintenance', action: 'cron_unauthorized' }),
    );
    return Response.json({ error: 'Non autorisé' }, { status: 401, headers });
  }

  // Acknowledge at once: the jobs report through JSON logs, not the response.
  after(async () => {
    await runMaintenance();
  });

  return Response.json({ accepted: true }, { status: 202, headers });
}
