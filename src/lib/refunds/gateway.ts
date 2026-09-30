import 'server-only';
import Stripe from 'stripe';
import { OrderError } from '@/lib/orders/common';
import { getStripe } from '@/lib/stripe/stripe';

/** The fields of a Stripe Refund this shop relies on. */
export type ProviderRefund = {
  id: string;
  amount: number;
  currency: string;
  status: string | null;
  paymentIntentId: string | null;
  metadata: Record<string, string>;
  failureReason: string | null;
};

/**
 * `definitive`: Stripe refused (nothing was refunded, retrying will not help);
 * otherwise the outcome is unknown and the same idempotency key is retried.
 */
export class RefundProviderError extends Error {
  constructor(
    public readonly code: string,
    public readonly definitive: boolean,
  ) {
    super(code);
  }
}

export interface RefundGateway {
  create(
    input: {
      paymentIntent: string;
      amount: number;
      reason: 'duplicate' | 'fraudulent' | 'requested_by_customer';
      metadata: Record<string, string>;
    },
    idempotencyKey: string,
  ): Promise<ProviderRefund>;
  retrieve(id: string): Promise<ProviderRefund>;
}

function toProvider(refund: Stripe.Refund): ProviderRefund {
  return {
    id: refund.id,
    amount: refund.amount,
    currency: refund.currency,
    status: refund.status,
    paymentIntentId:
      typeof refund.payment_intent === 'string'
        ? refund.payment_intent
        : (refund.payment_intent?.id ?? null),
    metadata: refund.metadata ?? {},
    failureReason: refund.failure_reason ?? null,
  };
}

function classify(error: unknown): RefundProviderError {
  if (error instanceof Stripe.errors.StripeError) {
    // Network, Stripe outage, rate limit, or the same key still in flight
    // (409, a double click): the refund may exist or not yet.
    const transient =
      error instanceof Stripe.errors.StripeConnectionError ||
      error instanceof Stripe.errors.StripeAPIError ||
      error instanceof Stripe.errors.StripeRateLimitError ||
      error.statusCode === 409 ||
      error.code === 'lock_timeout';
    const code =
      error instanceof Stripe.errors.StripePermissionError
        ? 'PERMISSION_STRIPE_MANQUANTE'
        : error instanceof Stripe.errors.StripeAuthenticationError
          ? 'AUTHENTIFICATION_STRIPE'
          : (error.code ?? error.type ?? 'STRIPE_ERROR').toString();
    return new RefundProviderError(code.slice(0, 64), !transient);
  }
  if (error instanceof RefundProviderError) return error;
  // No usable key on this server: nothing was sent.
  if (error instanceof OrderError)
    return new RefundProviderError('STRIPE_NON_CONFIGURE', true);
  return new RefundProviderError('STRIPE_INJOIGNABLE', false);
}

export const stripeRefundGateway: RefundGateway = {
  async create(input, idempotencyKey) {
    try {
      return toProvider(
        await getStripe().refunds.create(
          {
            payment_intent: input.paymentIntent,
            amount: input.amount,
            reason: input.reason,
            metadata: input.metadata,
          },
          { idempotencyKey },
        ),
      );
    } catch (error) {
      throw classify(error);
    }
  },
  async retrieve(id) {
    try {
      return toProvider(await getStripe().refunds.retrieve(id));
    } catch (error) {
      throw classify(error);
    }
  },
};
