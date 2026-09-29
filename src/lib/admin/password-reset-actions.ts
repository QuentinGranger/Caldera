'use server';
import { isAPIError } from 'better-auth/api';
import { redirect } from 'next/navigation';
import {
  BREACH_CHECK_UNAVAILABLE,
  COMPROMISED_MESSAGE,
  isBreachedPassword,
} from '@/lib/auth/passwordPolicy';
import type { AdminActionState } from './action-types';
import { getAdminAuth } from './auth';
import { allowAdminPasswordReset } from './login';
import { AdminError, text, whitelist } from './validation';

const GENERIC =
  'Si cette adresse correspond à un compte administrateur actif, un lien valable une heure vient d’être envoyé. Seul le dernier lien reçu fonctionne.';

const code = (error: unknown) =>
  isAPIError(error)
    ? (error.body as { code?: string } | undefined)?.code
    : undefined;

export async function requestAdminPasswordResetAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  try {
    whitelist(form, ['email']);
    const email = text(form, 'email', 254).toLowerCase();
    if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(email))
      return { success: false, message: 'Indiquez une adresse e-mail valide.' };
    if (await allowAdminPasswordReset(email))
      await getAdminAuth().api.requestPasswordReset({ body: { email } });
  } catch {
    // The same answer prevents account enumeration and provider disclosure.
  }
  return { success: true, message: GENERIC };
}

export async function resetAdminPasswordAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  try {
    whitelist(form, ['token', 'password', 'confirmation']);
    const token = text(form, 'token', 2000, false);
    const password = form.get('password');
    const confirmation = form.get('confirmation');
    if (
      typeof password !== 'string' ||
      password.length < 12 ||
      password.length > 128
    )
      return {
        success: false,
        message: 'Choisissez un mot de passe de 12 à 128 caractères.',
      };
    if (confirmation !== password)
      return {
        success: false,
        message: 'Les deux mots de passe ne sont pas identiques.',
      };
    if (!token)
      return {
        success: false,
        message:
          'Ce lien est incomplet. Demandez un nouveau lien de réinitialisation.',
      };
    // Checked before the link is used: better-auth consumes it first.
    let breached: boolean;
    try {
      breached = await isBreachedPassword(password);
    } catch {
      return { success: false, message: BREACH_CHECK_UNAVAILABLE };
    }
    if (breached) return { success: false, message: COMPROMISED_MESSAGE };
    await getAdminAuth().api.resetPassword({
      body: { token, newPassword: password },
    });
  } catch (error) {
    if (error instanceof AdminError)
      return { success: false, message: error.message };
    if (code(error) === 'INVALID_TOKEN')
      return {
        success: false,
        message:
          'Ce lien a expiré, a déjà servi ou a été remplacé par un plus récent. Demandez un nouveau lien de réinitialisation.',
      };
    console.error(
      JSON.stringify({
        scope: 'admin',
        action: 'password_reset_failed',
        code: code(error) ?? 'UNEXPECTED',
      }),
    );
    return {
      success: false,
      message:
        'Le mot de passe n’a pas pu être enregistré. Réessayez, ou demandez un nouveau lien si celui-ci ne fonctionne plus.',
    };
  }
  redirect('/admin/login?mot-de-passe=modifie');
}
