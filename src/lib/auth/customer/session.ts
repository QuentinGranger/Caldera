import 'server-only';
import { headers, cookies } from 'next/headers';
import { getPrisma } from '@/lib/db/prisma';
import { hashCustomerToken, randomCustomerToken } from './crypto';

export const CUSTOMER_SESSION_COOKIE = 'caldera_customer_session';
const SESSION_LIFETIME_SECONDS = 30 * 24 * 60 * 60;

const customerSelect = {
  id: true,
  email: true,
  emailVerifiedAt: true,
  firstName: true,
  lastName: true,
  phone: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
} as const;

export type CustomerView = {
  id: string;
  email: string;
  emailVerifiedAt: Date | null;
  firstName: string;
  lastName: string;
  phone: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
};

export async function getCurrentCustomer(): Promise<CustomerView | null> {
  let raw: string | undefined;
  try {
    raw = (await cookies()).get(CUSTOMER_SESSION_COOKIE)?.value;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('outside a request scope')
    )
      return null;
    throw error;
  }
  if (!raw || !/^[a-f0-9]{64}$/.test(raw)) return null;
  const session = await getPrisma().customerSession.findUnique({
    where: { tokenHash: hashCustomerToken(raw) },
    select: { customer: { select: customerSelect }, expiresAt: true },
  });
  if (
    !session ||
    session.expiresAt <= new Date() ||
    !session.customer.isActive
  ) {
    if (session)
      await getPrisma().customerSession.deleteMany({
        where: { tokenHash: hashCustomerToken(raw) },
      });
    return null;
  }
  return session.customer;
}

export async function requireCustomer() {
  const customer = await getCurrentCustomer();
  if (!customer) {
    const { redirect } = await import('next/navigation');
    redirect('/connexion?next=/compte');
    throw new Error('Redirection client interrompue.');
  }
  return customer;
}

export async function createCustomerSession(customerId: string) {
  const { raw, hash } = randomCustomerToken();
  const requestHeaders = await headers();
  await getPrisma().customerSession.create({
    data: {
      customerId,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + SESSION_LIFETIME_SECONDS * 1000),
      ipAddress:
        requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: requestHeaders.get('user-agent')?.slice(0, 500) ?? null,
    },
  });
  (await cookies()).set(CUSTOMER_SESSION_COOKIE, raw, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_LIFETIME_SECONDS,
  });
}

export async function destroyCustomerSession() {
  const jar = await cookies();
  const raw = jar.get(CUSTOMER_SESSION_COOKIE)?.value;
  if (raw && /^[a-f0-9]{64}$/.test(raw))
    await getPrisma().customerSession.deleteMany({
      where: { tokenHash: hashCustomerToken(raw) },
    });
  jar.delete(CUSTOMER_SESSION_COOKIE);
}

export async function destroyOtherCustomerSessions(customerId: string) {
  const raw = (await cookies()).get(CUSTOMER_SESSION_COOKIE)?.value;
  await getPrisma().customerSession.deleteMany({
    where: {
      customerId,
      ...(raw ? { NOT: { tokenHash: hashCustomerToken(raw) } } : {}),
    },
  });
}
