'use server';

import { revalidatePath } from 'next/cache';
import { getCartCookie } from '@/lib/cart/cartCookie';
import { OrderError } from '@/lib/orders/common';
import { CheckoutError } from '@/lib/checkout/schemas';
import { prepareOrder } from '@/lib/orders/prepare';
import { requireOwnedOrder } from '@/lib/orders/queries';
import {
  assertPaymentConfiguration,
  paymentReturnUrl,
  stripeGateway,
} from '@/lib/stripe/stripe';
import { validateIntent } from './validation';
import { ensureIntent, paymentPreflight } from './intents';
import { cancelOrder, currentOrder } from './cancel';

const payableIntentStatuses = new Set([
  'requires_payment_method',
  'requires_action',
  'requires_confirmation',
]);

const friendly = (error: unknown) =>
  error instanceof OrderError || error instanceof CheckoutError
    ? error.message
    : 'Le paiement est momentanément indisponible. Votre tentative est conservée ; réessayez ou annulez-la.';

function retryLog(message: string) {
  if (process.env.NODE_ENV !== 'production') console.info(message);
}

function unavailable(message: string, retryable = false) {
  return {
    success: false as const,
    retryable,
    message,
  };
}

function payableResult(
  publicId: string,
  intent: Awaited<ReturnType<typeof stripeGateway.retrieve>>,
) {
  if (!intent.client_secret || !payableIntentStatuses.has(intent.status)) {
    return unavailable(
      'Ce paiement est en cours de traitement. Consultez la commande pour connaître son statut.',
    );
  }

  return {
    success: true as const,
    clientSecret: intent.client_secret,
    returnUrl: paymentReturnUrl(publicId),
    message: '',
  };
}

export async function startPaymentAction(sessionId: unknown) {
  try {
    assertPaymentConfiguration();
    const order = await prepareOrder(await getCartCookie(), sessionId);
    revalidatePath('/', 'layout');
    return {
      success: true as const,
      href: `/checkout/paiement/${order.publicId}`,
      message: '',
    };
  } catch (error) {
    return { success: false as const, message: friendly(error) };
  }
}

/**
 * Read/display only: this action never creates a new Stripe PaymentIntent.
 * Creation/recovery belongs to retryPaymentAction so a retry cannot be confused
 * with a passive status read.
 */
export async function loadPaymentAction(publicId: unknown) {
  try {
    assertPaymentConfiguration();
    const order = await requireOwnedOrder(publicId, await getCartCookie());
    await paymentPreflight(order.id);

    const intentId = order.payment?.providerPaymentIntentId;
    if (!intentId) {
      return unavailable(
        'Le paiement n’est pas encore initialisé. Réessayez pour ouvrir le formulaire sécurisé.',
        true,
      );
    }

    const intent = await stripeGateway.retrieve(intentId);
    validateIntent(order, intent);
    await paymentPreflight(order.id);

    return payableResult(order.publicId, intent);
  } catch (error) {
    return {
      success: false as const,
      retryable: true,
      message: friendly(error),
    };
  }
}

/**
 * Initializes or safely recovers the existing PaymentIntent for this order.
 *
 * Caldera currently uses Stripe Payment Element + PaymentIntents, not hosted
 * Checkout Sessions. Reusing the same idempotent PaymentIntent avoids creating
 * a second payable object for the same reserved stock.
 */
export async function retryPaymentAction(publicId: unknown) {
  retryLog('retryPaymentAction: started');

  try {
    assertPaymentConfiguration();
    const order = await requireOwnedOrder(publicId, await getCartCookie());

    if (order.status === 'PAID')
      return unavailable('Cette commande est déjà payée.');

    if (['CANCELLED', 'EXPIRED'].includes(order.status))
      return unavailable('Cette tentative de paiement est terminée.');

    if (['PAYMENT_PROCESSING', 'PAYMENT_REVIEW'].includes(order.status))
      return unavailable(
        'Ce paiement est déjà en cours de traitement. Consultez la commande pour connaître son statut.',
      );

    if (!['PENDING_PAYMENT', 'PAYMENT_FAILED'].includes(order.status))
      return unavailable('Cette tentative ne peut plus être payée.');

    await paymentPreflight(order.id);

    if (order.payment?.providerPaymentIntentId) {
      retryLog(
        `retryPaymentAction: existing Stripe PaymentIntent ${order.payment.providerPaymentIntentId}`,
      );
    } else {
      retryLog('retryPaymentAction: creating new Stripe PaymentIntent');
    }

    const intent = await ensureIntent(order.id);
    await paymentPreflight(order.id);

    if (
      ['processing', 'succeeded', 'requires_capture'].includes(intent.status)
    ) {
      return unavailable(
        'Ce paiement est déjà en cours de traitement. Consultez la commande pour connaître son statut.',
      );
    }

    if (intent.status === 'canceled')
      return unavailable('Cette tentative Stripe a été annulée.');

    const result = payableResult(order.publicId, intent);
    if (result.success)
      retryLog(
        `retryPaymentAction: ready with Stripe PaymentIntent ${intent.id}`,
      );

    return result;
  } catch (error) {
    return {
      success: false as const,
      retryable: true,
      message: friendly(error),
    };
  }
}

export async function checkPaymentAction(publicId: unknown) {
  try {
    const order = await requireOwnedOrder(publicId, await getCartCookie());
    await paymentPreflight(order.id);
    return { success: true, message: '' };
  } catch (error) {
    return { success: false, message: friendly(error) };
  }
}

export async function cancelPaymentAction(publicId: unknown) {
  try {
    const order = await requireOwnedOrder(publicId, await getCartCookie());
    await cancelOrder(order.id);
    const current = await currentOrder(order.id);
    revalidatePath('/', 'layout');
    if (!['CANCELLED', 'EXPIRED'].includes(current.status))
      throw new OrderError(
        'Le paiement est déjà en traitement ou confirmé. Attendez sa confirmation.',
      );
    return {
      success: true,
      message: 'La tentative est annulée. Votre panier est conservé.',
    };
  } catch (error) {
    return { success: false, message: friendly(error) };
  }
}
