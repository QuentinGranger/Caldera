import { requireAdmin } from '@/lib/admin/auth';
import { uuid } from '@/lib/admin/validation';
import { getPrisma } from '@/lib/db/prisma';
import { renderDelivery } from '@/lib/email/processor';
import { parseEnvelope } from '@/lib/email/provider';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdmin();
  const { id } = await params;
  try {
    uuid(id);
  } catch {
    return new Response('Introuvable', { status: 404 });
  }
  const email = await getPrisma().emailDelivery.findUnique({ where: { id } });
  if (!email) return new Response('Introuvable', { status: 404 });
  const rendered = email.envelope
    ? parseEnvelope(email.envelope)
    : renderDelivery(email);
  return new Response(rendered.html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Robots-Tag': 'noindex, nofollow',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy':
        "default-src 'none'; img-src 'self' https: http://localhost:* http://127.0.0.1:*; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
    },
  });
}
