import 'server-only';
import { appOrigin } from '@/lib/orders/access';

const SNOWFLAKE = /^\d{15,25}$/;
const DISCORD_API = 'https://discord.com/api/v10';
const CALLBACK_PATH = '/api/discord/callback';

export type DiscordAccountErrorCode =
  'configuration' | 'authorization' | 'not_member' | 'unavailable';

export class DiscordAccountError extends Error {
  constructor(readonly code: DiscordAccountErrorCode) {
    super(code);
  }
}

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new DiscordAccountError('configuration');
  return value;
}

function snowflake(name: string) {
  const value = required(name);
  if (!SNOWFLAKE.test(value)) throw new DiscordAccountError('configuration');
  return value;
}

function config() {
  return {
    clientId: snowflake('DISCORD_CLIENT_ID'),
    clientSecret: required('DISCORD_CLIENT_SECRET'),
    botToken: required('DISCORD_BOT_TOKEN'),
    guildId: snowflake('DISCORD_GUILD_ID'),
    linkedRoleId: snowflake('DISCORD_LINKED_ROLE_ID'),
  };
}

export function discordAccountConfigured() {
  try {
    config();
    return true;
  } catch {
    return false;
  }
}

export function discordCallbackUrl() {
  return `${appOrigin()}${CALLBACK_PATH}`;
}

export function discordAuthorizationUrl(state: string) {
  if (!/^[a-f0-9]{64}$/.test(state))
    throw new DiscordAccountError('authorization');
  const url = new URL('https://discord.com/oauth2/authorize');
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: config().clientId,
    redirect_uri: discordCallbackUrl(),
    scope: 'identify',
    state,
    prompt: 'consent',
  }).toString();
  return url.toString();
}

async function request(
  url: string,
  init: RequestInit,
  fetcher: typeof fetch = fetch,
) {
  try {
    return await fetcher(url, {
      ...init,
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    throw new DiscordAccountError('unavailable');
  }
}

export async function exchangeDiscordCode(
  code: string,
  fetcher: typeof fetch = fetch,
) {
  if (!code || code.length > 2048)
    throw new DiscordAccountError('authorization');
  const settings = config();
  const response = await request(
    `${DISCORD_API}/oauth2/token`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${settings.clientId}:${settings.clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: discordCallbackUrl(),
      }),
    },
    fetcher,
  );
  if (!response.ok) {
    throw new DiscordAccountError(
      response.status >= 500 || response.status === 429
        ? 'unavailable'
        : 'authorization',
    );
  }
  const body: unknown = await response.json().catch(() => null);
  if (
    !body ||
    typeof body !== 'object' ||
    !('access_token' in body) ||
    typeof body.access_token !== 'string' ||
    !body.access_token ||
    !('token_type' in body) ||
    body.token_type !== 'Bearer' ||
    !('scope' in body) ||
    typeof body.scope !== 'string' ||
    !body.scope.split(' ').includes('identify')
  )
    throw new DiscordAccountError('authorization');
  return body.access_token;
}

export async function getDiscordIdentity(
  accessToken: string,
  fetcher: typeof fetch = fetch,
) {
  const response = await request(
    `${DISCORD_API}/users/@me`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
    fetcher,
  );
  if (!response.ok) throw new DiscordAccountError('unavailable');
  const body: unknown = await response.json().catch(() => null);
  if (
    !body ||
    typeof body !== 'object' ||
    !('id' in body) ||
    typeof body.id !== 'string' ||
    !SNOWFLAKE.test(body.id)
  )
    throw new DiscordAccountError('unavailable');
  const name =
    'global_name' in body && typeof body.global_name === 'string'
      ? body.global_name
      : 'username' in body && typeof body.username === 'string'
        ? body.username
        : 'Compte Discord';
  return { id: body.id, displayName: name.slice(0, 80) };
}

export async function revokeDiscordToken(
  accessToken: string,
  fetcher: typeof fetch = fetch,
) {
  try {
    const settings = config();
    await request(
      `${DISCORD_API}/oauth2/token/revoke`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${settings.clientId}:${settings.clientSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ token: accessToken }),
      },
      fetcher,
    );
  } catch {
    // The short-lived token is never stored; revocation is best effort.
  }
}

async function botRequest(
  path: string,
  method: 'GET' | 'PUT' | 'DELETE',
  fetcher: typeof fetch,
) {
  const token = config().botToken;
  return request(
    `${DISCORD_API}${path}`,
    { method, headers: { Authorization: `Bot ${token}` } },
    fetcher,
  );
}

/** Fixed guild and role: callers cannot choose a Discord target or permission. */
export async function hasDiscordGuildMember(
  discordUserId: string,
  fetcher: typeof fetch = fetch,
) {
  if (!SNOWFLAKE.test(discordUserId))
    throw new DiscordAccountError('authorization');
  const { guildId } = config();
  const response = await botRequest(
    `/guilds/${guildId}/members/${discordUserId}`,
    'GET',
    fetcher,
  );
  if (response.status === 404) return false;
  if (!response.ok) throw new DiscordAccountError('unavailable');
  return true;
}

export async function changeDiscordLinkedRole(
  discordUserId: string,
  grant: boolean,
  fetcher: typeof fetch = fetch,
) {
  if (!SNOWFLAKE.test(discordUserId))
    throw new DiscordAccountError('authorization');
  const { guildId, linkedRoleId } = config();
  const response = await botRequest(
    `/guilds/${guildId}/members/${discordUserId}/roles/${linkedRoleId}`,
    grant ? 'PUT' : 'DELETE',
    fetcher,
  );
  if (response.status === 404 && !grant) return;
  if (response.status !== 204) throw new DiscordAccountError('unavailable');
}
