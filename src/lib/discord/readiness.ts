import 'server-only';
import { getStripe, stripeMode } from '@/lib/stripe/stripe';
import { siteOrigin } from '@/lib/site';
import { discordConfigured, discordEnabled } from './outbox';
import type { DiscordPublicationKind } from './publication';

/** Read-only operational check; never returns identifiers, keys or raw errors. */
export async function launchReadiness() {
  const checks = {
    stripeLive: stripeMode() === 'live',
    publishableLive:
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.startsWith('pk_live_') ??
      false,
    webhookSecretConfigured:
      process.env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_') ?? false,
    accountChargesEnabled: false,
    webhookEndpointEnabled: false,
    webhookEventsCovered: false,
    checkoutNotPaused: process.env.CHECKOUT_PAUSED !== '1',
    storeOpen: process.env.STORE_OPEN === '1',
    discordEnabled: discordEnabled(),
    discordChannelsConfigured: (
      [
        'release',
        'restock',
        'announcement',
        'campaign',
      ] as DiscordPublicationKind[]
    ).every(discordConfigured),
  };
  if (checks.stripeLive) {
    try {
      const stripe = getStripe();
      const [account, endpoints] = await Promise.all([
        stripe.accounts.retrieve(null),
        stripe.webhookEndpoints.list({ limit: 100 }),
      ]);
      checks.accountChargesEnabled = account.charges_enabled === true;
      const endpoint = endpoints.data.find(
        (e) =>
          e.url === `${siteOrigin()}/api/stripe/webhook` &&
          e.status === 'enabled' &&
          e.livemode,
      );
      checks.webhookEndpointEnabled = Boolean(endpoint);
      checks.webhookEventsCovered = Boolean(
        endpoint &&
        (endpoint.enabled_events.includes('*') ||
          [
            'payment_intent.succeeded',
            'payment_intent.payment_failed',
            'payment_intent.canceled',
            'refund.created',
            'refund.updated',
            'refund.failed',
            'charge.refund.updated',
            'payment_intent.processing',
            'payment_intent.requires_action',
          ].every((e) => (endpoint.enabled_events as string[]).includes(e))),
      );
    } catch {
      /* Closed check, no provider response in the output. */
    }
  }
  return checks;
}
