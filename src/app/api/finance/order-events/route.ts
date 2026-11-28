import { getPrisma } from '@/lib/db/prisma';
import { cronSecret, isCronAuthorized } from '@/lib/maintenance/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = {
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow',
};
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers });

export async function GET(request: Request) {
  const secret = cronSecret(process.env.FINANCE_REPORT_SECRET ?? '');
  if (!secret) return json({ error: 'Journal indisponible' }, 503);
  if (!isCronAuthorized(request.headers.get('authorization'), secret))
    return json({ error: 'Non autorisé' }, 401);
  const cursor = new URL(request.url).searchParams.get('after') ?? '0:0';
  const match = /^(\d{1,20}):(\d{1,19})$/.exec(cursor);
  if (
    !match ||
    BigInt(match[1]!) > 18446744073709551615n ||
    BigInt(match[2]!) > 9223372036854775807n
  )
    return json({ error: 'Curseur invalide' }, 400);
  try {
    // An identity alone can skip a slow, uncommitted writer. Only expose a
    // prefix below the oldest open transaction, and order by writer then id.
    const rows = await getPrisma().$queryRaw<
      {
        cursor: string;
        reference: string;
        kind: string;
        status: string;
        fulfillment: string;
        previousStatus: string | null;
        previousFulfillment: string | null;
        at: Date;
      }[]
    >`
      SELECT writer::text || ':' || id::text AS cursor, reference, kind,
             status::text, fulfillment::text, previous_status::text AS "previousStatus",
             previous_fulfillment::text AS "previousFulfillment", occurred_at AS at
      FROM "OrderTrackingEvent"
      WHERE (writer, id) > (${match[1]}::text::xid8, ${match[2]}::bigint)
        AND writer < pg_snapshot_xmin(pg_current_snapshot())
      ORDER BY writer, id LIMIT 101
    `;
    return json({
      schema: 1,
      after: cursor,
      asOf: new Date().toISOString(),
      events: rows.slice(0, 100),
      hasMore: rows.length > 100,
    });
  } catch {
    console.error('[order-tracking] feed_unavailable');
    return json({ error: 'Journal temporairement indisponible' }, 503);
  }
}
