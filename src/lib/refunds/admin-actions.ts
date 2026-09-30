'use server';
import { revalidatePath } from 'next/cache';
import type { RefundReason } from '@/generated/prisma/client';
import type { AdminActionState } from '@/lib/admin/action-types';
import { requireAdmin } from '@/lib/admin/auth';
import {
  AdminError,
  checked,
  choice,
  id,
  money,
  text,
} from '@/lib/admin/validation';
import { refundReasonLabels, toCents } from './amounts';
import { requestRefund, syncRefunds } from './service';

const QUANTITY_FIELD =
  /^qty:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
const FIELDS = ['id', 'key', 'reason', 'note', 'amount', 'shipping', 'restock'];

/** Stripe codes an administrator can act on, in plain French. */
function failureMessage(code: string | null) {
  switch (code) {
    case 'PERMISSION_STRIPE_MANQUANTE':
      return 'La clé Stripe du site n’a pas le droit de rembourser : ajoutez la permission « Refunds : écriture » à la clé restreinte dans le Dashboard Stripe, puis refaites la demande.';
    case 'STRIPE_NON_CONFIGURE':
      return 'Stripe n’est pas configuré sur ce serveur : aucun remboursement n’a été envoyé.';
    case 'charge_already_refunded':
      return 'Stripe indique que ce paiement est déjà entièrement remboursé.';
    case 'balance_insufficient':
      return 'Le solde Stripe est insuffisant pour ce remboursement.';
    case 'amount_too_large':
      return 'Stripe refuse ce montant : il dépasse ce qui reste remboursable côté Stripe.';
    case 'charge_disputed':
      return 'Ce paiement fait l’objet d’un litige : répondez au litige dans le Dashboard Stripe.';
    case 'VERIFICATION_STRIPE_REQUISE':
      return 'Stripe n’a jamais confirmé ce remboursement : vérifiez-le dans le Dashboard Stripe.';
    default:
      return `Stripe a refusé le remboursement${code ? ` (code ${code})` : ''}.`;
  }
}

function parseForm(form: FormData) {
  const lines: { orderItemId: string; quantity: number }[] = [];
  for (const [key, value] of form.entries()) {
    if (key.startsWith('$ACTION_')) continue;
    const match = QUANTITY_FIELD.exec(key);
    if (match) {
      if (typeof value !== 'string' || !/^\d{1,4}$/.test(value.trim() || '0'))
        throw new AdminError('Quantité à rembourser invalide.');
      lines.push({
        orderItemId: match[1]!,
        quantity: Number(value.trim() || 0),
      });
    } else if (!FIELDS.includes(key))
      throw new AdminError(`Champ non autorisé : ${key.slice(0, 50)}.`);
  }
  const amount = money(form, 'amount', true);
  return {
    orderId: id(form)!,
    idempotencyKey: id(form, 'key')!,
    lines,
    includeShipping: checked(form, 'shipping'),
    amountCents: amount ? toCents(amount.toFixed(2)) : null,
    reason: choice(
      form,
      'reason',
      Object.keys(refundReasonLabels) as RefundReason[],
    ),
    note: text(form, 'note', 1000, false),
    restock: checked(form, 'restock'),
  };
}

export async function refundOrderAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  let orderId = '';
  try {
    const request = parseForm(form);
    orderId = request.orderId;
    const outcome = await requestRefund(admin.id, request);
    const amount = outcome.amount.replace('.', ',');
    if (outcome.status === 'SUCCEEDED')
      return {
        success: true,
        message: `Remboursement de ${amount} € effectué. Le client est prévenu par e-mail.`,
      };
    if (outcome.status === 'FAILED' || outcome.status === 'CANCELED')
      return { success: false, message: failureMessage(outcome.failureReason) };
    if (!outcome.sent)
      return {
        success: false,
        message:
          'Stripe n’a pas répondu. La demande est conservée et sera vérifiée automatiquement dans quelques minutes : ne la refaites pas.',
      };
    return {
      success: true,
      message: `Remboursement de ${amount} € transmis à Stripe : il sera confirmé dans quelques instants.`,
    };
  } catch (error) {
    if (error instanceof AdminError)
      return { success: false, message: error.message };
    console.error(
      JSON.stringify({
        scope: 'refunds',
        action: 'request_failed',
        code: 'UNEXPECTED',
      }),
    );
    return {
      success: false,
      message:
        'Remboursement impossible pour le moment. Rechargez la commande avant de réessayer.',
    };
  } finally {
    if (orderId) {
      revalidatePath(`/admin/commandes/${orderId}`);
      revalidatePath('/admin/commandes');
    }
  }
}

export async function syncOrderRefundsAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  await requireAdmin();
  try {
    const orderId = id(form)!;
    const result = await syncRefunds({ orderId, limit: 20 });
    revalidatePath(`/admin/commandes/${orderId}`);
    return result.failed
      ? {
          success: false,
          message:
            'Stripe n’a pas pu être joint pour certains remboursements. Réessayez dans quelques minutes.',
        }
      : { success: true, message: 'Remboursements synchronisés avec Stripe.' };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof AdminError
          ? error.message
          : 'Synchronisation impossible pour le moment.',
    };
  }
}
