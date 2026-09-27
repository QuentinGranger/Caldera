import 'server-only';
import Stripe from 'stripe';
import { OrderError } from '@/lib/orders/common';
let client: Stripe | undefined;
/** Mode deduced from the server key; live is only accepted by a production build. */
export function stripeMode(): 'test' | 'live' | null {
  const mode = process.env.STRIPE_SECRET_KEY?.match(
    /^(?:sk|rk)_(test|live)_/,
  )?.[1];
  if (mode === 'live' && process.env.NODE_ENV !== 'production') return null;
  return mode === 'test' || mode === 'live' ? mode : null;
}
export function getStripe() {
  if (!stripeMode())
    throw new OrderError('Le paiement n’est pas encore configuré.');
  return (client ??= new Stripe(process.env.STRIPE_SECRET_KEY!, {
    maxNetworkRetries: 2,
    timeout: 15000,
  }));
}
export function assertPaymentConfiguration() {
  // Set while the database is copied to another region (docs/migration-europe.md):
  // no new order nor payment attempt is written between the copy and the switch.
  if (process.env.CHECKOUT_PAUSED === '1')
    throw new OrderError(
      'Les commandes sont suspendues quelques minutes pour maintenance. Votre panier est conservé : réessayez un peu plus tard.',
    );
  getStripe();
  if (
    !process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.startsWith(
      `pk_${stripeMode()}_`,
    ) ||
    !process.env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_')
  )
    throw new OrderError('Le paiement n’est pas encore configuré.');
}
export function paymentReturnUrl(publicId: string) {
  const url = new URL(
    process.env.APP_URL || process.env.SITE_URL || 'http://localhost:3000',
  );
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    (url.protocol === 'http:' &&
      (stripeMode() === 'live' ||
        !['localhost', '127.0.0.1'].includes(url.hostname)))
  )
    throw new OrderError('L’adresse du site doit être configurée en HTTPS.');
  return new URL(`/commande/${publicId}`, url.origin).toString();
}
export type Intent = Pick<
  Stripe.PaymentIntent,
  | 'id'
  | 'amount'
  | 'amount_received'
  | 'currency'
  | 'metadata'
  | 'status'
  | 'livemode'
  | 'client_secret'
>;
export interface PaymentGateway {
  create(
    input: {
      amount: number;
      currency: string;
      metadata: { orderId: string; orderNumber: string };
    },
    key: string,
  ): Promise<Intent>;
  retrieve(id: string): Promise<Intent>;
  cancel(id: string): Promise<Intent>;
}
export const stripeGateway: PaymentGateway = {
  create: (input, key) =>
    getStripe().paymentIntents.create(input, { idempotencyKey: key }),
  retrieve: (id) => getStripe().paymentIntents.retrieve(id),
  cancel: (id) => getStripe().paymentIntents.cancel(id),
};
