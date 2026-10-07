import 'server-only';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { nextCookies } from 'better-auth/next-js';
import { twoFactor } from 'better-auth/plugins';
import { headers } from 'next/headers';
import { breachedPasswordCheck } from '@/lib/auth/passwordPolicy';
import { getPrisma } from '@/lib/db/prisma';
import { audit } from './common';
import { clearAdminLoginAttempts } from './login';
import {
  sendAdminPasswordChangedEmail,
  sendAdminPasswordResetEmail,
} from './password-reset-email';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * After a reset: no other link stays usable, the sign-in lockout is lifted,
 * the change is audited and the owner is told (sessions are revoked by
 * better-auth).
 */
async function afterAdminPasswordReset(user: { id: string; email: string }) {
  const db = getPrisma();
  await db.adminVerification.deleteMany({ where: { value: user.id } });
  await clearAdminLoginAttempts(user.email);
  await audit(db, user.id, 'PASSWORD_RESET', 'AdminUser', user.id, {
    via: 'email-link',
  });
  await sendAdminPasswordChangedEmail(user.email);
}

function createAuth() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32)
    throw new Error('Configuration admin indisponible.');
  const baseURL =
    process.env.APP_URL || process.env.SITE_URL || 'http://localhost:3000';
  return betterAuth({
    appName: 'Caldera Administration',
    secret,
    baseURL,
    database: prismaAdapter(getPrisma(), { provider: 'postgresql' }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: 3600,
      revokeSessionsOnPasswordReset: true,
      // A deactivated account never receives a link (the answer stays the same).
      sendResetPassword: async ({ user, token }) => {
        const admin = user as typeof user & {
          isActive?: boolean;
          role?: string;
        };
        if (admin.isActive === false || admin.role !== 'ADMIN') return;
        await sendAdminPasswordResetEmail(user.email, token);
      },
      onPasswordReset: ({ user }) => afterAdminPasswordReset(user),
    },
    user: {
      modelName: 'adminUser',
      additionalFields: {
        role: { type: 'string', defaultValue: 'ADMIN', input: false },
        isActive: { type: 'boolean', defaultValue: true, input: false },
      },
    },
    account: { modelName: 'adminAccount' },
    // Only a hash of each link token is stored: a database copy opens nothing.
    verification: { modelName: 'adminVerification', storeIdentifier: 'hashed' },
    session: {
      modelName: 'adminSession',
      expiresIn: 8 * 60 * 60,
      disableSessionRefresh: true,
      cookieCache: { enabled: false },
    },
    advanced: {
      cookiePrefix: 'caldera_admin',
      database: { generateId: 'uuid' },
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      },
    },
    databaseHooks: {
      verification: {
        create: {
          // A reset link stores its account id: a new link replaces the older ones.
          after: async (verification) => {
            if (!UUID.test(verification.value)) return;
            await getPrisma().adminVerification.deleteMany({
              where: {
                value: verification.value,
                id: { not: verification.id },
              },
            });
          },
        },
      },
      session: {
        create: {
          before: async (session) => {
            const user = await getPrisma().adminUser.findUnique({
              where: { id: session.userId },
              select: { isActive: true, role: true },
            });
            if (!user?.isActive || user.role !== 'ADMIN') return false;
            return { data: session };
          },
        },
      },
    },
    // nextCookies must stay last.
    plugins: [
      twoFactor({
        issuer: 'Caldera Administration',
        twoFactorTable: 'adminTwoFactor',
        twoFactorCookieMaxAge: 600,
        backupCodeOptions: { storeBackupCodes: 'encrypted' },
        accountLockout: {
          enabled: true,
          maxFailedAttempts: 10,
          durationSeconds: 900,
        },
      }),
      breachedPasswordCheck(),
      nextCookies(),
    ],
    logger: { disabled: true },
  });
}
let auth: ReturnType<typeof createAuth> | undefined;
export function getAdminAuth() {
  return (auth ??= createAuth());
}
export async function currentAdmin() {
  const session = await getAdminAuth().api.getSession({
    headers: await headers(),
  });
  if (!session) return null;
  return getPrisma().adminUser.findFirst({
    where: { id: session.user.id, isActive: true, role: 'ADMIN' },
    select: { id: true, name: true, email: true, twoFactorEnabled: true },
  });
}
export async function requireAdmin(options?: { allowMfaEnrollment?: boolean }) {
  const admin = await currentAdmin();
  if (!admin) {
    // Loaded here: this module is also used outside a request (tests, scripts).
    const { redirect } = await import('next/navigation');
    return redirect('/admin/login');
  }
  if (!admin.twoFactorEnabled && !options?.allowMfaEnrollment) {
    const { redirect } = await import('next/navigation');
    return redirect('/admin/securite');
  }
  return admin;
}
