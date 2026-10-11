import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { appOrigin } from '@/lib/orders/access';
function signature(id: string, expires: string) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32)
    throw new Error('Configuration des liens indisponible.');
  return createHmac('sha256', secret)
    .update(`caldera:cart-recovery:v1:${id}:${expires}`)
    .digest('hex');
}
export function recoveryToken(id: string, expiresAt: Date) {
  const expires = String(expiresAt.getTime());
  return `${id}.${expires}.${signature(id, expires)}`;
}
export function verifyRecoveryToken(token: unknown, now = new Date()) {
  if (typeof token !== 'string') return null;
  const match = /^([a-f0-9-]{36})\.(\d{13})\.([a-f0-9]{64})$/.exec(token);
  if (
    !match ||
    Number(match[2]) <= now.getTime() ||
    Number(match[2]) > now.getTime() + 8 * 86400000
  )
    return null;
  try {
    return timingSafeEqual(
      Buffer.from(signature(match[1]!, match[2]!), 'hex'),
      Buffer.from(match[3]!, 'hex'),
    )
      ? match[1]
      : null;
  } catch {
    return null;
  }
}
export function recoveryUrl(id: string, expiresAt: Date) {
  return `${appOrigin()}/panier/reprendre#token=${encodeURIComponent(recoveryToken(id, expiresAt))}`;
}
