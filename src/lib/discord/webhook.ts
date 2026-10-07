import 'server-only';
import { appOrigin } from '@/lib/orders/access';
import {
  renderDiscordPublication,
  type DiscordPublication,
  type DiscordPublicationKind,
} from './publication';

export const webhookVariables: Record<DiscordPublicationKind, string> = {
  release: 'DISCORD_WEBHOOK_RELEASES',
  restock: 'DISCORD_WEBHOOK_RESTOCKS',
  announcement: 'DISCORD_WEBHOOK_ANNOUNCEMENTS',
  campaign: 'DISCORD_WEBHOOK_CAMPAIGNS',
};

/** Reject unexpected hosts, credentials, fragments and URL suffixes (SSRF guard). */
export function discordWebhookUrl(value: string | undefined): URL | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'discord.com' ||
      url.port ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !/^\/api\/webhooks\/\d{15,25}\/[A-Za-z0-9_-]{30,}$/.test(url.pathname)
    )
      return null;
    return url;
  } catch {
    return null;
  }
}

export type DiscordDeliveryResult =
  | { status: 'disabled' }
  | { status: 'sent'; messageId: string }
  | { status: 'retry'; retryAfterMs: number | null }
  | { status: 'review' }
  | { status: 'rejected' };

/**
 * Transport boundary: the transactional outbox owns deduplication and retries.
 */
export async function sendDiscordPublication(
  publication: DiscordPublication,
  options: { fetcher?: typeof fetch; origin?: string } = {},
): Promise<DiscordDeliveryResult> {
  if (process.env.DISCORD_PUBLICATIONS_ENABLED !== 'true')
    return { status: 'disabled' };

  const webhook = discordWebhookUrl(
    process.env[webhookVariables[publication.kind]],
  );
  if (!webhook) throw new Error('DISCORD_WEBHOOK_NOT_CONFIGURED');

  const payload = renderDiscordPublication(
    publication,
    options.origin ?? appOrigin(),
  );
  webhook.searchParams.set('wait', 'true');

  try {
    const response = await (options.fetcher ?? fetch)(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (response.status === 429) {
      const seconds = Number(response.headers.get('retry-after'));
      return {
        status: 'retry',
        retryAfterMs:
          Number.isFinite(seconds) && seconds > 0
            ? Math.ceil(seconds * 1000)
            : null,
      };
    }
    if (response.status >= 500) return { status: 'review' };
    if (!response.ok) return { status: 'rejected' };
    const data: unknown = await response.json();
    if (
      typeof data !== 'object' ||
      data === null ||
      !('id' in data) ||
      typeof data.id !== 'string' ||
      !/^\d{15,25}$/.test(data.id)
    )
      return { status: 'review' };
    return { status: 'sent', messageId: data.id };
  } catch {
    // Discord may have accepted the message: never retry an uncertain send blindly.
    return { status: 'review' };
  }
}
