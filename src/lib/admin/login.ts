import 'server-only';
import { createHash } from 'node:crypto';
import { getPrisma } from '@/lib/db/prisma';
/** Persisted fixed windows; no trust in spoofable forwarding headers. */
export async function allowLogin(email: string) {
  const db = getPrisma();
  async function take(key: string, maximum: number, seconds: number) {
    const rows = await db.$queryRaw<{ count: number }[]>`
      INSERT INTO "AdminLoginAttempt" (key, count, "windowStart") VALUES (${key}, 1, NOW())
      ON CONFLICT (key) DO UPDATE SET
        count = CASE WHEN "AdminLoginAttempt"."windowStart" < NOW() - ${seconds} * INTERVAL '1 second' THEN 1 ELSE "AdminLoginAttempt".count + 1 END,
        "windowStart" = CASE WHEN "AdminLoginAttempt"."windowStart" < NOW() - ${seconds} * INTERVAL '1 second' THEN NOW() ELSE "AdminLoginAttempt"."windowStart" END
      RETURNING count`;
    return (rows[0]?.count ?? maximum + 1) <= maximum;
  }
  if (!(await take('global', 60, 60))) return false;
  await db.adminLoginAttempt.deleteMany({
    where: { windowStart: { lt: new Date(Date.now() - 86400000) } },
  });
  return take(createHash('sha256').update(email).digest('hex'), 5, 900);
}

/** Separate bucket: requesting a reset never consumes the sign-in allowance. */
export async function allowAdminPasswordReset(email: string) {
  const db = getPrisma();
  async function take(key: string, maximum: number, seconds: number) {
    const rows = await db.$queryRaw<{ count: number }[]>`
      INSERT INTO "AdminLoginAttempt" (key, count, "windowStart") VALUES (${key}, 1, NOW())
      ON CONFLICT (key) DO UPDATE SET
        count = CASE WHEN "AdminLoginAttempt"."windowStart" < NOW() - ${seconds} * INTERVAL '1 second' THEN 1 ELSE "AdminLoginAttempt".count + 1 END,
        "windowStart" = CASE WHEN "AdminLoginAttempt"."windowStart" < NOW() - ${seconds} * INTERVAL '1 second' THEN NOW() ELSE "AdminLoginAttempt"."windowStart" END
      RETURNING count`;
    return (rows[0]?.count ?? maximum + 1) <= maximum;
  }
  if (!(await take('reset:global', 20, 60))) return false;
  return take(
    `reset:${createHash('sha256').update(email).digest('hex')}`,
    3,
    3600,
  );
}

/** A new password was set through a reset link: sign-in can start afresh. */
export async function clearAdminLoginAttempts(email: string) {
  await getPrisma().adminLoginAttempt.deleteMany({
    where: {
      key: {
        in: [
          createHash('sha256').update(email).digest('hex'),
          `reset:${createHash('sha256').update(email).digest('hex')}`,
        ],
      },
    },
  });
}
