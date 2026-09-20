import 'server-only';

import { getOwnedOrder } from '@/lib/orders/queries';
import { stripeGateway } from '@/lib/stripe/stripe';
import { reconcilePaymentIntent } from './events';

const syncableStatuses = new Set([
  'PENDING_PAYMENT',
  'PAYMENT_FAILED',
  'PAYMENT_PROCESSING',
]);

export async function reconcileOwnedOrder(
  publicId: string,
  token: string | undefined,
  options: { force?: boolean; minIntervalMs?: number } = {},
) {
  let order = await getOwnedOrder(publicId, token);
  if (!order) return null;

  if (
    !syncableStatuses.has(order.status) ||
    !order.payment?.providerPaymentIntentId
  ) {
    return order;
  }

  const minIntervalMs = options.minIntervalMs ?? 5000;

  if (
    !options.force &&
    Date.now() - order.updatedAt.getTime() < minIntervalMs
  ) {
    return order;
  }

  try {
    const intent = await stripeGateway.retrieve(
      order.payment.providerPaymentIntentId,
    );
    await reconcilePaymentIntent(intent);
    order = await getOwnedOrder(publicId, token);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error(
        JSON.stringify({
          scope: 'payments',
          action: 'stripe_reconciliation_failed',
          publicId,
          message: error instanceof Error ? error.message : 'unknown',
        }),
      );
    }
  }

  return order;
}
