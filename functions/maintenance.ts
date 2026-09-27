const MAINTENANCE_URL = 'https://lesterresdecaldera.fr/api/cron/maintenance';
const headers = { 'Cache-Control': 'no-store' };

function json(body: object, status: number) {
  return Response.json(body, { status, headers });
}

const maintenanceScheduler = {
  async fetch(request: Request) {
    if (request.method !== 'POST')
      return new Response(null, {
        status: 405,
        headers: { ...headers, Allow: 'POST' },
      });

    // Neon removes client-supplied X-Neon-* headers before invoking a Function.
    if (!request.headers.get('x-neon-trigger-invocation-id'))
      return json({ error: 'Trigger Neon requis' }, 403);

    const secret = process.env.MAINTENANCE_SECRET;
    if (!secret || secret.length < 16) {
      console.error(
        JSON.stringify({
          scope: 'maintenance-scheduler',
          action: 'secret_missing',
        }),
      );
      return json({ error: 'Planificateur indisponible' }, 503);
    }

    try {
      const response = await fetch(MAINTENANCE_URL, {
        headers: { Authorization: `Bearer ${secret}` },
        signal: AbortSignal.timeout(15_000),
      });
      if (response.status !== 202) {
        console.error(
          JSON.stringify({
            scope: 'maintenance-scheduler',
            action: 'maintenance_rejected',
            status: response.status,
          }),
        );
        return json({ error: 'Maintenance refusée' }, 502);
      }
      return json({ accepted: true }, 202);
    } catch {
      console.error(
        JSON.stringify({
          scope: 'maintenance-scheduler',
          action: 'maintenance_unreachable',
        }),
      );
      return json({ error: 'Maintenance inaccessible' }, 502);
    }
  },
};

export default maintenanceScheduler;
