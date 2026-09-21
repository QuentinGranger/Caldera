'use server';

import { redirect } from 'next/navigation';
import { getPrisma } from '@/lib/db/prisma';
import {
  authenticateCustomer,
  normalizeCustomerEmail,
  registerCustomer,
  validateCustomerPassword,
} from './service';
import { destroyCustomerSession, requireCustomer } from './session';
import { attachCustomerCart } from '@/lib/customer/cart';
import {
  queueCustomerVerification,
  queueCustomerPasswordReset,
  queueCustomerEmailChange,
} from '@/lib/customer/email';
import { claimGuestOrdersForVerifiedCustomer } from '@/lib/customer/data';
import { clearCartCookie } from '@/lib/cart/cartCookie';
import {
  hashCustomerPassword,
  hashCustomerToken,
  randomCustomerToken,
  verifyCustomerPassword,
} from './crypto';

export type CustomerActionState = { success: boolean; message: string };
const ok = (message: string): CustomerActionState => ({
  success: true,
  message,
});
const fail = (message: string): CustomerActionState => ({
  success: false,
  message,
});

export async function registerCustomerAction(
  _previous: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  try {
    const password = String(formData.get('password') ?? '');
    if (password !== String(formData.get('confirmation') ?? ''))
      return fail('Les mots de passe ne correspondent pas.');
    const result = await registerCustomer({
      firstName: String(formData.get('firstName') ?? ''),
      lastName: String(formData.get('lastName') ?? ''),
      email: String(formData.get('email') ?? ''),
      password,
    });
    await attachCustomerCart(result.customerId);
    await queueCustomerVerification(
      result.customerId,
      result.verificationToken,
    );
    redirect('/compte?welcome=1');
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return fail(
      error instanceof Error ? error.message : 'Impossible de créer le compte.',
    );
  }
}

export async function loginCustomerAction(
  _previous: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  try {
    const email = String(formData.get('email') ?? '');
    const customer = await authenticateCustomer(
      email,
      String(formData.get('password') ?? ''),
    );
    if (!customer) return fail('Email ou mot de passe incorrect.');
    await attachCustomerCart(customer.id);
    redirect(safeNext(formData.get('next')));
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return fail('Impossible de vous connecter pour le moment.');
  }
}

export async function logoutCustomerAction() {
  await destroyCustomerSession();
  await clearCartCookie();
  redirect('/');
}

export async function requestPasswordResetAction(
  _previous: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  const email = normalizeCustomerEmail(String(formData.get('email') ?? ''));
  if (!email || email.length > 254)
    return ok('Si un compte existe pour cette adresse, un email a été envoyé.');
  const customer = await getPrisma().customer.findUnique({
    where: { email },
    select: { id: true, isActive: true },
  });
  if (customer?.isActive) {
    const raw = randomCustomerToken().raw;
    await getPrisma().customerAuthToken.deleteMany({
      where: { customerId: customer.id, type: 'PASSWORD_RESET' },
    });
    await getPrisma().customerAuthToken.create({
      data: {
        customerId: customer.id,
        tokenHash: hashCustomerToken(raw),
        type: 'PASSWORD_RESET',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    await queueCustomerPasswordReset(customer.id, raw);
  }
  return ok('Si un compte existe pour cette adresse, un email a été envoyé.');
}

export async function resetPasswordAction(
  _previous: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  try {
    const token = String(formData.get('token') ?? '');
    const password = String(formData.get('password') ?? '');
    const confirmation = String(formData.get('confirmation') ?? '');
    if (!/^[a-f0-9]{64}$/.test(token))
      return fail('Ce lien de réinitialisation est invalide.');
    if (password !== confirmation)
      return fail('Les mots de passe ne correspondent pas.');
    validateCustomerPassword(password);
    const row = await getPrisma().customerAuthToken.findFirst({
      where: {
        tokenHash: hashCustomerToken(token),
        type: 'PASSWORD_RESET',
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true, customerId: true },
    });
    if (!row)
      return fail('Ce lien de réinitialisation est invalide ou expiré.');
    await getPrisma().$transaction(async (tx) => {
      await tx.customer.update({
        where: { id: row.customerId },
        data: { passwordHash: await hashCustomerPassword(password) },
      });
      await tx.customerAuthToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      });
      await tx.customerSession.deleteMany({
        where: { customerId: row.customerId },
      });
    });
    redirect('/connexion?reset=1');
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return fail(
      error instanceof Error
        ? error.message
        : 'Impossible de réinitialiser le mot de passe.',
    );
  }
}

export async function verifyCustomerEmailAction(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  const row = await getPrisma().customerAuthToken.findFirst({
    where: {
      tokenHash: hashCustomerToken(token),
      type: 'EMAIL_VERIFICATION',
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true, customerId: true },
  });
  if (!row) return false;
  await getPrisma().$transaction(async (tx) => {
    await tx.customer.update({
      where: { id: row.customerId },
      data: { emailVerifiedAt: new Date() },
    });
    await tx.customerAuthToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    });
  });
  await claimGuestOrdersForVerifiedCustomer(row.customerId);
  return true;
}

