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
import { reconcilePaymentIntent } from './events';

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

function cancelLog(message: string) {
  if (process.env.NODE_ENV !== 'production') console.info(message);
}

function unavailable(
  message: string,
  retryable = false,
  cancelable = true,
) {
  return {
    success: false as const,
    retryable,
    cancelable,
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
      false,
      false,
    );
  }

  return {
    success: true as const,
    cancelable: true,
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
      cancelable: true,
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
      return {
        ...unavailable('Cette commande est déjà payée.', false, false),
        terminal: true as const,
        href: `/commande/${order.publicId}`,
      };

    if (['CANCELLED', 'EXPIRED'].includes(order.status))
      return {
        ...unavailable(
          'Cette tentative de paiement est terminée.',
          false,
          false,
        ),
        terminal: true as const,
        href: '/checkout',
      };

    if (['PAYMENT_PROCESSING', 'PAYMENT_REVIEW'].includes(order.status))
      return {
        ...unavailable(
          'Ce paiement est déjà en cours de traitement. Consultez la commande pour connaître son statut.',
          false,
          false,
        ),
        terminal: true as const,
        href: `/commande/${order.publicId}`,
      };

    if (!['PENDING_PAYMENT', 'PAYMENT_FAILED'].includes(order.status))
      return unavailable(
        'Cette tentative ne peut plus être payée.',
        false,
        false,
      );

    await paymentPreflight(order.id);

    if (order.payment?.providerPaymentIntentId) {
      retryLog(
        `retryPaymentAction: existing Stripe PaymentIntent ${order.payment.providerPaymentIntentId}`,
      );
    } else {
      retryLog('retryPaymentAction: creating new Stripe PaymentIntent');
    }

    const intent = await ensureIntent(order.id);

    if (
      ['processing', 'succeeded', 'requires_capture', 'canceled'].includes(
        intent.status,
      )
    ) {
      retryLog(
        `retryPaymentAction: reconciling Stripe PaymentIntent ${intent.id} (${intent.status})`,
      );

      await reconcilePaymentIntent(intent);
      const current = await currentOrder(order.id);
      revalidatePath('/', 'layout');

      if (['CANCELLED', 'EXPIRED'].includes(current.status)) {
        return {
          ...unavailable(
            'Cette tentative Stripe est terminée. Votre panier peut être repris.',
            false,
            false,
          ),
          terminal: true as const,
          href: '/checkout',
        };
      }

      const message =
        current.status === 'PAID'
          ? 'Paiement confirmé. Votre commande est maintenant synchronisée.'
          : current.status === 'PAYMENT_REVIEW'
            ? 'Le paiement a été reçu mais nécessite une vérification.'
            : 'Le paiement est en cours de traitement chez Stripe.';

      return {
        ...unavailable(message, false, false),
        terminal: true as const,
        href: `/commande/${order.publicId}`,
      };
    }

    await paymentPreflight(order.id);

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
      cancelable: true,
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
  cancelLog('cancelPaymentAction: started');

  try {
    const order = await requireOwnedOrder(publicId, await getCartCookie());

    if (order.payment?.providerPaymentIntentId) {
      cancelLog(
        `cancelPaymentAction: existing Stripe PaymentIntent ${order.payment.providerPaymentIntentId}`,
      );
    }

    const outcome = await cancelOrder(order.id);
    let current = await currentOrder(order.id);
    revalidatePath('/', 'layout');

    if (outcome.kind === 'cancelled') {
      cancelLog('cancelPaymentAction: cancelled');
      return {
        success: true as const,
        href: '/checkout',
        message: 'La tentative est annulée. Votre panier est conservé.',
      };
    }

    if (outcome.kind === 'in_flight') {
      cancelLog(
        `cancelPaymentAction: cannot cancel Stripe PaymentIntent with status ${outcome.intentStatus}`,
      );

      if (order.payment?.providerPaymentIntentId) {
        const intent = await stripeGateway.retrieve(
          order.payment.providerPaymentIntentId,
        );
        await reconcilePaymentIntent(intent);
        current = await currentOrder(order.id);
        revalidatePath('/', 'layout');
      }

      const message =
        current.status === 'PAID'
          ? 'Le paiement a déjà été confirmé par Stripe. La commande est maintenant synchronisée.'
          : current.status === 'PAYMENT_PROCESSING'
            ? 'Le paiement est en cours de traitement chez Stripe. La commande est maintenant synchronisée.'
            : current.status === 'PAYMENT_REVIEW'
              ? 'Le paiement nécessite une vérification avant toute autre action.'
              : 'Le paiement ne peut plus être annulé depuis cette page. Consultez la commande.';

      return {
        success: false as const,
        terminal: true,
        href: `/commande/${order.publicId}`,
        message,
      };
    }

    if (
      outcome.kind === 'already_terminal' ||
      ['PAID', 'PAYMENT_REVIEW'].includes(current.status)
    ) {
      cancelLog(
        `cancelPaymentAction: order already terminal with status ${current.status}`,
      );
      return {
        success: false as const,
        terminal: true,
        href: `/commande/${order.publicId}`,
        message:
          current.status === 'PAID'
            ? 'Cette commande est déjà payée et ne peut plus être annulée depuis cette page.'
            : 'Cette commande nécessite une vérification avant toute annulation.',
      };
    }

    if (['CANCELLED', 'EXPIRED'].includes(current.status)) {
      cancelLog('cancelPaymentAction: already cancelled');
      return {
        success: true as const,
        href: '/checkout',
        message: 'La tentative est déjà annulée. Votre panier est conservé.',
      };
    }

    return {
      success: false as const,
      terminal: false,
      message:
        'L’annulation n’a pas pu être confirmée. Réessayez dans quelques instants.',
    };
  } catch (error) {
    return {
      success: false as const,
      terminal: false,
      message: friendly(error),
    };
  }
}
