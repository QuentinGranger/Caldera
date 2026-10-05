import 'server-only';
import { createHash } from 'node:crypto';
import { getPrisma } from '@/lib/db/prisma';

/** Database-backed ceilings shared by all server instances; no spoofable IP headers. */
export async function contactRetryAfter(
  email: string,
): Promise<null | 60 | 3600> {
  const db = getPrisma();
  async function take(key: string, maximum: number, seconds: number) {
    const rows = await db.$queryRaw<{ count: number }[]>`
      INSERT INTO "CustomerAuthAttempt" (key, count, "windowStart") VALUES (${key}, 1, NOW())
      ON CONFLICT (key) DO UPDATE SET
        count = CASE WHEN "CustomerAuthAttempt"."windowStart" < NOW() - ${seconds} * INTERVAL '1 second' THEN 1 ELSE "CustomerAuthAttempt".count + 1 END,
        "windowStart" = CASE WHEN "CustomerAuthAttempt"."windowStart" < NOW() - ${seconds} * INTERVAL '1 second' THEN NOW() ELSE "CustomerAuthAttempt"."windowStart" END
      RETURNING count`;
    return rows[0]?.count ?? maximum + 1;
  }

  const globalCount = await take('contact:global', 30, 60);
  if (globalCount > 30) return 60;
  // Hashed addresses are one row each. Prune expired rows on the first
  // accepted request of each minute so a spammer cannot grow the table forever.
  if (globalCount === 1)
    await db.customerAuthAttempt.deleteMany({
      where: { windowStart: { lt: new Date(Date.now() - 86_400_000) } },
    });
  const key = `contact:${createHash('sha256').update(email).digest('hex')}`;
  return (await take(key, 3, 3600)) <= 3 ? null : 3600;
}
