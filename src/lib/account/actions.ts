'use server';
import { isAPIError } from 'better-auth/api';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { CheckoutError, parseAddress } from '@/lib/checkout/schemas';
import { getPrisma } from '@/lib/db/prisma';
import {
  BREACH_CHECK_UNAVAILABLE,
  COMPROMISED_MESSAGE,
  PASSWORD_COMPROMISED,
  isBreachedPassword,
} from '@/lib/auth/passwordPolicy';
import { getCustomerAuth } from './auth';
import { sendAccountEmail } from './emails';
import { requireCustomer } from './guard';
import { allowAccountAttempt } from './limits';
import { getShippingCountries } from './queries';
import {
  ACCOUNT_PATH,
  PASSWORD_MAX,
  PASSWORD_MIN,
  SIGN_IN_PATH,
  accountEmail,
  accountName,
  accountPassword,
  safeReturnPath,
  type AccountActionState,
} from './validation';

const PASSWORD_RULE = `Choisissez un mot de passe de ${PASSWORD_MIN} à ${PASSWORD_MAX} caractères.`;
const TOO_MANY =
  'Trop de tentatives pour cette adresse. Réessayez un peu plus tard.';
const UNAVAILABLE =
  'Les comptes sont momentanément indisponibles. Réessayez dans quelques minutes.';

const code = (error: unknown) =>
  isAPIError(error)
    ? (error.body as { code?: string } | undefined)?.code
    : undefined;

function failure(
  message: string,
  errors?: Record<string, string>,
): AccountActionState {
  return { success: false, message, ...(errors ? { errors } : {}) };
}

function logUnexpected(action: string, error: unknown) {
  // A code only: messages may carry an address or a token.
  console.error(
    JSON.stringify({
      scope: 'account',
      action,
      code: code(error) ?? 'UNEXPECTED',
    }),
  );
}

export async function signUpAction(
  _previous: AccountActionState,
  form: FormData,
): Promise<AccountActionState> {
  const name = accountName(form.get('name'));
  const email = accountEmail(form.get('email'));
  const password = accountPassword(form.get('password'));
  const errors: Record<string, string> = {};
  if (!name) errors.name = 'Indiquez votre nom (80 caractères au plus).';
  if (!email) errors.email = 'Indiquez une adresse e-mail valide.';
  if (!password) errors.password = PASSWORD_RULE;
  if (!name || !email || !password)
    return failure('Vérifiez les champs indiqués.', errors);
  if (!(await allowAccountAttempt('sign-up', email))) return failure(TOO_MANY);
  try {
    // A taken address gets the same answer; its owner receives an e-mail.
    await getCustomerAuth().api.signUpEmail({
      headers: await headers(),
      body: { name, email, password },
    });
  } catch (error) {
    if (['PASSWORD_TOO_SHORT', 'PASSWORD_TOO_LONG'].includes(code(error) ?? ''))
      return failure('Vérifiez les champs indiqués.', {
        password: PASSWORD_RULE,
      });
    // Same answer for a taken address: its password goes through the check too.
    if (code(error) === PASSWORD_COMPROMISED)
      return failure('Vérifiez les champs indiqués.', {
        password: COMPROMISED_MESSAGE,
      });
    logUnexpected('sign_up_failed', error);
    return failure(UNAVAILABLE);
  }
  return {
    success: true,
    message: `Presque terminé : un lien de confirmation vient d’être envoyé à ${email}. Il est valable 24 heures. Pensez à regarder dans les indésirables.`,
  };
}

export async function signInAction(
  _previous: AccountActionState,
  form: FormData,
): Promise<AccountActionState> {
  const email = accountEmail(form.get('email'));
  const password = form.get('password');
  const destination = safeReturnPath(form.get('retour'));
  if (!email || typeof password !== 'string' || !password)
    return failure('Indiquez votre adresse e-mail et votre mot de passe.');
  if (!(await allowAccountAttempt('sign-in', email))) return failure(TOO_MANY);
  try {
    await getCustomerAuth().api.signInEmail({
      headers: await headers(),
      body: { email, password, rememberMe: true },
    });
  } catch (error) {
    if (code(error) === 'EMAIL_NOT_VERIFIED')
      return failure(
        'Confirmez d’abord votre adresse e-mail : un nouveau lien de confirmation vient de vous être envoyé.',
      );
    // A configuration or database failure is not a wrong password.
    if (!isAPIError(error)) {
      logUnexpected('sign_in_failed', error);
      return failure(UNAVAILABLE);
    }
    return failure('Adresse e-mail ou mot de passe incorrect.');
  }
  redirect(destination);
}

