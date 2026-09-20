import 'server-only';
import { verifyOrderAccess } from './access';
import { getPrisma } from '@/lib/db/prisma';
import { cartTokenHash } from '@/lib/cart/identity';
import { OrderError, orderInclude } from './common';

export async function getOwnedOrder(
  publicId: unknown,
  token: string | undefined,
) {
  const hash = cartTokenHash(token);
  if (typeof publicId !== 'string' || !/^[a-f0-9]{64}$/.test(publicId) || !hash)
    return null;

  return getPrisma().order.findFirst({
    where: { publicId, checkoutSession: { cart: { tokenHash: hash } } },
    include: orderInclude,
  });
}

export async function requireOwnedOrder(
  publicId: unknown,
  token: string | undefined,
) {
  const order = await getOwnedOrder(publicId, token);
  if (!order) throw new OrderError('Commande introuvable dans ce navigateur.');
  return order;
}

export async function getActiveOrder(token: string | undefined) {
  const hash = cartTokenHash(token);
  if (!hash) return null;

  return getPrisma().order.findFirst({
    where: {
      checkoutSession: { cart: { tokenHash: hash } },
      status: {
        in: [
          'PENDING_PAYMENT',
          'PAYMENT_FAILED',
          'PAYMENT_PROCESSING',
          'PAYMENT_REVIEW',
        ],
      },
    },
    select: { publicId: true },
  });
}

/**
 * Used before starting/synchronizing checkout to clean up an expired payment
 * reservation safely. Stripe state is resolved outside the checkout transaction.
 */
export async function getActiveOrderForCheckoutRecovery(
  token: string | undefined,
) {
  const hash = cartTokenHash(token);
  if (!hash) return null;

  return getPrisma().order.findFirst({
    where: {
      checkoutSession: { cart: { tokenHash: hash } },
      status: {
        in: [
          'PENDING_PAYMENT',
          'PAYMENT_FAILED',
          'PAYMENT_PROCESSING',
          'PAYMENT_REVIEW',
        ],
      },
    },
    select: {
      id: true,
      publicId: true,
      status: true,
      reservations: {
        select: {
          status: true,
          expiresAt: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/** Email links grant read-only access; payment mutations still require the guest cart cookie. */
export async function getCustomerOrder(
  publicId: string,
  token: string | undefined,
  access: unknown,
) {
  const owned = await getOwnedOrder(publicId, token);
  if (owned) return owned;
  if (!verifyOrderAccess(publicId, access)) return null;

  return getPrisma().order.findFirst({
    where: { publicId, status: 'PAID', payment: { status: 'SUCCEEDED' } },
    include: orderInclude,
  });
}