export async function updateProfileAction(
  _previous: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  try {
    const customer = await requireCustomer();
    const firstName = String(formData.get('firstName') ?? '').trim();
    const lastName = String(formData.get('lastName') ?? '').trim();
    const phone = String(formData.get('phone') ?? '').trim();
    if (
      firstName.length < 2 ||
      firstName.length > 80 ||
      lastName.length < 2 ||
      lastName.length > 80
    )
      return fail('Renseignez un prénom et un nom valides.');
    if (phone.length > 32) return fail('Le numéro de téléphone est trop long.');
    const nextEmail = normalizeCustomerEmail(
      String(formData.get('email') ?? ''),
    );
    if (nextEmail !== customer.email) {
      if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(nextEmail))
        return fail('Adresse email invalide.');
      const exists = await getPrisma().customer.findFirst({
        where: { email: nextEmail, NOT: { id: customer.id } },
        select: { id: true },
      });
      if (exists) return fail('Cette adresse email est déjà utilisée.');
      const raw = randomCustomerToken().raw;
      await getPrisma().customerAuthToken.deleteMany({
        where: { customerId: customer.id, type: 'EMAIL_CHANGE' },
      });
      await getPrisma().customerAuthToken.create({
        data: {
          customerId: customer.id,
          tokenHash: hashCustomerToken(raw),
          type: 'EMAIL_CHANGE',
          email: nextEmail,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      await getPrisma().customer.update({
        where: { id: customer.id },
        data: {
          firstName,
          lastName,
          phone: phone || null,
          pendingEmail: nextEmail,
        },
      });
      await queueCustomerEmailChange(customer.id, raw, nextEmail);
      return ok(
        'Profil mis à jour. Vérifiez votre nouvelle adresse email pour la confirmer.',
      );
    }
    await getPrisma().customer.update({
      where: { id: customer.id },
      data: { firstName, lastName, phone: phone || null },
    });
    return ok('Profil mis à jour.');
  } catch {
    return fail('Impossible d’enregistrer vos modifications.');
  }
}

export async function confirmEmailChangeAction(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  const row = await getPrisma().customerAuthToken.findFirst({
    where: {
      tokenHash: hashCustomerToken(token),
      type: 'EMAIL_CHANGE',
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true, customerId: true, email: true },
  });
  const pendingEmail = row?.email;
  if (!pendingEmail) return false;
  const duplicate = await getPrisma().customer.findFirst({
    where: { email: pendingEmail, NOT: { id: row.customerId } },
    select: { id: true },
  });
  if (duplicate) return false;
  await getPrisma().$transaction(async (tx) => {
    await tx.customer.update({
      where: { id: row.customerId },
      data: {
        email: pendingEmail,
        pendingEmail: null,
        emailVerifiedAt: new Date(),
      },
    });
    await tx.customerAuthToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    });
  });
  return true;
}

export async function changePasswordAction(
  _previous: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  try {
    const customer = await requireCustomer();
    const current = String(formData.get('currentPassword') ?? '');
    const next = String(formData.get('password') ?? '');
    const confirmation = String(formData.get('confirmation') ?? '');
    const row = await getPrisma().customer.findUnique({
      where: { id: customer.id },
      select: { passwordHash: true },
    });
    if (!row || !(await verifyCustomerPassword(current, row.passwordHash)))
      return fail('Mot de passe actuel incorrect.');
    if (next !== confirmation)
      return fail('Les mots de passe ne correspondent pas.');
    validateCustomerPassword(next);
    await getPrisma().$transaction(async (tx) => {
      await tx.customer.update({
        where: { id: customer.id },
        data: { passwordHash: await hashCustomerPassword(next) },
      });
      await tx.customerSession.deleteMany({
        where: { customerId: customer.id },
      });
    });
    return ok(
      'Mot de passe modifié. Reconnectez-vous avec votre nouveau mot de passe.',
    );
  } catch {
    return fail('Impossible de modifier le mot de passe.');
  }
}

export async function deleteAccountAction(
  _previous: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  try {
    const customer = await requireCustomer();
    const password = String(formData.get('currentPassword') ?? '');
    if (String(formData.get('confirmation') ?? '') !== 'SUPPRIMER')
      return fail('Écrivez SUPPRIMER pour confirmer cette demande.');
    const row = await getPrisma().customer.findUnique({
      where: { id: customer.id },
      select: { passwordHash: true },
    });
    if (!row || !(await verifyCustomerPassword(password, row.passwordHash)))
      return fail('Mot de passe actuel incorrect.');
    const replacement = `${customer.id}@deleted.invalid`;
    await getPrisma().$transaction(async (tx) => {
      await tx.order.updateMany({
        where: { customerId: customer.id },
        data: { customerId: null },
      });
      await tx.cart.updateMany({
        where: { customerId: customer.id },
        data: { customerId: null, status: 'ABANDONED' },
      });
      await tx.customerAddress.deleteMany({
        where: { customerId: customer.id },
      });
      await tx.customerAuthToken.deleteMany({
        where: { customerId: customer.id },
      });
      await tx.customerSession.deleteMany({
        where: { customerId: customer.id },
      });
      await tx.customer.update({
        where: { id: customer.id },
        data: {
          email: replacement,
          emailVerifiedAt: null,
          passwordHash: await hashCustomerPassword(randomCustomerToken().raw),
          firstName: 'Compte',
          lastName: 'supprimé',
          phone: null,
          pendingEmail: null,
          isActive: false,
        },
      });
    });
    const { destroyCustomerSession } = await import('./session');
    await destroyCustomerSession();
    await clearCartCookie();
    return ok(
      'Votre compte a été désactivé et vos données personnelles ont été anonymisées.',
    );
  } catch {
    return fail('Impossible de supprimer le compte pour le moment.');
  }
}

function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === 'string' ? value : '/compte';
  return next.startsWith('/') && !next.startsWith('//') ? next : '/compte';
}
function isRedirectError(error: unknown) {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'digest' in error &&
    String((error as { digest?: unknown }).digest).startsWith('NEXT_REDIRECT'),
  );
}