export async function signOutAction() {
  try {
    await getCustomerAuth().api.signOut({ headers: await headers() });
  } catch {
    // Already signed out.
  }
  redirect('/');
}

export async function requestPasswordResetAction(
  _previous: AccountActionState,
  form: FormData,
): Promise<AccountActionState> {
  const email = accountEmail(form.get('email'));
  if (!email)
    return failure('Vérifiez le champ indiqué.', {
      email: 'Indiquez une adresse e-mail valide.',
    });
  // Same answer whether the address exists, is limited or not.
  if (await allowAccountAttempt('reset', email))
    try {
      await getCustomerAuth().api.requestPasswordReset({ body: { email } });
    } catch (error) {
      logUnexpected('reset_request_failed', error);
    }
  return {
    success: true,
    message: `Si un compte existe pour ${email}, un lien pour choisir un nouveau mot de passe vient d’être envoyé. Il est valable 1 heure.`,
  };
}

export async function resetPasswordAction(
  _previous: AccountActionState,
  form: FormData,
): Promise<AccountActionState> {
  const token = form.get('token');
  const password = accountPassword(form.get('password'));
  if (typeof token !== 'string' || !token || token.length > 200)
    return failure('Ce lien n’est plus valable. Demandez-en un nouveau.');
  if (!password)
    return failure('Vérifiez le champ indiqué.', { password: PASSWORD_RULE });
  if (form.get('confirmation') !== password)
    return failure('Vérifiez le champ indiqué.', {
      confirmation: 'Les deux mots de passe ne sont pas identiques.',
    });
  // Checked before the link is used: better-auth consumes it first.
  let breached: boolean;
  try {
    breached = await isBreachedPassword(password);
  } catch {
    return failure(BREACH_CHECK_UNAVAILABLE);
  }
  if (breached)
    return failure('Vérifiez le champ indiqué.', {
      password: COMPROMISED_MESSAGE,
    });
  try {
    await getCustomerAuth().api.resetPassword({
      body: { newPassword: password, token },
    });
  } catch (error) {
    if (code(error) === 'INVALID_TOKEN')
      return failure(
        'Ce lien n’est plus valable (il sert une fois, pendant 1 heure, et seul le dernier envoyé fonctionne). Demandez-en un nouveau.',
      );
    logUnexpected('reset_failed', error);
    return failure(
      'Le mot de passe n’a pas pu être enregistré. Réessayez, ou demandez un nouveau lien si celui-ci ne fonctionne plus.',
    );
  }
  redirect(`${SIGN_IN_PATH}?mot-de-passe=modifie`);
}

export async function verifyEmailAction(
  _previous: AccountActionState,
  form: FormData,
): Promise<AccountActionState> {
  const token = form.get('token');
  if (typeof token !== 'string' || !token || token.length > 2000)
    return failure('Ce lien de confirmation n’est pas valable.');
  try {
    // Signs the customer in (autoSignInAfterVerification).
    await getCustomerAuth().api.verifyEmail({
      headers: await headers(),
      query: { token },
    });
  } catch {
    return failure(
      'Ce lien de confirmation a expiré ou a déjà servi. Demandez-en un nouveau ci-dessous, ou connectez-vous si votre adresse est déjà confirmée.',
    );
  }
  redirect(`${ACCOUNT_PATH}?bienvenue=1`);
}

export async function resendVerificationAction(
  _previous: AccountActionState,
  form: FormData,
): Promise<AccountActionState> {
  const email = accountEmail(form.get('email'));
  if (!email)
    return failure('Vérifiez le champ indiqué.', {
      email: 'Indiquez une adresse e-mail valide.',
    });
  if (await allowAccountAttempt('verify', email))
    try {
      await getCustomerAuth().api.sendVerificationEmail({ body: { email } });
    } catch (error) {
      logUnexpected('verify_resend_failed', error);
    }
  return {
    success: true,
    message: `Si un compte non confirmé existe pour ${email}, un nouveau lien vient d’être envoyé.`,
  };
}

