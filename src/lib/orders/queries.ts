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
