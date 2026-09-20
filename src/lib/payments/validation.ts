import 'server-only';
import type { Intent } from '@/lib/stripe/stripe';
import { toStripeAmount } from '@/lib/stripe/amount';
import { OrderError, type OrderRecord } from '@/lib/orders/common';
export function validateIntent(order: OrderRecord, intent: Intent) {
  if (
    !order.payment ||
    intent.livemode ||
    intent.amount !== toStripeAmount(order.totalAmount) ||
    !order.payment.amount.equals(order.totalAmount) ||
    order.payment.currency !== order.currency ||
    intent.currency !== order.currency.toLowerCase() ||
    intent.metadata.orderId !== order.id ||
    intent.metadata.orderNumber !== order.orderNumber ||
    (order.payment.providerPaymentIntentId &&
      order.payment.providerPaymentIntentId !== intent.id) ||
    (intent.status === 'succeeded' && intent.amount_received !== intent.amount)
  )
    throw new OrderError('Incohérence du paiement détectée.');
}