export async function updateNameAction(
  _previous: AccountActionState,
  form: FormData,
): Promise<AccountActionState> {
  const customer = await requireCustomer();
  const name = accountName(form.get('name'));
  if (!name)
    return failure('Vérifiez le champ indiqué.', {
      name: 'Indiquez votre nom (80 caractères au plus).',
    });
  await getPrisma().customer.update({
    where: { id: customer.id },
    data: { name },
  });
  revalidatePath(ACCOUNT_PATH);
  return { success: true, message: 'Votre nom est enregistré.' };
}

/** Called from the address form with its values (same shape as the checkout). */
export async function saveAddressAction(
  value: unknown,
): Promise<AccountActionState> {
  const customer = await requireCustomer();
  try {
    const countries = (await getShippingCountries()).map(({ code }) => code);
    const address = parseAddress(value, countries);
    const data = {
      firstName: address.firstName,
      lastName: address.lastName,
      company: address.company || null,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2 || null,
      postalCode: address.postalCode,
      city: address.city,
      region: address.region || null,
      countryCode: address.countryCode,
      phone: address.phone || null,
    };
    await getPrisma().customerAddress.upsert({
      where: { customerId: customer.id },
      create: { customerId: customer.id, ...data },
      update: data,
    });
  } catch (error) {
    if (error instanceof CheckoutError)
      return failure(error.message, error.errors);
    logUnexpected('address_failed', error);
    return failure(UNAVAILABLE);
  }
  revalidatePath(ACCOUNT_PATH);
  return {
    success: true,
    message:
      'Adresse enregistrée : elle sera proposée à votre prochaine commande.',
  };
}

export async function changePasswordAction(
  _previous: AccountActionState,
  form: FormData,
): Promise<AccountActionState> {
  const customer = await requireCustomer('/compte/profil');
  const current = form.get('currentPassword');
  const password = accountPassword(form.get('password'));
  if (typeof current !== 'string' || !current)
    return failure('Vérifiez les champs indiqués.', {
      currentPassword: 'Indiquez votre mot de passe actuel.',
    });
  if (!password)
    return failure('Vérifiez les champs indiqués.', {
      password: PASSWORD_RULE,
    });
  if (form.get('confirmation') !== password)
    return failure('Vérifiez les champs indiqués.', {
      confirmation: 'Les deux mots de passe ne sont pas identiques.',
    });
  try {
    // Other devices are signed out; this one keeps a fresh session.
    await getCustomerAuth().api.changePassword({
      headers: await headers(),
      body: {
        currentPassword: current,
        newPassword: password,
        revokeOtherSessions: true,
      },
    });
  } catch (error) {
    if (code(error) === 'INVALID_PASSWORD')
      return failure('Vérifiez les champs indiqués.', {
        currentPassword: 'Mot de passe actuel incorrect.',
      });
    if (code(error) === PASSWORD_COMPROMISED)
      return failure('Vérifiez les champs indiqués.', {
        password: COMPROMISED_MESSAGE,
      });
    logUnexpected('password_change_failed', error);
    return failure(UNAVAILABLE);
  }
  // The owner is told, in case the session was not theirs.
  await sendAccountEmail('password-changed', customer.email);
  return {
    success: true,
    message: 'Mot de passe modifié. Vos autres appareils ont été déconnectés.',
  };
}

export async function deleteAccountAction(
  _previous: AccountActionState,
  form: FormData,
): Promise<AccountActionState> {
  await requireCustomer();
  const password = form.get('password');
  if (typeof password !== 'string' || !password)
    return failure('Vérifiez le champ indiqué.', {
      password: 'Indiquez votre mot de passe pour confirmer.',
    });
  try {
    // Orders stay (legal retention), detached from the deleted account.
    await getCustomerAuth().api.deleteUser({
      headers: await headers(),
      body: { password },
    });
  } catch (error) {
    if (code(error) === 'INVALID_PASSWORD')
      return failure('Vérifiez le champ indiqué.', {
        password: 'Mot de passe incorrect.',
      });
    logUnexpected('delete_failed', error);
    return failure(UNAVAILABLE);
  }
  redirect('/?compte=supprime');
}
