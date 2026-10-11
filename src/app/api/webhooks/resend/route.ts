import { Webhook } from 'svix';
import { recordEmailEngagement } from '@/lib/email/engagement-webhook';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const reply = (status: number) =>
  new Response(null, { status, headers: { 'Cache-Control': 'no-store' } });
export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret || process.env.EMAIL_ENGAGEMENT_ENABLED !== 'true')
    return reply(503);
  const id = request.headers.get('svix-id');
  const timestamp = request.headers.get('svix-timestamp');
  const signature = request.headers.get('svix-signature');
  if (
    !id ||
    !timestamp ||
    !signature ||
    id.length > 200 ||
    signature.length > 2000
  )
    return reply(400);
  if (Number(request.headers.get('content-length')) > 32768) return reply(413);
  const reader = request.body?.getReader();
  if (!reader) return reply(400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 32768) {
        await reader.cancel();
        return reply(413);
      }
      chunks.push(value);
    }
  } catch {
    return reply(400);
  }
  let payload: unknown;
  try {
    const raw = Buffer.concat(chunks).toString('utf8');
    new Webhook(secret).verify(raw, {
      'svix-id': id,
      'svix-timestamp': timestamp,
      'svix-signature': signature,
    });
    payload = JSON.parse(raw);
  } catch {
    return reply(400);
  }
  try {
    await recordEmailEngagement(payload);
    return reply(204);
  } catch {
    return reply(503);
  }
}
