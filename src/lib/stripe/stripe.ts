import 'server-only';
import Stripe from 'stripe';
import { OrderError } from '@/lib/orders/common';

export const calderaPaymentMethods = ['card', 'paypal', 'klarna'] as const;

let client: Stripe | undefined;
export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || !/^(sk|rk)_test_/.test(key))
    throw new OrderError('Le paiement de test n’est pas encore configuré.');
  return (client ??= new Stripe(key, { maxNetworkRetries: 2, timeout: 15000 }));
}
export function assertPaymentConfiguration() {
  getStripe();
  if (
    !process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.startsWith('pk_test_') ||
    !process.env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_')
  )
    throw new OrderError('Le paiement de test n’est pas encore configuré.');
}
export function paymentReturnUrl(publicId: string) {
  const url = new URL(
    process.env.APP_URL || process.env.SITE_URL || 'http://localhost:3000',
  );
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    (url.protocol === 'http:' &&
      !['localhost', '127.0.0.1'].includes(url.hostname))
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
      automatic_payment_methods?: { enabled: true };
      allowed_payment_method_types?: Array<
        (typeof calderaPaymentMethods)[number]
      >;
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
