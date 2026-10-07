'use server';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import type { ReturnReason } from '@/generated/prisma/client';
import { allowAccountAttempt } from '@/lib/account/limits';
import { safelyProcessEmails } from '@/lib/email/processor';
import { getCartCookie } from '@/lib/cart/cartCookie';
import { getCustomerOrder } from '@/lib/orders/queries';
import { returnReasonLabels } from './rules';
import { requestReturn, requestWithdrawal, ReturnError } from './service';

export type ReturnFormState = {
  success: boolean;
  message: string;
  number?: string;
};

const QUANTITY_FIELD =
  /^qty:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
const REASONS = Object.keys(returnReasonLabels) as ReturnReason[];

function field(form: FormData, name: string, max: number) {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/** The acknowledgment and the shop's notice leave after the response. */
function sendSoon() {
  after(async () => {
    await safelyProcessEmails();
  });
}

function failure(error: unknown): ReturnFormState {
  if (error instanceof ReturnError)
    return { success: false, message: error.message };
  console.error(JSON.stringify({ scope: 'returns', action: 'request_failed' }));
  return {
    success: false,
    message:
      'Votre demande n’a pas pu être enregistrée. Réessayez, ou écrivez à contact@lesterresdecaldera.fr : un e-mail suffit pour vous rétracter.',
  };
}

/** From the order page (cart cookie or signed e-mail link). */
export async function requestReturnAction(
  _previous: ReturnFormState,
  form: FormData,
): Promise<ReturnFormState> {
  try {
    const publicId = field(form, 'publicId', 64);
    const order = await getCustomerOrder(
      publicId,
      await getCartCookie(),
      field(form, 'access', 200),
    );
    if (!order || order.status !== 'PAID')
      return { success: false, message: 'Commande introuvable.' };
    if (!(await allowAccountAttempt('return', order.id)))
      return {
        success: false,
        message:
          'Trop de demandes pour cette commande. Réessayez dans une heure.',
      };
    const reason = REASONS.find((value) => value === field(form, 'reason', 20));
    if (!reason) return { success: false, message: 'Choisissez un motif.' };
    const items = [];
    for (const [key, value] of form.entries()) {
      const match = QUANTITY_FIELD.exec(key);
      if (!match) continue;
      if (typeof value !== 'string' || !/^\d{1,2}$/.test(value.trim() || '0'))
        return { success: false, message: 'Quantité invalide.' };
      items.push({
        orderItemId: match[1]!,
        quantity: Number(value.trim() || 0),
      });
    }
    const request = await requestReturn({
      orderId: order.id,
      reason,
      items,
      message: field(form, 'message', 2000),
    });
    revalidatePath(`/commande/${publicId}`);
    sendSoon();
    return {
      success: true,
      number: request.number,
      message:
        reason === 'WITHDRAWAL'
          ? `Votre rétractation n° ${request.number} est enregistrée. L’accusé de réception part à ${order.email}.`
          : `Votre demande n° ${request.number} est enregistrée. Nous revenons vers vous par e-mail à ${order.email}.`,
    };
  } catch (error) {
    return failure(error);
  }
}

/** Public withdrawal form: order number and e-mail identify the order. */
export async function withdrawalAction(
  _previous: ReturnFormState,
  form: FormData,
): Promise<ReturnFormState> {
  try {
    const orderNumber = field(form, 'orderNumber', 40).toUpperCase();
    const email = field(form, 'email', 254).toLowerCase();
    if (!/^CAL-\d{4}-[0-9A-F]{20}$/.test(orderNumber))
      return {
        success: false,
        message:
          'Numéro de commande invalide : il commence par « CAL- » (voir votre e-mail de confirmation).',
      };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return { success: false, message: 'Adresse e-mail invalide.' };
    if (!(await allowAccountAttempt('return', email)))
      return {
        success: false,
        message: 'Trop de tentatives. Réessayez dans une heure.',
      };
    const request = await requestWithdrawal(
      orderNumber,
      email,
      field(form, 'message', 2000),
    );
    sendSoon();
    return {
      success: true,
      number: request.number,
      message: `Votre rétractation n° ${request.number} est enregistrée pour toute la commande ${orderNumber}. L’accusé de réception part à l’adresse e-mail de la commande.`,
    };
  } catch (error) {
    return failure(error);
  }
}
