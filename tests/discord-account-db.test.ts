import 'dotenv/config';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { getPrisma } from '../src/lib/db/prisma';
import {
  createDiscordOAuthState,
  consumeDiscordOAuthState,
} from '../src/lib/discord/state';

if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1'].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  )
) {
  throw new Error('Tests réservés à PostgreSQL local de développement.');
}
const db = getPrisma();
test('OAuth state: session binding, expiration, replacement and atomic one-use consumption', async () => {
  const customer = await db.customer.create({
    data: {
      email: `discord-${randomUUID()}@example.invalid`,
      name: 'Discord test',
    },
  });
  try {
    const session = await db.customerSession.create({
      data: {
        userId: customer.id,
        token: randomUUID(),
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    const first = await createDiscordOAuthState(session.id);
    const stored = await db.discordOAuthState.findUniqueOrThrow({
      where: { sessionId: session.id },
    });
    assert.notEqual(stored.stateHash, first);
    assert.equal(
      stored.stateHash,
      createHash('sha256').update(first).digest('hex'),
    );
    assert.equal(await consumeDiscordOAuthState(first, randomUUID()), false);
    const replacement = await createDiscordOAuthState(session.id);
    assert.equal(await consumeDiscordOAuthState(first, session.id), false);
    const concurrent = await Promise.all([
      consumeDiscordOAuthState(replacement, session.id),
      consumeDiscordOAuthState(replacement, session.id),
    ]);
    assert.equal(concurrent.filter(Boolean).length, 1);
    assert.equal(
      await consumeDiscordOAuthState(replacement, session.id),
      false,
    );
    const expired = await createDiscordOAuthState(session.id);
    await db.discordOAuthState.update({
      where: { sessionId: session.id },
      data: { expiresAt: new Date(0) },
    });
    assert.equal(await consumeDiscordOAuthState(expired, session.id), false);
    assert.equal(await consumeDiscordOAuthState('invalid', session.id), false);
    await db.customerSession.delete({ where: { id: session.id } });
    assert.equal(
      await db.discordOAuthState.count({ where: { sessionId: session.id } }),
      0,
    );
  } finally {
    await db.customer.delete({ where: { id: customer.id } });
  }
});

test('Discord identity belongs to one customer and links cascade on account deletion', async () => {
  const customers = await Promise.all(
    [0, 1].map(() =>
      db.customer.create({
        data: {
          email: `discord-${randomUUID()}@example.invalid`,
          name: 'Discord test',
        },
      }),
    ),
  );
  const discordUserId = `9${Date.now()}12345`;
  try {
    await db.customerDiscordLink.create({
      data: {
        customerId: customers[0]!.id,
        discordUserId,
        displayName: 'Test',
      },
    });
    await assert.rejects(
      () =>
        db.customerDiscordLink.create({
          data: {
            customerId: customers[1]!.id,
            discordUserId,
            displayName: 'Test',
          },
        }),
      { code: 'P2002' },
    );
    await assert.rejects(
      () =>
        db.customerDiscordLink.create({
          data: {
            customerId: customers[0]!.id,
            discordUserId: '999999999999999999',
            displayName: 'Test',
          },
        }),
      { code: 'P2002' },
    );
    await db.customer.delete({ where: { id: customers[0]!.id } });
    assert.equal(
      await db.customerDiscordLink.count({ where: { discordUserId } }),
      0,
    );
  } finally {
    await db.customer.deleteMany({
      where: { id: { in: customers.map((c) => c.id) } },
    });
  }
});

test('role recovery, unique link and concurrent retry/unlink preserve the final role state', async (t) => {
  const {
    linkDiscordAccount,
    synchronizeDiscordLinkedRole,
    unlinkDiscordAccount,
  } = await import('../src/lib/discord/link');
  const keys = [
    'DISCORD_CLIENT_ID',
    'DISCORD_CLIENT_SECRET',
    'DISCORD_BOT_TOKEN',
    'DISCORD_GUILD_ID',
    'DISCORD_LINKED_ROLE_ID',
  ];
  const previous = keys.map((key) => process.env[key]);
  const fake = [
    '1557428863842128011',
    'test-secret',
    'test-token',
    '1557428863842128014',
    '1557428863842128020',
  ];
  keys.forEach((key, i) => {
    process.env[key] = fake[i];
  });
  const customer = await db.customer.create({
    data: {
      email: `discord-${randomUUID()}@example.invalid`,
      name: 'Discord test',
    },
  });
  const second = await db.customer.create({
    data: {
      email: `discord-${randomUUID()}@example.invalid`,
      name: 'Discord test',
    },
  });
  let fail = true;
  let role = false;
  let grantStarted: (() => void) | undefined;
  let releaseGrant: (() => void) | undefined;
  let gate: Promise<void> | undefined;
  t.mock.method(
    globalThis,
    'fetch',
    async (_url: unknown, init: RequestInit) => {
      if (init.method === 'GET') return new Response(null, { status: 200 });
      if (fail) return new Response(null, { status: 503 });
      if (init.method === 'PUT') {
        grantStarted?.();
        await gate;
        role = true;
      }
      if (init.method === 'DELETE') role = false;
      return new Response(null, { status: 204 });
    },
  );
  try {
    const identity = { id: '1557428863842128030', displayName: 'Test' };
    assert.equal(
      await linkDiscordAccount(customer.id, identity),
      'unavailable',
    );
    assert.equal(
      (
        await db.customerDiscordLink.findUniqueOrThrow({
          where: { customerId: customer.id },
        })
      ).roleGrantedAt,
      null,
    );
    assert.equal(
      await linkDiscordAccount(second.id, identity),
      'already_linked',
    );
    assert.equal(await unlinkDiscordAccount(customer.id), 'unavailable');
    assert.equal(
      await db.customerDiscordLink.count({
        where: { customerId: customer.id },
      }),
      1,
    );
    fail = false;
    const started = new Promise<void>((resolve) => {
      grantStarted = resolve;
    });
    gate = new Promise<void>((resolve) => {
      releaseGrant = resolve;
    });
    const retry = synchronizeDiscordLinkedRole(customer.id);
    await started;
    const unlink = unlinkDiscordAccount(customer.id);
    releaseGrant!();
    assert.equal(await retry, 'linked');
    assert.equal(await unlink, 'unlinked');
    assert.equal(role, false);
    assert.equal(
      await db.customerDiscordLink.count({
        where: { customerId: customer.id },
      }),
      0,
    );
  } finally {
    t.mock.restoreAll();
    keys.forEach((key, i) => {
      if (previous[i] === undefined) delete process.env[key];
      else process.env[key] = previous[i];
    });
    await db.customer.deleteMany({
      where: { id: { in: [customer.id, second.id] } },
    });
  }
});
