'use server';
import { after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/auth';
import { AdminError, id, whitelist } from '@/lib/admin/validation';
import type { AdminActionState } from '@/lib/admin/action-types';
import { retryEmail, safelyProcessEmails } from '@/lib/email/processor';
import { saveShipment, transitionFulfillment } from './service';
import {
  createMondialRelayShipment,
  syncMondialRelayTracking,
} from './mondialRelay';
function refresh(orderId: string) {
  revalidatePath(`/admin/commandes/${orderId}`);
  revalidatePath('/admin/commandes');
  revalidatePath('/admin');
  revalidatePath('/commande/[publicId]', 'page');
}
function failed(error: unknown): AdminActionState {
  return {
    success: false,
    message:
      error instanceof AdminError
        ? error.message
        : 'Action impossible. Rechargez la commande puis réessayez.',
  };
}
export async function fulfillmentAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  try {
    const order = await transitionFulfillment(admin.id, form);
    refresh(order.id);
    after(async () => {
      await safelyProcessEmails();
    });
    return { success: true, message: 'Préparation / expédition mise à jour.' };
  } catch (error) {
    return failed(error);
  }
}
export async function shipmentAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  try {
    const shipment = await saveShipment(admin.id, form);
    refresh(shipment.orderId);
    return {
      success: true,
      message: 'Brouillon d’expédition enregistré. Aucun email envoyé.',
    };
  } catch (error) {
    return failed(error);
  }
}

export async function createMondialRelayShipmentAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  try {
    whitelist(form, ['orderId']);
    const shipment = await createMondialRelayShipment(
      admin.id,
      id(form, 'orderId')!,
    );
    if (!shipment)
      throw new AdminError('Expédition Mondial Relay introuvable.');
    refresh(shipment.orderId);
    return {
      success: true,
      message: 'Expédition Mondial Relay créée. L’étiquette est disponible.',
    };
  } catch (error) {
    return failed(error);
  }
}

export async function syncMondialRelayTrackingAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  try {
    whitelist(form, ['shipmentId']);
    const shipment = await syncMondialRelayTracking(
      admin.id,
      id(form, 'shipmentId')!,
      true,
    );
    refresh(shipment.orderId);
    return { success: true, message: 'Suivi Mondial Relay synchronisé.' };
  } catch (error) {
    return failed(error);
  }
}
export async function correctTrackingAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  try {
    const shipment = await saveShipment(admin.id, form, true);
    refresh(shipment.orderId);
    return {
      success: true,
      message: 'Suivi corrigé et audité. Aucun nouvel email d’expédition.',
    };
  } catch (error) {
    return failed(error);
  }
}
export async function retryEmailAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  try {
    whitelist(form, ['emailId']);
    const orderId = await retryEmail(admin.id, id(form, 'emailId')!);
    refresh(orderId);
    after(async () => {
      await safelyProcessEmails();
    });
    return {
      success: true,
      message:
        'Email remis en attente. L’envoi dépend de la configuration email.',
    };
  } catch (error) {
    return failed(error);
  }
}
