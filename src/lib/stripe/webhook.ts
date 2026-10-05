import 'server-only';
import Stripe from 'stripe';

// Stripe events are much smaller than this. Read the stream with a real byte
// limit: Content-Length alone can be omitted or forged by an HTTP client.
export const MAX_WEBHOOK_BODY_BYTES = 1024 * 1024;

export class WebhookPayloadTooLargeError extends Error {}

export async function readWebhookBody(request: Request): Promise<string> {
  const length = request.headers.get('content-length');
  if (length && /^\d+$/.test(length) && Number(length) > MAX_WEBHOOK_BODY_BYTES)
    throw new WebhookPayloadTooLargeError();

  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_WEBHOOK_BODY_BYTES) {
        await reader.cancel();
        throw new WebhookPayloadTooLargeError();
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, size).toString('utf8');
}

export function verifyWebhook(
  raw: string,
  signature: string,
  secret: string,
): Stripe.Event {
  return Stripe.webhooks.constructEvent(raw, signature, secret);
}
