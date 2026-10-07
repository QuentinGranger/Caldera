'use server';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { Prisma, type ReturnReason } from '@/generated/prisma/client';
import type { AdminActionState } from '@/lib/admin/action-types';
import { requireAdmin } from '@/lib/admin/auth';
import {
  AdminError,
  checked,
  choice,
  id,
  money,
  text,
  whitelist,
} from '@/lib/admin/validation';
import { invalidateCatalogCache } from '@/lib/cache/catalogCache';
import { safelyProcessEmails } from '@/lib/email/processor';
import { shipmentFields } from '@/lib/fulfillment/service';
import {
  deleteReturnPhotoFiles,
  MAX_RETURN_PHOTOS,
  photoFiles,
  ReturnPhotoError,
  storeReturnPhotos,
} from './photos';
import { toCents } from '@/lib/refunds/amounts';
import { returnReasonLabels } from './rules';
import {
  addReturnPhotos,
  approveReturn,
  cancelReturn,
  createAdminReturn,
  receiveReturn,
  refundReturn,
  rejectReturn,
  replaceReturn,
  saveReturnNote,
} from './service';

const QUANTITY_FIELD =
  /^qty:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

function failure(error: unknown): AdminActionState {
  if (error instanceof AdminError || error instanceof ReturnPhotoError)
    return { success: false, message: error.message };
  console.error(
    JSON.stringify({
      scope: 'returns',
      action: 'admin_mutation_failed',
      code:
        error instanceof Prisma.PrismaClientKnownRequestError
          ? error.code
          : 'UNEXPECTED',
    }),
  );
  return {
    success: false,
    message: 'Action impossible. Rechargez la page puis réessayez.',
  };
}

function refresh(returnId: string, orderId?: string) {
  revalidatePath('/admin/retours');
  revalidatePath(`/admin/retours/${returnId}`);
  if (orderId) revalidatePath(`/admin/commandes/${orderId}`);
  // The customer's answer (accepted, refused) leaves after the response.
  after(async () => {
    await safelyProcessEmails();
  });
}

async function simple(
  form: FormData,
  run: (adminId: string, returnId: string) => Promise<{ orderId: string }>,
  message: string,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  try {
    whitelist(form, ['id']);
    const returnId = id(form)!;
    const updated = await run(admin.id, returnId);
    refresh(returnId, updated.orderId);
    return { success: true, message };
  } catch (error) {
    return failure(error);
  }
}

export async function approveReturnAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  try {
    whitelist(form, ['id', 'resolution']);
    const returnId = id(form)!;
    const updated = await approveReturn(
      admin.id,
      returnId,
      text(form, 'resolution', 2000, false),
    );
    refresh(returnId, updated.orderId);
    return {
      success: true,
      message: 'Retour accepté : les instructions partent par e-mail.',
    };
  } catch (error) {
    return failure(error);
  }
}

export async function rejectReturnAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  try {
    whitelist(form, ['id', 'resolution']);
    const returnId = id(form)!;
    const updated = await rejectReturn(
      admin.id,
      returnId,
      text(form, 'resolution', 2000, false),
    );
    refresh(returnId, updated.orderId);
    return { success: true, message: 'Retour refusé : le client est prévenu.' };
  } catch (error) {
    return failure(error);
  }
}

export async function receiveReturnAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  try {
    whitelist(form, ['id', 'notify']);
    const returnId = id(form)!;
    const notify = checked(form, 'notify');
    const updated = await receiveReturn(admin.id, returnId, notify);
    refresh(returnId, updated.orderId);
    return {
      success: true,
      message: notify
        ? 'Colis marqué comme reçu : le client est prévenu.'
        : 'Colis marqué comme reçu.',
    };
  } catch (error) {
    return failure(error);
  }
}

/** New items instead of a refund: stock, parcel and the customer's e-mail. */
export async function replaceReturnAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  try {
    whitelist(form, [
      'id',
      'carrierCode',
      'carrierName',
      'hasTracking',
      'trackingNumber',
      'trackingUrl',
      'message',
    ]);
    const returnId = id(form)!;
    const updated = await replaceReturn(admin.id, returnId, {
      shipment: shipmentFields(form),
      message: text(form, 'message', 2000, false),
    });
    // Units left the stock: the shop shows it at once.
    invalidateCatalogCache();
    revalidatePath('/admin/stocks');
    refresh(returnId, updated.orderId);
    return {
      success: true,
      message:
        'Remplacement enregistré : stock mis à jour, le client reçoit le suivi par e-mail.',
    };
  } catch (error) {
    return failure(error);
  }
}

