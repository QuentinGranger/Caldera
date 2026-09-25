import { createHash, timingSafeEqual } from 'node:crypto';

/** Vercel recommends a random value of at least 16 characters. */
export const MIN_CRON_SECRET_LENGTH = 16;

export function cronSecret(value = process.env.CRON_SECRET) {
  return value && value.length >= MIN_CRON_SECRET_LENGTH ? value : null;
}

/** Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`; an external scheduler must do the same. */
export function isCronAuthorized(authorization: string | null, secret: string) {
  if (!authorization?.startsWith('Bearer ')) return false;
  // Equal-length digests: the comparison leaks neither the content nor the length.
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(
    digest(authorization.slice('Bearer '.length)),
    digest(secret),
  );
}
