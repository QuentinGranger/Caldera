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
} from '@/lib/stripe/stripe';
import { ensureIntent, paymentPreflight } from './intents';
import { cancelOrder, currentOrder } from './cancel';
const friendly = (error: unknown) =>
  error instanceof OrderError || error instanceof CheckoutError
    ? error.message
    : 'Le paiement est momentanément indisponible. Votre tentative est conservée ; réessayez ou annulez-la.';
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
export async function loadPaymentAction(publicId: unknown) {
  try {
    assertPaymentConfiguration();
    const order = await requireOwnedOrder(publicId, await getCartCookie());
    await paymentPreflight(order.id);
    const intent = await ensureIntent(order.id);
    await paymentPreflight(order.id); // Cancellation/expiry could have raced the network call.
    if (
      !intent.client_secret ||
      ![
        'requires_payment_method',
        'requires_action',
        'requires_confirmation',
      ].includes(intent.status)
    )
      throw new OrderError(
        'Ce paiement est en cours de traitement. Consultez la commande pour connaître son statut.',
      );
    return {
      success: true as const,
      clientSecret: intent.client_secret,
      returnUrl: paymentReturnUrl(order.publicId),
      message: '',
    };
  } catch (error) {
    return { success: false as const, message: friendly(error) };
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
