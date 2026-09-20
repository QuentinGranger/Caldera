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
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
