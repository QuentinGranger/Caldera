import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderDiscordPublication } from '../src/lib/discord/publication';
import {
  discordWebhookUrl,
  sendDiscordPublication,
} from '../src/lib/discord/webhook';

const event = {
  kind: 'release' as const,
  title: 'ETB @everyone **Braise**',
  summary: 'Une nouvelle sortie disponible.',
  path: '/produit/etb-braise',
};
const webhook =
  'https://discord.com/api/webhooks/123456789012345678/' + 'a'.repeat(50);

test('publication publique : mentions neutralisées et lien interne', () => {
  const result = renderDiscordPublication(
    event,
    'https://lesterresdecaldera.fr',
  );
  assert.deepEqual(result.allowed_mentions, { parse: [] });
  assert.match(result.content, /@\u200beveryone/);
  assert.match(result.content, /\\\*\\\*Braise\\\*\\\*/);
  assert.match(
    result.content,
    /https:\/\/lesterresdecaldera.fr\/produit\/etb-braise/,
  );
  for (const path of [
    '//evil.test/x',
    '/produit/x?token=secret',
    '/produit/x#secret',
    '/produit\\evil',
  ])
    assert.throws(() =>
      renderDiscordPublication(
        { ...event, path },
        'https://lesterresdecaldera.fr',
      ),
    );
  assert.throws(() => renderDiscordPublication(event, 'http://localhost:3000'));
});

test('webhook : domaine et chemin stricts', () => {
  assert.ok(discordWebhookUrl(webhook));
  for (const url of [
    'https://discord.com.evil.test/api/webhooks/123456789012345678/' +
      'a'.repeat(50),
    'http://discord.com/api/webhooks/123456789012345678/' + 'a'.repeat(50),
    webhook + '?wait=true',
    webhook + '#secret',
    'https://discord.com/api/users/@me',
  ])
    assert.equal(discordWebhookUrl(url), null);
});

test('désactivé : aucun appel réseau ; activé : confirmation et délai 429', async () => {
  const previousEnabled = process.env.DISCORD_PUBLICATIONS_ENABLED;
  const previousWebhook = process.env.DISCORD_WEBHOOK_RELEASES;
  let calls = 0;
  const fetcher: typeof fetch = async (_input, init) => {
    calls++;
    const body = JSON.parse(String(init?.body));
    assert.deepEqual(body.allowed_mentions, { parse: [] });
    assert.equal(init?.redirect, 'error');
    return new Response(JSON.stringify({ id: '123456789012345678' }), {
      status: 200,
    });
  };
  try {
    delete process.env.DISCORD_PUBLICATIONS_ENABLED;
    assert.deepEqual(await sendDiscordPublication(event, { fetcher }), {
      status: 'disabled',
    });
    assert.equal(calls, 0);
    process.env.DISCORD_PUBLICATIONS_ENABLED = 'true';
    process.env.DISCORD_WEBHOOK_RELEASES = webhook;
    assert.deepEqual(
      await sendDiscordPublication(event, {
        fetcher,
        origin: 'https://lesterresdecaldera.fr',
      }),
      { status: 'sent', messageId: '123456789012345678' },
    );
    assert.equal(calls, 1);
    assert.deepEqual(
      await sendDiscordPublication(event, {
        fetcher: async () =>
          new Response(null, {
            status: 429,
            headers: { 'retry-after': '2.5' },
          }),
        origin: 'https://lesterresdecaldera.fr',
      }),
      { status: 'retry', retryAfterMs: 2500 },
    );
  } finally {
    if (previousEnabled === undefined)
      delete process.env.DISCORD_PUBLICATIONS_ENABLED;
    else process.env.DISCORD_PUBLICATIONS_ENABLED = previousEnabled;
    if (previousWebhook === undefined)
      delete process.env.DISCORD_WEBHOOK_RELEASES;
    else process.env.DISCORD_WEBHOOK_RELEASES = previousWebhook;
  }
});
