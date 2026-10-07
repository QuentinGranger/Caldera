import { requireAdmin } from '@/lib/admin/auth';
import { uuid } from '@/lib/admin/validation';
import { getPrisma } from '@/lib/db/prisma';
import { readReturnPhoto } from '@/lib/returns/photos';

export const runtime = 'nodejs';

/** A customer's photo of a return: the administration only, never cached. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ photoId: string }> },
) {
  await requireAdmin();
  const { photoId } = await params;
  try {
    uuid(photoId);
  } catch {
    return new Response('Introuvable', { status: 404 });
  }
  const photo = await getPrisma().returnPhoto.findUnique({
    where: { id: photoId },
    select: { filename: true },
  });
  const file = photo && (await readReturnPhoto(photo.filename));
  if (!file) return new Response('Introuvable', { status: 404 });
  return new Response(new Uint8Array(file), {
    headers: {
      'Content-Type': 'image/webp',
      'Content-Disposition': 'inline',
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, nofollow',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    },
  });
}
