'use server';
import { allowAccountAttempt } from '@/lib/account/limits';
import { after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/auth';
import { AdminError } from '@/lib/admin/validation';
import type { AdminActionState } from '@/lib/admin/action-types';
import { saveDiscordDraft, manageDiscordPublication } from './admin';
import { safelyProcessDiscordOutbox } from './outbox';

export async function saveDiscordDraftAction(
  _state: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  if (!(await allowAccountAttempt('discord-publish', admin.id)))
    return {
      success: false,
      message: 'Trop d’actions Discord. Réessayez dans quelques minutes.',
    };
  try {
    await saveDiscordDraft(admin.id, form);
    revalidatePath('/admin/discord');
    return {
      success: true,
      message: 'Brouillon enregistré. Relisez l’aperçu avant sa mise en file.',
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof AdminError
          ? error.message
          : 'Enregistrement impossible.',
    };
  }
}
export async function manageDiscordPublicationAction(
  _state: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  if (!(await allowAccountAttempt('discord-publish', admin.id)))
    return {
      success: false,
      message: 'Trop d’actions Discord. Réessayez dans quelques minutes.',
    };
  try {
    await manageDiscordPublication(admin.id, form);
    revalidatePath('/admin/discord');
    after(safelyProcessDiscordOutbox);
    return {
      success: true,
      message:
        'Publication mise à jour. Les envois sont traités en arrière-plan.',
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof AdminError ? error.message : 'Action impossible.',
    };
  }
}
