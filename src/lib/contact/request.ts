export class ContactRequestError extends Error {
  constructor(public readonly status: 400 | 413 | 415) {
    super('Invalid contact request');
  }
}

const MAX_BODY_BYTES = 20_000;

/** Read an upper bound from the stream too: Content-Length can be absent. */
export async function readContactBody(
  request: Request,
): Promise<Record<string, unknown>> {
  if (
    !/^application\/json(?:\s*;|\s*$)/i.test(
      request.headers.get('content-type') ?? '',
    )
  )
    throw new ContactRequestError(415);

  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES)
    throw new ContactRequestError(413);

  const reader = request.body?.getReader();
  if (!reader) throw new ContactRequestError(400);

  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new ContactRequestError(413);
      }
      chunks.push(value);
    }
    const body = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(
        Buffer.concat(chunks, size),
      ),
    ) as unknown;
    if (!body || typeof body !== 'object' || Array.isArray(body))
      throw new ContactRequestError(400);
    return body as Record<string, unknown>;
  } catch (error) {
    if (error instanceof ContactRequestError) throw error;
    throw new ContactRequestError(400);
  } finally {
    reader.releaseLock();
  }
}
