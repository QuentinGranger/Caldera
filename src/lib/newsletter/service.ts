import 'server-only';

import { randomCustomerToken } from '@/lib/auth/customer/crypto';
import { getPrisma } from '@/lib/db/prisma';

const EMAIL = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;

export class NewsletterValidationError extends Error {}

export type NewsletterSubscription = {
  id: string;
  email: string;
  consentAt: Date;
  unsubscribeToken: string;
};

export async function subscribeToNewsletter(
  rawEmail: string,
): Promise<{ subscription: NewsletterSubscription; activated: boolean }> {
  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 254)
    throw new NewsletterValidationError('Saisissez une adresse email valide.');

  const existing = await getPrisma().newsletterSubscriber.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      status: true,
      consentAt: true,
      unsubscribeToken: true,
    },
  });

  if (existing?.status === 'ACTIVE') {
    return { subscription: existing, activated: false };
  }

  const consentAt = new Date();
  const unsubscribeToken = randomCustomerToken().raw;
  const subscription = await getPrisma().newsletterSubscriber.upsert({
    where: { email },
    create: {
      email,
      consentAt,
      unsubscribeToken,
      status: 'ACTIVE',
      source: 'homepage',
    },
    update: {
      consentAt,
      unsubscribeToken,
      status: 'ACTIVE',
      source: 'homepage',
      unsubscribedAt: null,
    },
    select: {
      id: true,
      email: true,
      consentAt: true,
      unsubscribeToken: true,
    },
  });

  return { subscription, activated: true };
}

export async function unsubscribeFromNewsletter(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return false;

  const result = await getPrisma().newsletterSubscriber.updateMany({
    where: { unsubscribeToken: token, status: 'ACTIVE' },
    data: { status: 'UNSUBSCRIBED', unsubscribedAt: new Date() },
  });

  if (result.count) return true;

  return Boolean(
    await getPrisma().newsletterSubscriber.findUnique({
      where: { unsubscribeToken: token },
      select: { id: true },
    }),
  );
}
