import 'server-only';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { nextCookies } from 'better-auth/next-js';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getPrisma } from '@/lib/db/prisma';

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
    },
    user: {
      modelName: 'adminUser',
      additionalFields: {
        role: { type: 'string', defaultValue: 'ADMIN', input: false },
        isActive: { type: 'boolean', defaultValue: true, input: false },
      },
    },
    account: { modelName: 'adminAccount' },
    verification: { modelName: 'adminVerification' },
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
    plugins: [nextCookies()],
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
    select: { id: true, name: true, email: true },
  });
}
export async function requireAdmin() {
  const admin = await currentAdmin();
  if (!admin) redirect('/admin/login');
  return admin;
}
