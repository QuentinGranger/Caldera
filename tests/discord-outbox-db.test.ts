import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test, after } from 'node:test';
import { getPrisma } from '../src/lib/db/prisma';
import {
  enqueueDiscord,
  processDiscordOutbox,
  claimDiscordPublication,
  queueProductRelease,
} from '../src/lib/discord/outbox';
import { changeStock } from '../src/lib/admin/inventory';

if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1'].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  )
)
  throw new Error('PostgreSQL local uniquement.');
const db = getPrisma();
const prefix = `discord-outbox-test:${randomUUID()}:`;
const original: Record<string, string | undefined> = {};
for (const key of [
  'SITE_URL',
  'DISCORD_PUBLICATIONS_ENABLED',
  'DISCORD_WEBHOOK_RELEASES',
  'DISCORD_WEBHOOK_RESTOCKS',
  'DISCORD_WEBHOOK_ANNOUNCEMENTS',
  'DISCORD_WEBHOOK_CAMPAIGNS',
]) {
  original[key] = process.env[key];
  process.env[key] =
    key === 'SITE_URL'
      ? 'https://lesterresdecaldera.fr'
      : key === 'DISCORD_PUBLICATIONS_ENABLED'
        ? 'true'
        : 'https://discord.com/api/webhooks/123456789012345678/' +
          'a'.repeat(50);
}
after(async () => {
  await db.discordOutbox.deleteMany({
    where: { eventKey: { startsWith: prefix } },
  });
  await db.$disconnect();
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});
const publication = {
  kind: 'announcement' as const,
  title: 'Validation technique',
  summary: 'Test automatisé sans appel Discord réel.',
  path: '/catalogue',
};
async function queue(key: string) {
  await db.$transaction((tx) => enqueueDiscord(tx, prefix + key, publication));
}
async function clean() {
  await db.discordOutbox.deleteMany({
    where: { eventKey: { startsWith: prefix } },
  });
}

test('transaction rollback and event deduplication', async () => {
  await assert.rejects(
    db.$transaction(async (tx) => {
      await enqueueDiscord(tx, prefix + 'rollback', publication);
      throw new Error('rollback');
    }),
  );
  assert.equal(
    await db.discordOutbox.count({ where: { eventKey: prefix + 'rollback' } }),
    0,
  );
  await Promise.all([queue('unique'), queue('unique')]);
  assert.equal(
    await db.discordOutbox.count({ where: { eventKey: prefix + 'unique' } }),
    1,
  );
  await clean();
});
test('concurrent workers send a single publication once', async () => {
  await queue('parallel');
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls++;
    await new Promise((resolve) => setTimeout(resolve, 20));
    return new Response(JSON.stringify({ id: '123456789012345678' }));
  };
  const results = await Promise.all([
    processDiscordOutbox({ fetcher }),
    processDiscordOutbox({ fetcher }),
  ]);
  assert.equal(calls, 1);
  assert.equal(
    results.reduce((n, r) => n + r.sent, 0),
    1,
  );
  assert.equal(
    (
      await db.discordOutbox.findUniqueOrThrow({
        where: { eventKey: prefix + 'parallel' },
      })
    ).status,
    'SENT',
  );
  await clean();
});
test('unknown network outcome and abandoned lease require review, never automatic replay', async () => {
  await queue('timeout');
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls++;
    throw new Error('sensitive provider response');
  };
  assert.equal((await processDiscordOutbox({ fetcher })).review, 1);
  await processDiscordOutbox({ fetcher });
  assert.equal(calls, 1);
  await queue('crash');
  const claimed = await claimDiscordPublication();
  assert.ok(claimed);
  await db.discordOutbox.update({
    where: { id: claimed.id },
    data: { lockedAt: new Date(0) },
  });
  assert.equal(await claimDiscordPublication(), null);
  assert.equal(
    (await db.discordOutbox.findUniqueOrThrow({ where: { id: claimed.id } }))
      .status,
    'REVIEW',
  );
  await clean();
});
test('429 pauses the shared queue and respects retry-after', async () => {
  await queue('rate1');
  await queue('rate2');
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls++;
    return new Response(null, {
      status: 429,
      headers: { 'retry-after': '120' },
    });
  };
  assert.equal((await processDiscordOutbox({ fetcher })).retry, 1);
  await processDiscordOutbox({ fetcher });
  assert.equal(calls, 1);
  const deferred = await db.discordOutbox.findFirstOrThrow({
    where: { eventKey: { startsWith: prefix }, status: 'RETRY' },
  });
  assert.ok(deferred.nextAttemptAt.getTime() > Date.now() + 100_000);
  await clean();
});
test('real physical restock hook, product grouping, verified release scheduling and depublication', async () => {
  const admin = await db.adminUser.create({
    data: {
      email: 'outbox-' + randomUUID() + '@example.invalid',
      name: 'QA Discord',
      role: 'ADMIN',
      isActive: true,
    },
  });
  const category = await db.category.create({
    data: { name: 'Discord QA', slug: 'discord-qa-' + randomUUID() },
  });
  const product = await db.product.create({
    data: {
      name: 'Produit QA Discord',
      slug: 'discord-qa-' + randomUUID(),
      categoryId: category.id,
      productType: 'BOOSTER',
      status: 'ACTIVE',
      newArrival: true,
      releaseDate: new Date(Date.now() + 86_400_000),
    },
  });
  const variant = await db.productVariant.create({
    data: { productId: product.id, sku: randomUUID(), price: 5 },
  });
  try {
    await db.$transaction((tx) => queueProductRelease(tx, product.id));
    const release = await db.discordOutbox.findUniqueOrThrow({
      where: { eventKey: 'release:' + product.id },
    });
    assert.ok(release.nextAttemptAt.getTime() > Date.now());
    await db.$transaction((tx) =>
      changeStock(tx, admin.id, variant.id, {
        mode: 'delta',
        quantity: 3,
        type: 'RESTOCK',
        reason: 'QA stock physique',
      }),
    );
    const restock = await db.discordOutbox.findFirstOrThrow({
      where: { productId: product.id, kind: 'restock' },
    });
    await db.$transaction((tx) =>
      changeStock(tx, admin.id, variant.id, {
        mode: 'delta',
        quantity: 1,
        type: 'RESTOCK',
        reason: 'QA déjà disponible',
      }),
    );
    assert.equal(
      await db.discordOutbox.count({
        where: { productId: product.id, kind: 'restock' },
      }),
      1,
    );
    await db.product.update({
      where: { id: product.id },
      data: { status: 'DRAFT' },
    });
    let calls = 0;
    await processDiscordOutbox({
      fetcher: async () => {
        calls++;
        throw new Error();
      },
    });
    assert.equal(calls, 0);
    assert.equal(
      (await db.discordOutbox.findUniqueOrThrow({ where: { id: restock.id } }))
        .status,
      'CANCELLED',
    );
  } finally {
    await db.discordOutbox.deleteMany({ where: { productId: product.id } });
    await db.adminAuditLog.deleteMany({ where: { entityId: variant.id } });
    await db.inventoryAdjustment.deleteMany({
      where: { variantId: variant.id },
    });
    await db.productVariant.delete({ where: { id: variant.id } });
    await db.product.delete({ where: { id: product.id } });
    await db.category.delete({ where: { id: category.id } });
    await db.adminUser.delete({ where: { id: admin.id } });
  }
});
