'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getPrisma } from '@/lib/db/prisma';
import type { AdminActionState } from './action-types';
import { getAdminAuth, requireAdmin } from './auth';
import { audit } from './common';
import { allowAdminMfaAttempt } from './login';
import { whitelist } from './validation';

export type EnrollmentState = AdminActionState & {
  totpURI?: string;
  backupCodes?: string[];
};

function passwordFrom(form: FormData) {
  const password = form.get('password');
  return typeof password === 'string' &&
    password.length >= 12 &&
    password.length <= 128
    ? password
    : null;
}

export async function startMfaEnrollmentAction(
  _previous: EnrollmentState,
  form: FormData,
): Promise<EnrollmentState> {
  const admin = await requireAdmin({ allowMfaEnrollment: true });
  if (admin.twoFactorEnabled)
    return {
      success: false,
      message: 'La double authentification est déjà active.',
    };
  try {
    if (!(await allowAdminMfaAttempt(admin.id, 'enable')))
      throw new Error('Rate limit');
    whitelist(form, ['password']);
    const password = passwordFrom(form);
    if (!password) throw new Error('Invalid password');
    const result = await getAdminAuth().api.enableTwoFactor({
      body: { password, method: 'totp' },
      headers: await headers(),
    });
    if (result.method !== 'totp') throw new Error('TOTP unavailable');
    return {
      success: true,
      message:
        'Ajoutez ce compte à votre application d’authentification, puis vérifiez un code.',
      totpURI: result.totpURI,
      backupCodes: result.backupCodes,
    };
  } catch {
    return {
      success: false,
      message:
        'Configuration impossible. Vérifiez votre mot de passe et réessayez.',
    };
  }
}

export async function verifyMfaEnrollmentAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin({ allowMfaEnrollment: true });
  if (admin.twoFactorEnabled) redirect('/admin');
  try {
    if (!(await allowAdminMfaAttempt(admin.id, 'verify')))
      throw new Error('Rate limit');
    whitelist(form, ['code', 'backupSaved']);
    const code = form.get('code');
    if (
      typeof code !== 'string' ||
      !/^\d{6}$/.test(code.trim()) ||
      form.get('backupSaved') !== 'on'
    )
      throw new Error('Invalid enrollment');
    const db = getPrisma();
    const previousSessions = await db.adminSession.findMany({
      where: { userId: admin.id },
      select: { id: true },
    });
    await getAdminAuth().api.verifyTOTP({
      body: { code: code.trim(), trustDevice: false },
      headers: await headers(),
    });
    // Better Auth replaces the enrollment session. Its verification response
    // can still contain the old token, so retain the newly created session.
    const newSessions = await db.adminSession.findMany({
      where: {
        userId: admin.id,
        id: { notIn: previousSessions.map((session) => session.id) },
      },
      select: { id: true },
    });
    if (newSessions.length !== 1)
      throw new Error('MFA session rotation failed');
    await db.adminSession.deleteMany({
      where: { userId: admin.id, id: { not: newSessions[0]!.id } },
    });
    await audit(
      getPrisma(),
      admin.id,
      'ADMIN_MFA_ENABLED',
      'AdminUser',
      admin.id,
    );
  } catch {
    return {
      success: false,
      message:
        'Code invalide ou expiré. Enregistrez vos codes de secours puis réessayez.',
    };
  }
  redirect('/admin');
}

async function completeSecondFactor(
  form: FormData,
  mode: 'totp' | 'backup',
): Promise<AdminActionState> {
  try {
    whitelist(form, ['code']);
    const value = form.get('code');
    if (typeof value !== 'string') throw new Error('Invalid code');
    const code = value.trim();
    if (
      (mode === 'totp' && !/^\d{6}$/.test(code)) ||
      (mode === 'backup' && !/^[A-Za-z0-9-]{8,32}$/.test(code))
    )
      throw new Error('Invalid code');
    const auth = getAdminAuth();
    const result =
      mode === 'totp'
        ? await auth.api.verifyTOTP({
            body: { code, trustDevice: false },
            headers: await headers(),
          })
        : await auth.api.verifyBackupCode({
            body: { code, trustDevice: false, disableSession: false },
            headers: await headers(),
          });
    const admin = await getPrisma().adminUser.findFirst({
      where: {
        id: result.user.id,
        isActive: true,
        role: 'ADMIN',
        twoFactorEnabled: true,
      },
      select: { id: true },
    });
    if (!admin) throw new Error('Inactive admin');
    await getPrisma().adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });
  } catch {
    return {
      success: false,
      message:
        'Code invalide, expiré ou trop de tentatives. Recommencez la connexion si nécessaire.',
    };
  }
  redirect('/admin');
}

export async function verifyAdminTotpAction(
  _previous: AdminActionState,
  form: FormData,
) {
  return completeSecondFactor(form, 'totp');
}

export async function verifyAdminBackupCodeAction(
  _previous: AdminActionState,
  form: FormData,
) {
  return completeSecondFactor(form, 'backup');
}

export async function regenerateBackupCodesAction(
  _previous: EnrollmentState,
  form: FormData,
): Promise<EnrollmentState> {
  const admin = await requireAdmin();
  try {
    if (!(await allowAdminMfaAttempt(admin.id, 'regenerate')))
      throw new Error('Rate limit');
    whitelist(form, ['password']);
    const password = passwordFrom(form);
    if (!password) throw new Error('Invalid password');
    const result = await getAdminAuth().api.generateBackupCodes({
      body: { password },
      headers: await headers(),
    });
    await audit(
      getPrisma(),
      admin.id,
      'ADMIN_MFA_BACKUP_CODES_REGENERATED',
      'AdminUser',
      admin.id,
    );
    return {
      success: true,
      message:
        'Ces nouveaux codes remplacent tous les anciens. Conservez-les hors ligne.',
      backupCodes: result.backupCodes,
    };
  } catch {
    return {
      success: false,
      message:
        'Impossible de renouveler les codes. Vérifiez votre mot de passe.',
    };
  }
}

export async function replaceAuthenticatorAction(
  _previous: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  try {
    if (!(await allowAdminMfaAttempt(admin.id, 'replace')))
      throw new Error('Rate limit');
    whitelist(form, ['password']);
    const password = passwordFrom(form);
    if (!password) throw new Error('Invalid password');
    await getAdminAuth().api.disableTwoFactor({
      body: { password },
      headers: await headers(),
    });
    await audit(
      getPrisma(),
      admin.id,
      'ADMIN_MFA_AUTHENTICATOR_REPLACEMENT',
      'AdminUser',
      admin.id,
    );
    // All old sessions must be reauthenticated and enroll a new authenticator.
    await getPrisma().adminSession.deleteMany({ where: { userId: admin.id } });
  } catch {
    return {
      success: false,
      message: 'Remplacement impossible. Vérifiez votre mot de passe.',
    };
  }
  redirect('/admin/login');
}
