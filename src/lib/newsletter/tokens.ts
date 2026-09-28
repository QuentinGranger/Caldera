import 'server-only';
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { appOrigin } from '@/lib/orders/access';

export function newNewsletterConfirmationToken() {
  return randomBytes(32).toString('base64url');
}

export function newsletterTokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function signingKey() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32)
    throw new Error('Configuration des liens newsletter manquante.');
  return createHmac('sha256', secret).update('caldera:newsletter').digest();
}

function unsubscribeSignature(id: string) {
  return createHmac('sha256', signingKey())
    .update(`caldera:newsletter:unsubscribe:${id}`)
    .digest('hex');
}

export function newsletterConfirmationUrl(token: string) {
  return `${appOrigin()}/newsletter/confirmation?token=${encodeURIComponent(token)}`;
}

export function newsletterUnsubscribeToken(id: string) {
  return `${id}.${unsubscribeSignature(id)}`;
}

export function newsletterUnsubscribeUrl(id: string) {
  return `${appOrigin()}/newsletter/desinscription?token=${encodeURIComponent(newsletterUnsubscribeToken(id))}`;
}

export function verifyNewsletterUnsubscribeToken(token: unknown) {
  if (typeof token !== 'string') return null;
  const match =
    /^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.([0-9a-f]{64})$/i.exec(
      token,
    );
  if (!match?.[1] || !match[2]) return null;
  try {
    const expected = Buffer.from(unsubscribeSignature(match[1]), 'hex');
    const received = Buffer.from(match[2], 'hex');
    return timingSafeEqual(expected, received) ? match[1] : null;
  } catch {
    return null;
  }
}
