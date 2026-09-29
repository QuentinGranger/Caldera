import 'dotenv/config';
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { hashPassword, verifyPassword } from 'better-auth/crypto';
import { getPrisma } from '../src/lib/db/prisma';
import { mockPwnedPasswords } from './helpers/pwned';

if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1'].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  )
)
  throw new Error('Tests réservés à PostgreSQL local.');

process.env.BETTER_AUTH_SECRET ||= randomBytes(32).toString('hex');
process.env.APP_URL = 'http://localhost:3000';
// The breach check stays on, answered offline.
delete process.env.PASSWORD_BREACH_CHECK;
const pwned = mockPwnedPasswords();

const { getAdminAuth } = await import('../src/lib/admin/auth');
const { allowLogin } = await import('../src/lib/admin/login');
const { isBreachedPassword } = await import('../src/lib/auth/passwordPolicy');
const { setAdminPasswordResetMailer } =
  await import('../src/lib/admin/password-reset-email');
const db = getPrisma();

type Mail = { kind: string; to: string; action: string };

function tokenOf(mail: Mail | undefined) {
  assert.ok(mail, 'e-mail absent');
  const url = new URL(mail.action);
  // Never in the query string: the fragment stays out of server logs.
  assert.equal(url.search, '');
  const token = new URLSearchParams(url.hash.slice(1)).get('token');
  assert.ok(token);
  return token;
}

async function createAdmin(key: string, isActive = true) {
  // As scripts/create-admin.ts: the credential account id is the user id.
  const id = randomUUID();
  return db.adminUser.create({
    data: {
      id,
      email: `admin-reset-${key}@example.com`,
      name: 'Admin Reset',
      isActive,
      accounts: {
        create: {
          accountId: id,
          providerId: 'credential',
          password: await hashPassword(`ancien-${key}`),
        },
      },
      sessions: {
        create: {
          token: randomUUID(),
          expiresAt: new Date(Date.now() + 3600_000),
        },
      },
    },
  });
}

test('mot de passe admin : lien unique, haché, remplacé, audité, confirmé', async () => {
  const key = randomUUID();
  const user = await createAdmin(key);
  const inactive = await createAdmin(`${key}-off`, false);
  const email = user.email;
  const mails: Mail[] = [];
  setAdminPasswordResetMailer(async (message) => {
    mails.push(message);
  });
  const auth = getAdminAuth();
  try {
    await auth.api.requestPasswordReset({ body: { email } });
    const first = tokenOf(mails.at(-1));
    await auth.api.requestPasswordReset({ body: { email } });
    const token = tokenOf(mails.at(-1));
    assert.equal(mails.at(-1)?.kind, 'reset');
    assert.equal(mails.at(-1)?.to, email);

    // Only a hash of the latest link is stored.
    const rows = await db.adminVerification.findMany({
      where: { value: user.id },
    });
    assert.equal(rows.length, 1);
    assert.ok(!rows[0]!.identifier.includes(token));
    await assert.rejects(
      auth.api.resetPassword({
        body: { token: first, newPassword: `remplacé-${key}` },
      }),
      (error: { body?: { code?: string } }) =>
        error.body?.code === 'INVALID_TOKEN',
    );

    // A leaked password is caught before the link is used.
    const leaked = `fuité-${key}`;
    pwned.breach(leaked);
    assert.equal(await isBreachedPassword(leaked), true);
    assert.equal(await isBreachedPassword(`nouveau-${key}`), false);

    // Earlier failed sign-ins locked the address; the reset lifts it.
    for (let attempt = 0; attempt < 6; attempt++) await allowLogin(email);
    assert.equal(await allowLogin(email), false);

    const newPassword = `nouveau-${key}`;
    await auth.api.resetPassword({ body: { token, newPassword } });
    const account = await db.adminAccount.findFirstOrThrow({
      where: { userId: user.id, providerId: 'credential' },
      select: { password: true },
    });
    assert.ok(account.password);
    assert.equal(
      await verifyPassword({
        hash: account.password,
        password: `ancien-${key}`,
      }),
      false,
    );
    assert.equal(
      await verifyPassword({ hash: account.password, password: newPassword }),
      true,
    );
    assert.equal(
      await db.adminSession.count({ where: { userId: user.id } }),
      0,
    );
    assert.equal(
      await db.adminVerification.count({ where: { value: user.id } }),
      0,
    );
    assert.equal(await allowLogin(email), true);
    assert.equal(mails.at(-1)?.kind, 'password-changed');
    const log = await db.adminAuditLog.findFirst({
      where: { adminUserId: user.id, action: 'PASSWORD_RESET' },
    });
    assert.equal(log?.entityId, user.id);
    await assert.rejects(
      auth.api.resetPassword({ body: { token, newPassword } }),
    );

    // A deactivated account and an unknown address: no e-mail at all.
    const before = mails.length;
    await auth.api.requestPasswordReset({ body: { email: inactive.email } });
    await auth.api.requestPasswordReset({
      body: { email: `inconnu-${key}@example.com` },
    });
    assert.equal(mails.length, before);
  } finally {
    setAdminPasswordResetMailer(null);
    pwned.restore();
    const ids = [user.id, inactive.id];
    await db.adminAuditLog.deleteMany({ where: { adminUserId: { in: ids } } });
    await db.adminVerification.deleteMany({ where: { value: { in: ids } } });
    await db.adminSession.deleteMany({ where: { userId: { in: ids } } });
    await db.adminAccount.deleteMany({ where: { userId: { in: ids } } });
    await db.adminUser.deleteMany({ where: { id: { in: ids } } });
    await db.adminLoginAttempt.deleteMany({
      where: {
        key: {
          in: [email, inactive.email].flatMap((address) => {
            const hash = createHash('sha256').update(address).digest('hex');
            return [hash, `reset:${hash}`];
          }),
        },
      },
    });
    await db.$disconnect();
  }
});
