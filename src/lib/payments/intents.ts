import 'server-only';
import { getPrisma } from '@/lib/db/prisma';
import {
  lockOrder,
  orderInclude,
  OrderError,
  orderLog,
  transaction,
} from '@/lib/orders/common';
import {
  calderaPaymentMethods,
  stripeGateway,
  type PaymentGateway,
} from '@/lib/stripe/stripe';
import { toStripeAmount } from '@/lib/stripe/amount';
import { validateIntent } from './validation';

/** Persist the attempt BEFORE network I/O. Every recovery replays the same parameters/key. */
export async function ensureIntent(
  orderId: string,
  gateway: PaymentGateway = stripeGateway,
) {
  const order = await transaction(async (tx) => {
    const row = await lockOrder(tx, orderId);
    if (row.payment?.providerPaymentIntentId) return row;
    if (!['PENDING_PAYMENT', 'PAYMENT_FAILED'].includes(row.status))
      throw new OrderError('Cette tentative ne peut plus être payée.');
    if (!row.payment) throw new OrderError('Paiement introuvable.');
    if (
      row.payment.intentStartedAt &&
      Date.now() - row.payment.intentStartedAt.getTime() > 23 * 60 * 60 * 1000
    ) {
      // Stripe may prune idempotency keys after 24 h. Never risk creating a second intent.
      await tx.order.update({
        where: { id: row.id },
        data: { status: 'PAYMENT_REVIEW' },
      });
      return null;
    }
    if (!row.payment.intentStartedAt)
      await tx.payment.update({
        where: { orderId },
        data: { intentStartedAt: new Date() },
      });
    return row;
  });
  if (!order) {
    orderLog('intent_recovery_requires_review', orderId);
    throw new OrderError('Ce paiement nécessite une vérification.');
  }
  const storedId = order.payment!.providerPaymentIntentId;
  const intent = storedId
    ? await gateway.retrieve(storedId)
    : await gateway.create(
        {
          amount: toStripeAmount(order.totalAmount),
          currency: order.currency.toLowerCase(),
          metadata: { orderId: order.id, orderNumber: order.orderNumber },
          automatic_payment_methods: { enabled: true },
          // Apple Pay et Google Pay sont des wallets de carte : Stripe les
          // propose lorsque le navigateur, le domaine et le client sont éligibles.
          allowed_payment_method_types: [...calderaPaymentMethods],
        },
        `caldera:order:${order.id}:v1`,
      );
  validateIntent(order, intent);
  await transaction(async (tx) => {
    const current = await lockOrder(tx, orderId);
    validateIntent(current, intent);
    if (!current.payment!.providerPaymentIntentId)
      await tx.payment.update({
        where: { orderId },
        data: { providerPaymentIntentId: intent.id },
      });
  });
  return intent;
}
export async function paymentPreflight(orderId: string) {
  const order = await getPrisma().order.findUniqueOrThrow({
    where: { id: orderId },
    include: orderInclude,
  });
  if (
    !['PENDING_PAYMENT', 'PAYMENT_FAILED'].includes(order.status) ||
    !order.reservations.length ||
    order.reservations.some(
      (r) => r.status !== 'ACTIVE' || r.expiresAt <= new Date(),
    )
  )
    throw new OrderError(
      'Cette réservation n’est plus payable. Consultez la commande ou annulez la tentative pour recommencer.',
    );
  return order;
}
