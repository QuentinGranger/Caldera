import { NextResponse } from 'next/server';
import {
  getDiscordIdentity,
  exchangeDiscordCode,
  revokeDiscordToken,
} from '@/lib/discord/account';
import {
  consumeDiscordOAuthState,
  discordCustomerSession,
  linkDiscordAccount,
} from '@/lib/discord/link';
import { appOrigin } from '@/lib/orders/access';

export const runtime = 'nodejs';

function finish(result: string) {
  const url = new URL('/compte/profil', appOrigin());
  url.searchParams.set('discord', result);
  const response = NextResponse.redirect(url, 303);
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = url.searchParams;
  // Reject parameter pollution; Discord returns at most one of each.
  if (
    params.getAll('state').length !== 1 ||
    params.getAll('code').length > 1 ||
    params.getAll('error').length > 1
  )
    return finish('authorization');
  const session = await discordCustomerSession();
  if (!session) return finish('session_expired');
  try {
    if (
      !(await consumeDiscordOAuthState(params.get('state'), session.sessionId))
    )
      return finish('authorization');
    if (params.has('error')) return finish('refused');
    const code = params.get('code');
    if (!code || code.length > 2048) return finish('authorization');
    const accessToken = await exchangeDiscordCode(code);
    try {
      const identity = await getDiscordIdentity(accessToken);
      const result = await linkDiscordAccount(session.customerId, identity);
      return finish(result);
    } finally {
      await revokeDiscordToken(accessToken);
    }
  } catch {
    // Never put Discord errors, tokens or OAuth codes in logs or URLs.
    return finish('unavailable');
  }
}
