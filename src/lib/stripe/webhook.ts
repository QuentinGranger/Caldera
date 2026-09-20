import 'server-only';
import Stripe from 'stripe';
export function verifyWebhook(
  raw: string,
  signature: string,
  secret: string,
): Stripe.Event {
  return Stripe.webhooks.constructEvent(raw, signature, secret);
}
