import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import {
  changeDiscordLinkedRole,
  discordAuthorizationUrl,
  exchangeDiscordCode,
  getDiscordIdentity,
  hasDiscordGuildMember,
} from '../src/lib/discord/account';

const previous = {
  APP_URL: process.env.APP_URL,
  DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET,
  DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
  DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID,
  DISCORD_LINKED_ROLE_ID: process.env.DISCORD_LINKED_ROLE_ID,
};

before(() => {
  process.env.APP_URL = 'https://lesterresdecaldera.fr';
  process.env.DISCORD_CLIENT_ID = '1557428863842128011';
  process.env.DISCORD_CLIENT_SECRET = 'server-secret-test';
  process.env.DISCORD_BOT_TOKEN = 'bot-token-test';
  process.env.DISCORD_GUILD_ID = '1557428863842128014';
  process.env.DISCORD_LINKED_ROLE_ID = '1557428863842128020';
});

after(() => {
  for (const [name, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

test('authorization requests identify only and binds the exact callback', () => {
  const state = 'a'.repeat(64);
  const url = new URL(discordAuthorizationUrl(state));
  assert.equal(url.origin, 'https://discord.com');
  assert.equal(url.searchParams.get('scope'), 'identify');
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('state'), state);
  assert.equal(
    url.searchParams.get('redirect_uri'),
    'https://lesterresdecaldera.fr/api/discord/callback',
  );
  assert.throws(() => discordAuthorizationUrl('bad-state'));
});

test('code exchange sends a form to the fixed Discord endpoint', async () => {
  const fetcher = (async (input: URL | RequestInfo, init?: RequestInit) => {
    assert.equal(String(input), 'https://discord.com/api/v10/oauth2/token');
    assert.equal(init?.method, 'POST');
    assert.equal((init?.body as URLSearchParams).get('code'), 'oauth-code');
    assert.equal(
      (init?.body as URLSearchParams).get('grant_type'),
      'authorization_code',
    );
    assert.equal(
      (init?.body as URLSearchParams).get('redirect_uri'),
      'https://lesterresdecaldera.fr/api/discord/callback',
    );
    return Response.json({
      access_token: 'short-lived',
      token_type: 'Bearer',
      scope: 'identify',
    });
  }) as typeof fetch;
  assert.equal(await exchangeDiscordCode('oauth-code', fetcher), 'short-lived');
  await assert.rejects(() => exchangeDiscordCode('x'.repeat(2049), fetcher));
});

test('identity comes from Discord and ignores email', async () => {
  const fetcher = (async (input: URL | RequestInfo, init?: RequestInit) => {
    assert.equal(String(input), 'https://discord.com/api/v10/users/@me');
    assert.equal(
      (init?.headers as Record<string, string>).Authorization,
      'Bearer short-lived',
    );
    return Response.json({
      id: '1557428863842128030',
      global_name: 'Quentin',
      email: 'ignored@example.invalid',
    });
  }) as typeof fetch;
  assert.deepEqual(await getDiscordIdentity('short-lived', fetcher), {
    id: '1557428863842128030',
    displayName: 'Quentin',
  });
});

test('membership and role calls have fixed guild/role and handle absence', async () => {
  const paths: string[] = [];
  const fetcher = (async (input: URL | RequestInfo, init?: RequestInit) => {
    paths.push(`${init?.method ?? 'GET'} ${String(input)}`);
    if (init?.method === 'GET') return new Response(null, { status: 200 });
    return new Response(null, { status: 204 });
  }) as typeof fetch;
  assert.equal(
    await hasDiscordGuildMember('1557428863842128030', fetcher),
    true,
  );
  await changeDiscordLinkedRole('1557428863842128030', true, fetcher);
  await changeDiscordLinkedRole('1557428863842128030', false, fetcher);
  assert.deepEqual(paths, [
    'GET https://discord.com/api/v10/guilds/1557428863842128014/members/1557428863842128030',
    'PUT https://discord.com/api/v10/guilds/1557428863842128014/members/1557428863842128030/roles/1557428863842128020',
    'DELETE https://discord.com/api/v10/guilds/1557428863842128014/members/1557428863842128030/roles/1557428863842128020',
  ]);
  await assert.rejects(() =>
    changeDiscordLinkedRole('../../roles/admin', true, fetcher),
  );
  const absent = (async () =>
    new Response(null, { status: 404 })) as typeof fetch;
  assert.equal(
    await hasDiscordGuildMember('1557428863842128030', absent),
    false,
  );
  await changeDiscordLinkedRole('1557428863842128030', false, absent);
});
