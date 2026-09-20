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
