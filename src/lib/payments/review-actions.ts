'use server';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import type { AdminActionState } from '@/lib/admin/action-types';
import { requireAdmin } from '@/lib/admin/auth';
import { AdminError, id, whitelist } from '@/lib/admin/validation';
import { invalidateCatalogCache } from '@/lib/cache/catalogCache';
import { safelyProcessEmails } from '@/lib/email/processor';
import { refundFailureLabel } from '@/lib/refunds/amounts';
import {
  approveReviewedOrder,
  checkReviewedPayment,
  refundReviewedOrder,
} from './review';

function failure(error: unknown): AdminActionState {
  if (error instanceof AdminError)
    return { success: false, message: error.message };
  console.error(
    JSON.stringify({
      scope: 'payments',
      action: 'review_failed',
      code:
        error instanceof Prisma.PrismaClientKnownRequestError
          ? error.code
          : 'UNEXPECTED',
    }),
  );
  return {
    success: false,
    message: 'Action impossible. Rechargez la commande puis réessayez.',
  };
}

function refresh(orderId: string) {
  revalidatePath(`/admin/commandes/${orderId}`);
  revalidatePath('/admin/commandes');
  revalidatePath('/admin');
  after(async () => {
    await safelyProcessEmails();
  });
}

/** Stock back: the held order becomes an ordinary paid order. */
export async function approveReviewAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  try {
    whitelist(form, ['id']);
    const orderId = id(form)!;
    await approveReviewedOrder(admin.id, orderId);
    // Units left the stock: the shop shows it at once.
    invalidateCatalogCache();
    refresh(orderId);
    return {
      success: true,
      message:
        'Commande validée : facture émise, confirmation envoyée au client. Elle est à préparer.',
    };
  } catch (error) {
    return failure(error);
  }
}

/** Not honoured: refunded in full, cancelled when Stripe confirms. */
export async function refundReviewAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  let orderId: string | undefined;
  try {
    whitelist(form, ['id', 'key']);
    orderId = id(form)!;
    const outcome = await refundReviewedOrder(
      admin.id,
      orderId,
      id(form, 'key')!,
    );
    if (outcome.status === 'FAILED' || outcome.status === 'CANCELED')
      return {
        success: false,
        message: `Stripe a refusé le remboursement (${refundFailureLabel(outcome.failureReason ?? 'REFUS_STRIPE')}). La commande reste à vérifier.`,
      };
    return {
      success: true,
      message:
        outcome.status === 'SUCCEEDED'
          ? 'Remboursement confirmé : commande annulée, le client est prévenu.'
          : 'Remboursement demandé à Stripe : la commande s’annulera à sa confirmation.',
    };
  } catch (error) {
    return failure(error);
  } finally {
    if (orderId) refresh(orderId);
  }
}

/** A lost attempt: what Stripe knows decides. */
export async function checkReviewAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  try {
    whitelist(form, ['id']);
    const orderId = id(form)!;
    const result = await checkReviewedPayment(admin.id, orderId);
    refresh(orderId);
    if (result.kind === 'paid')
      return {
        success: true,
        message:
          'Paiement trouvé et encaissé : validez la commande ou remboursez-la.',
      };
    if (result.kind === 'in_flight')
      return {
        success: false,
        message: `Le paiement est encore en cours chez Stripe (${result.status}). Réessayez plus tard.`,
      };
    invalidateCatalogCache();
    return {
      success: true,
      message:
        'Aucun paiement encaissé : la commande est annulée et sa réservation libérée.',
    };
  } catch (error) {
    return failure(error);
  }
}
