import { verifyNewsletterUnsubscribeToken } from '@/lib/newsletter/tokens';
import { unsubscribeNewsletter } from '@/lib/newsletter/unsubscribe';
import {
  oneClickRequestError,
  oneClickResponse as reply,
} from '@/lib/email/one-click';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// No GET mutation: link scanners must not unsubscribe a reader. Mailbox
// providers POST cross-origin without cookies; the signature is the authority.
export async function POST(request: Request) {
  const invalid = await oneClickRequestError(request);
  if (invalid) return reply(invalid);
  const id = verifyNewsletterUnsubscribeToken(
    new URL(request.url).searchParams.get('token'),
  );
  if (!id) return reply(400);
  try {
    await unsubscribeNewsletter(id);
    return reply(200);
  } catch {
    console.error(
      JSON.stringify({ scope: 'newsletter', action: 'one_click_unavailable' }),
    );
    return reply(503);
  }
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token');
  if (!verifyNewsletterUnsubscribeToken(token)) return reply(400);
  const url = new URL('/newsletter/desinscription', request.url);
  url.searchParams.set('token', token!);
  return new Response(null, {
    status: 307,
    headers: {
      Location: url.href,
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
