import 'server-only';

/** RFC 8058, strictly bounded before any database access. */
export async function oneClickRequestError(request: Request) {
  const contentType = request.headers.get('content-type') ?? '';
  const type = contentType.split(';')[0]?.trim().toLowerCase();
  if (
    !['application/x-www-form-urlencoded', 'multipart/form-data'].includes(
      type ?? '',
    )
  )
    return 415;
  const limit = type === 'multipart/form-data' ? 2048 : 256;
  if (Number(request.headers.get('content-length')) > limit) return 413;
  const reader = request.body?.getReader();
  if (!reader) return 400;
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        return 413;
      }
      chunks.push(value);
    }
  } catch {
    return 400;
  }
  try {
    const body = Buffer.concat(chunks);
    const form =
      type === 'multipart/form-data'
        ? await new Response(body, {
            headers: { 'Content-Type': contentType },
          }).formData()
        : new URLSearchParams(body.toString('utf8'));
    return form.getAll('List-Unsubscribe').length === 1 &&
      form.get('List-Unsubscribe') === 'One-Click'
      ? null
      : 400;
  } catch {
    return 400;
  }
}

export function oneClickResponse(status: number) {
  return new Response(null, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex, nofollow',
      ...(status === 503 ? { 'Retry-After': '3600' } : {}),
    },
  });
}
