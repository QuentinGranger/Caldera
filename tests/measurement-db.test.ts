import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { getPrisma } from '../src/lib/db/prisma';
import { purgeMeasurement } from '../src/lib/analytics/server';
if (
  !process.env.DATABASE_URL ||
  !['localhost', '127.0.0.1'].includes(
    new URL(process.env.DATABASE_URL).hostname,
  )
)
  throw new Error('Tests réservés à PostgreSQL local.');
test('mesure : purge après 90 jours même lorsque la collecte est désactivée', async () => {
  const db = getPrisma();
  const old = randomUUID(),
    recent = randomUUID();
  const enabled = process.env.MEASUREMENT_ENABLED;
  try {
    await db.measurementSession.createMany({
      data: [
        {
          id: old,
          visitorHash: 'a'.repeat(64),
          channel: 'direct',
          source: 'direct',
          startedAt: new Date(Date.now() - 91 * 86400000),
        },
        {
          id: recent,
          visitorHash: 'b'.repeat(64),
          channel: 'direct',
          source: 'direct',
        },
      ],
    });
    process.env.MEASUREMENT_ENABLED = 'false';
    await purgeMeasurement();
    assert.equal(await db.measurementSession.count({ where: { id: old } }), 0);
    assert.equal(
      await db.measurementSession.count({ where: { id: recent } }),
      1,
    );
  } finally {
    if (enabled === undefined) delete process.env.MEASUREMENT_ENABLED;
    else process.env.MEASUREMENT_ENABLED = enabled;
    await db.measurementSession.deleteMany({
      where: { id: { in: [old, recent] } },
    });
    await db.$disconnect();
  }
});
