import 'server-only';
import { createHmac } from 'node:crypto';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { nextCookies } from 'better-auth/next-js';
import { headers } from 'next/headers';
import { cache } from 'react';
import { getPrisma } from '@/lib/db/prisma';
import { appOrigin } from '@/lib/orders/access';
import { breachedPasswordCheck } from '@/lib/auth/passwordPolicy';
import { sendAccountEmail } from './emails';
import { changeDiscordLinkedRole } from '@/lib/discord/account';
import { withDiscordCustomerLock } from '@/lib/discord/lock';
import { clearAccountAttempts } from './limits';
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * After a reset: no other link stays usable, sign-in attempts start afresh
 * and the owner is told (sessions are revoked by better-auth).
 */
async function afterPasswordReset(user: { id: string; email: string }) {
  await getPrisma().customerVerification.deleteMany({
    where: { value: user.id },
  });
  await clearAccountAttempts('sign-in', user.email);
  await sendAccountEmail('password-changed', user.email);
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
      onPasswordReset: ({ user }) => afterPasswordReset(user),
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
    user: {
      modelName: 'customer',
      deleteUser: {
        enabled: true,
        // better-auth verifies the supplied password before this hook. The
        // link row itself is cascade-deleted with the customer.
        beforeDelete: async (user) => {
          await withDiscordCustomerLock(user.id, async (db) => {
            await db.discordOAuthState.deleteMany({
              where: { session: { userId: user.id } },
            });
            const link = await db.customerDiscordLink.findUnique({
              where: { customerId: user.id },
            });
            if (link) {
              await changeDiscordLinkedRole(link.discordUserId, false);
              // A failed account deletion can retry assigning the role.
              await db.customerDiscordLink.update({
                where: { customerId: user.id },
                data: { roleGrantedAt: null },
              });
            }
          });
        },
      },
    },
    account: { modelName: 'customerAccount' },
    // Only a hash of each link token is stored: a database copy opens nothing.
    verification: {
      modelName: 'customerVerification',
      storeIdentifier: 'hashed',
    },
    databaseHooks: {
      verification: {
        create: {
          // A reset link stores its account id: a new link replaces the older ones.
          after: async (verification) => {
            if (!UUID.test(verification.value)) return;
            await getPrisma().customerVerification.deleteMany({
              where: {
                value: verification.value,
                id: { not: verification.id },
              },
            });
          },
        },
      },
    },
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
    // nextCookies must stay last.
    plugins: [breachedPasswordCheck(), nextCookies()],
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
