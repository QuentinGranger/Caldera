import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { CART_LIFETIME_SECONDS } from './constants';
export function newCartToken() {
  return randomBytes(32).toString('hex');
}
export function cartTokenHash(token: string | undefined): string | null {
  return token && /^[a-f0-9]{64}$/.test(token)
    ? createHash('sha256').update(token).digest('hex')
    : null;
}
export function cartExpiry() {
  return new Date(Date.now() + CART_LIFETIME_SECONDS * 1000);
}
