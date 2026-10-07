import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GET } from '../src/app/api/cron/discord/route';
import {
  discordProductTitle,
  processDiscordOutbox,
} from '../src/lib/discord/outbox';
import { renderDiscordPublication } from '../src/lib/discord/publication';
import { sendDiscordPublication } from '../src/lib/discord/webhook';
test('worker denies public access and missing configuration', async () => {
  delete process.env.CRON_SECRET;
  delete process.env.DISCORD_WORKER_SECRET;
  const request = new Request(
    'https://lesterresdecaldera.fr/api/cron/discord?check=1',
  );
  assert.equal((await GET(request)).status, 503);
  process.env.DISCORD_WORKER_SECRET = 'test_worker_secret_at_least_16';
  assert.equal((await GET(request)).status, 401);
  delete process.env.DISCORD_WORKER_SECRET;
});
test('disabled worker never contacts a database or provider', async () => {
  delete process.env.DISCORD_PUBLICATIONS_ENABLED;
  assert.equal(
    (
      await processDiscordOutbox({
        fetcher: async () => {
          throw Error('must not execute');
        },
      })
    ).disabled,
    true,
  );
});
test('private and transactional paths cannot be sent to public Discord', () => {
  for (const path of [
    '/compte',
    '/commande/123',
    '/checkout',
    '/api/discord/callback',
    '/admin',
    '/catalogue?token=secret',
  ])
    assert.throws(() =>
      renderDiscordPublication(
        { kind: 'announcement', title: 'Titre', summary: 'Texte', path },
        'https://lesterresdecaldera.fr',
      ),
    );
});
test('timeouts and 5xx are uncertain and must not be auto-retried', async () => {
  process.env.DISCORD_PUBLICATIONS_ENABLED = 'true';
  process.env.DISCORD_WEBHOOK_ANNOUNCEMENTS =
    'https://discord.com/api/webhooks/123456789012345678/' + 'a'.repeat(50);
  try {
    for (const fetcher of [
      async () => {
        throw Error('timeout');
      },
      async () => new Response(null, { status: 503 }),
    ])
      assert.deepEqual(
        await sendDiscordPublication(
          { kind: 'announcement', title: 'Titre', summary: 'Texte', path: '/' },
          { fetcher, origin: 'https://lesterresdecaldera.fr' },
        ),
        { status: 'review' },
      );
  } finally {
    delete process.env.DISCORD_PUBLICATIONS_ENABLED;
    delete process.env.DISCORD_WEBHOOK_ANNOUNCEMENTS;
  }
});

test('long product names fit notifications without breaking stock changes', () => {
  assert.equal(discordProductTitle('Produit ' + 'x'.repeat(200)).length, 160);
  assert.equal(discordProductTitle('  Produit\nPokémon  '), 'Produit Pokémon');
});
