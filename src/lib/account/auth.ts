import 'server-only';
import { createHmac } from 'node:crypto';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { nextCookies } from 'better-auth/next-js';
import { headers } from 'next/headers';
import { cache } from 'react';
import { getPrisma } from '@/lib/db/prisma';
import { appOrigin } from '@/lib/orders/access';
import { sendAccountEmail } from './emails';
import { PASSWORD_MAX, PASSWORD_MIN } from './validation';

/** Distinct from the administration's « caldera_admin » cookies. */
export const CUSTOMER_COOKIE_PREFIX = 'caldera_client';
const SESSION_SECONDS = 30 * 86400;

// Derived from BETTER_AUTH_SECRET: no new variable to manage, yet a customer
// token (session, e-mail link) can never be replayed against the admin.
function customerSecret() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32)
    throw new Error('Configuration des comptes indisponible.');
  return createHmac('sha256', secret)
    .update('caldera:customer-accounts')
    .digest('hex');
}

function createCustomerAuth() {
  return betterAuth({
    appName: 'Les Terres de Caldera',
    secret: customerSecret(),
    baseURL: appOrigin(),
    database: prismaAdapter(getPrisma(), { provider: 'postgresql' }),
    emailAndPassword: {
      enabled: true,
      // Also makes sign-up answer the same way for a taken address.
      requireEmailVerification: true,
      minPasswordLength: PASSWORD_MIN,
      maxPasswordLength: PASSWORD_MAX,
      resetPasswordTokenExpiresIn: 3600,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: ({ user, token }) =>
        sendAccountEmail('reset', user.email, token),
      onExistingUserSignUp: ({ user }) =>
        sendAccountEmail('existing', user.email),
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      expiresIn: 24 * 3600,
      sendVerificationEmail: ({ user, token }) =>
        sendAccountEmail('verify', user.email, token),
    },
    user: { modelName: 'customer', deleteUser: { enabled: true } },
    account: { modelName: 'customerAccount' },
    verification: { modelName: 'customerVerification' },
    session: {
      modelName: 'customerSession',
      expiresIn: SESSION_SECONDS,
      updateAge: 86400,
      cookieCache: { enabled: false },
    },
    advanced: {
      cookiePrefix: CUSTOMER_COOKIE_PREFIX,
      database: { generateId: 'uuid' },
      // Attempts are limited in src/lib/account/limits.ts; no IP is stored.
      ipAddress: { disableIpTracking: true },
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      },
    },
    plugins: [nextCookies()],
    logger: { disabled: true },
  });
}

let auth: ReturnType<typeof createCustomerAuth> | undefined;
export function getCustomerAuth() {
  return (auth ??= createCustomerAuth());
}

export type CurrentCustomer = {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
};

/** Signed-in customer of this request, or null (also when accounts are not configured). */
export const currentCustomer = cache(
  async (): Promise<CurrentCustomer | null> => {
    try {
      const session = await getCustomerAuth().api.getSession({
        headers: await headers(),
      });
      if (!session) return null;
      const { id, email, name, emailVerified } = session.user;
      return { id, email, name, emailVerified };
    } catch {
      return null;
    }
  },
);
