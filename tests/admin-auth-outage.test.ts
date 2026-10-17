import 'dotenv/config';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getPrisma } from '../src/lib/db/prisma';
import {
  AdminAuthUnavailableError,
  allowAdminPasswordReset,
  allowLogin,
} from '../src/lib/admin/login';

if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1'].includes(
    new URL(process.env.DATABASE_URL ?? 'invalid:').hostname,
  )
)
  throw new Error('Tests réservés à PostgreSQL local.');

test('panne du stockage des limites admin : refus sûr identique pour toute adresse, sans secret exposé', async (t) => {
  const db = getPrisma();
  const databaseError = new Error(
    'quota exceeded; sensitive connection details must not reach the UI or logs',
  );
  const originalQuery = db.$queryRaw;
  let queryCount = 0;
  db.$queryRaw = async () => {
    queryCount++;
    throw databaseError;
  };
  const log = t.mock.method(console, 'error', () => {});
  t.after(async () => {
    db.$queryRaw = originalQuery;
    await db.$disconnect();
  });

  const messages: string[] = [];
  // Storage fails before the account lookup: every valid address receives the
  // same answer, whether registered or not, for both operations.
  for (const email of ['admin@example.com', 'unknown@example.com']) {
    for (const operation of [allowLogin, allowAdminPasswordReset])
      await assert.rejects(operation(email), (error: unknown) => {
        assert.ok(error instanceof AdminAuthUnavailableError);
        messages.push(error.message);
        return true;
      });
  }
  assert.equal(queryCount, 4);
  for (const message of messages) {
    assert.match(message, /temporairement indisponible/);
    assert.doesNotMatch(message, /envoyé|identifiants|quota|sensitive/);
    assert.equal(message, messages[0]);
  }
  assert.equal(log.mock.callCount(), 4);
  for (const call of log.mock.calls)
    assert.deepEqual(JSON.parse(String(call.arguments[0])), {
      scope: 'admin',
      action: 'login_storage_unavailable',
    });
});
