import 'server-only';
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { appOrigin } from '@/lib/orders/access';

export function newStockAlertToken() {
  return randomBytes(32).toString('base64url');
}

/** Only this hash is stored: a copy of the database confirms nothing. */
export function stockAlertTokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function signingKey() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32)
    throw new Error('Configuration des alertes de stock manquante.');
  return createHmac('sha256', secret).update('caldera:stock-alerts').digest();
}

function removalSignature(id: string) {
  return createHmac('sha256', signingKey())
    .update(`caldera:stock-alert:remove:${id}`)
    .digest('hex');
}

// Links carry their token in the fragment: never in server logs nor Referer.
export function stockAlertConfirmationUrl(token: string) {
  return `${appOrigin()}/alertes/confirmation#token=${encodeURIComponent(token)}`;
}

export function stockAlertRemovalToken(id: string) {
  return `${id}.${removalSignature(id)}`;
}

export function stockAlertRemovalUrl(id: string) {
  return `${appOrigin()}/alertes/desinscription#token=${encodeURIComponent(stockAlertRemovalToken(id))}`;
}

/** The alert id of a valid removal token, null otherwise. */
export function verifyStockAlertRemovalToken(token: unknown) {
  if (typeof token !== 'string') return null;
  const match =
    /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([0-9a-f]{64})$/i.exec(
      token,
    );
  if (!match?.[1] || !match[2]) return null;
  try {
    const expected = Buffer.from(removalSignature(match[1]), 'hex');
    const received = Buffer.from(match[2], 'hex');
    return timingSafeEqual(expected, received) ? match[1] : null;
  } catch {
    return null;
  }
}
