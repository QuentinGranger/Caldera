import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
const ACCESS_DURATION = 180 * 86400;
function secret() {
  const value = process.env.ORDER_ACCESS_SECRET;
  if (!value || value.length < 32)
    throw new Error('Configuration des liens de consultation manquante.');
  return value;
}
export function appOrigin() {
  const url = new URL(
    process.env.APP_URL || process.env.SITE_URL || 'http://localhost:3000',
  );
  if (
    url.username ||
    url.password ||
    (url.protocol !== 'https:' &&
      !(
        url.protocol === 'http:' &&
        ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
      ))
  )
    throw new Error('Origine de la boutique invalide.');
  return url.origin;
}
function signature(publicId: string, expires: string) {
  return createHmac('sha256', secret())
    .update(`caldera:read-order:${publicId}:${expires}`)
    .digest('hex');
}
export function orderAccessUrl(publicId: string, now = new Date()) {
  const expires = String(Math.floor(now.getTime() / 1000) + ACCESS_DURATION);
  return `${appOrigin()}/commande/${publicId}?access=${expires}.${signature(publicId, expires)}`;
}
export function verifyOrderAccess(
  publicId: string,
  access: unknown,
  now = new Date(),
) {
  if (!/^[a-f0-9]{64}$/.test(publicId) || typeof access !== 'string')
    return false;
  const match = /^(\d{10})\.([a-f0-9]{64})$/.exec(access);
  if (!match) return false;
  const expires = Number(match[1]);
  const current = Math.floor(now.getTime() / 1000);
  if (expires <= current || expires > current + ACCESS_DURATION + 60)
    return false;
  try {
    return timingSafeEqual(
      Buffer.from(match[2]!, 'hex'),
      Buffer.from(signature(publicId, match[1]!), 'hex'),
    );
  } catch {
    return false;
  }
}