/** Photos the customer sent by e-mail, joined to the return's file. */
export async function addReturnPhotosAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  let stored: string[] = [];
  try {
    whitelist(form, ['id', 'photos']);
    const returnId = id(form)!;
    const files = photoFiles(form);
    if (!files.length) throw new AdminError('Choisissez au moins une photo.');
    if (files.length > MAX_RETURN_PHOTOS)
      throw new AdminError(`${MAX_RETURN_PHOTOS} photos au plus.`);
    stored = await storeReturnPhotos(files);
    const updated = await addReturnPhotos(admin.id, returnId, stored);
    stored = [];
    refresh(returnId, updated.orderId);
    return {
      success: true,
      message: `${files.length} photo${files.length > 1 ? 's' : ''} ajoutée${files.length > 1 ? 's' : ''}.`,
    };
  } catch (error) {
    await deleteReturnPhotoFiles(stored);
    return failure(error);
  }
}

export async function cancelReturnAction(
  _previous: AdminActionState,
  form: FormData,
) {
  return simple(form, cancelReturn, 'Retour clos.');
}

export async function saveReturnNoteAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  try {
    whitelist(form, ['id', 'note']);
    const returnId = id(form)!;
    await saveReturnNote(admin.id, returnId, text(form, 'note', 2000, false));
    refresh(returnId);
    return { success: true, message: 'Note enregistrée.' };
  } catch (error) {
    return failure(error);
  }
}

export async function refundReturnAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  let returnId = '';
  try {
    whitelist(form, ['id', 'key', 'shipping', 'amount', 'restock', 'note']);
    returnId = id(form)!;
    const amount = money(form, 'amount', true);
    const outcome = await refundReturn(admin.id, {
      returnId,
      idempotencyKey: id(form, 'key')!,
      includeShipping: checked(form, 'shipping'),
      amountCents: amount ? toCents(amount.toFixed(2)) : null,
      restock: checked(form, 'restock'),
      note: text(form, 'note', 1000, false),
    });
    const euros = outcome.amount.replace('.', ',');
    if (outcome.status === 'SUCCEEDED')
      return {
        success: true,
        message: `Remboursement de ${euros} € effectué : le retour est clos et le client prévenu.`,
      };
    if (outcome.status === 'FAILED' || outcome.status === 'CANCELED')
      return {
        success: false,
        message: `Stripe a refusé le remboursement (${outcome.failureReason ?? 'sans motif'}). Voir la commande pour le détail.`,
      };
    return {
      success: true,
      message: outcome.sent
        ? `Remboursement de ${euros} € transmis à Stripe : le retour sera clos à sa confirmation.`
        : 'Stripe n’a pas répondu : la demande est conservée et sera vérifiée automatiquement. Ne la refaites pas.',
    };
  } catch (error) {
    return failure(error);
  } finally {
    if (returnId) {
      refresh(returnId);
      revalidatePath('/admin/commandes', 'layout');
    }
  }
}

export async function createReturnAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  try {
    const items = [];
    for (const [key, value] of form.entries()) {
      if (key.startsWith('$ACTION_')) continue;
      const match = QUANTITY_FIELD.exec(key);
      if (match) {
        if (typeof value !== 'string' || !/^\d{1,3}$/.test(value.trim() || '0'))
          throw new AdminError('Quantité invalide.');
        items.push({
          orderItemId: match[1]!,
          quantity: Number(value.trim() || 0),
        });
      } else if (!['orderId', 'reason', 'message', 'notify'].includes(key))
        throw new AdminError(`Champ non autorisé : ${key.slice(0, 50)}.`);
    }
    const orderId = id(form, 'orderId')!;
    const request = await createAdminReturn(
      admin.id,
      {
        orderId,
        reason: choice(
          form,
          'reason',
          Object.keys(returnReasonLabels) as ReturnReason[],
        ),
        items,
        message: text(form, 'message', 2000, false),
      },
      checked(form, 'notify'),
    );
    refresh(request.id, orderId);
    return {
      success: true,
      message: `Retour ${request.number} créé.`,
      redirectTo: `/admin/retours/${request.id}`,
    };
  } catch (error) {
    return failure(error);
  }
}
