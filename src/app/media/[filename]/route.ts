import { readUploadedImage } from '@/lib/storage/images';
export const runtime = 'nodejs';
export async function GET(
  _request: Request,
  context: { params: Promise<{ filename: string }> },
) {
  const file = await readUploadedImage((await context.params).filename);
  if (!file) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(file), {
    headers: {
      'Content-Type': 'image/webp',
      'X-Content-Type-Options': 'nosniff',
      // Filenames are random UUIDs never overwritten: the CDN can keep them too.
      'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
    },
  });
}
