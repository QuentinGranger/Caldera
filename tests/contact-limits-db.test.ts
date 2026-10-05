import 'dotenv/config';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { getPrisma } from '../src/lib/db/prisma';
import { contactRetryAfter } from '../src/lib/contact/limits';

const connection = process.env.DATABASE_URL;
if (
  (process.env.CONTACT_LIMITS_DB_TEST !== '1' && process.env.CI !== 'true') ||
  !connection ||
  !['localhost', '127.0.0.1'].includes(new URL(connection).hostname)
)
  throw new Error('Ce test nécessite une base PostgreSQL QA locale explicite.');

const db = getPrisma();
after(() => db.$disconnect());

test('contact: trois envois par adresse et par heure, puis refus', async () => {
  const email = `contact-${randomUUID()}@example.com`;
  const key = `contact:${createHash('sha256').update(email).digest('hex')}`;
  const global = await db.customerAuthAttempt.findUnique({
    where: { key: 'contact:global' },
  });
  try {
    for (let index = 0; index < 3; index++)
      assert.equal(await contactRetryAfter(email), null);
    assert.equal(await contactRetryAfter(email), 3600);
  } finally {
    await db.customerAuthAttempt.deleteMany({
      where: { key: { in: [key, 'contact:global'] } },
    });
    if (global) await db.customerAuthAttempt.create({ data: global });
  }
});
