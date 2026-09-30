import 'server-only';
import { createHash } from 'node:crypto';
import { getPrisma } from '@/lib/db/prisma';

export type AccountAttemptScope =
  'sign-in' | 'sign-up' | 'reset' | 'verify' | 'newsletter' | 'stock-alert';

// Per e-mail address: a password cannot be guessed and nobody's inbox can be
// flooded with links. The global ceiling caps a spread-out attack.
const RULES: Record<AccountAttemptScope, { maximum: number; seconds: number }> =
  {
    'sign-in': { maximum: 5, seconds: 900 },
    'sign-up': { maximum: 3, seconds: 3600 },
    reset: { maximum: 3, seconds: 3600 },
    verify: { maximum: 3, seconds: 3600 },
    newsletter: { maximum: 3, seconds: 3600 },
    'stock-alert': { maximum: 5, seconds: 3600 },
  };
const GLOBAL = { maximum: 120, seconds: 60 };

/** Persisted fixed windows; no trust in spoofable forwarding headers. */
export async function allowAccountAttempt(
  scope: AccountAttemptScope,
  email: string,
) {
  const db = getPrisma();
  async function take(key: string, maximum: number, seconds: number) {
    const rows = await db.$queryRaw<{ count: number }[]>`
      INSERT INTO "CustomerAuthAttempt" (key, count, "windowStart") VALUES (${key}, 1, NOW())
      ON CONFLICT (key) DO UPDATE SET
        count = CASE WHEN "CustomerAuthAttempt"."windowStart" < NOW() - ${seconds} * INTERVAL '1 second' THEN 1 ELSE "CustomerAuthAttempt".count + 1 END,
        "windowStart" = CASE WHEN "CustomerAuthAttempt"."windowStart" < NOW() - ${seconds} * INTERVAL '1 second' THEN NOW() ELSE "CustomerAuthAttempt"."windowStart" END
      RETURNING count`;
    return (rows[0]?.count ?? maximum + 1) <= maximum;
  }
  if (!(await take('global', GLOBAL.maximum, GLOBAL.seconds))) return false;
  await db.customerAuthAttempt.deleteMany({
    where: { windowStart: { lt: new Date(Date.now() - 86400000) } },
  });
  const rule = RULES[scope];
  return take(
    `${scope}:${createHash('sha256').update(email).digest('hex')}`,
    rule.maximum,
    rule.seconds,
  );
}

/** A new password was set through a reset link: sign-in can start afresh. */
export async function clearAccountAttempts(
  scope: AccountAttemptScope,
  email: string,
) {
  await getPrisma().customerAuthAttempt.deleteMany({
    where: {
      key: `${scope}:${createHash('sha256').update(email).digest('hex')}`,
    },
  });
}
