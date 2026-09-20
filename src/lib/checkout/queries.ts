import 'server-only';
import { Prisma } from '@/generated/prisma/client';
import { getPrisma } from '@/lib/db/prisma';
import { cartSelect } from '@/lib/cart/queries';
import { cartTokenHash } from '@/lib/cart/identity';

export const checkoutInclude = {
  addresses: true,
} satisfies Prisma.CheckoutSessionInclude;
export type CheckoutRecord = Prisma.CheckoutSessionGetPayload<{
  include: typeof checkoutInclude;
}>;
export type CheckoutCart = Prisma.CartGetPayload<{ select: typeof cartSelect }>;
export async function readCheckout(
  tx: Prisma.TransactionClient,
  token: string | undefined,
) {
  const tokenHash = cartTokenHash(token);
  if (!tokenHash) return null;
  const cart = await tx.cart.findUnique({
    where: { tokenHash },
    select: cartSelect,
  });
  if (
    !cart ||
    cart.status !== 'ACTIVE' ||
    cart.expiresAt <= new Date() ||
    !cart.items.length
  )
    return null;
  const session = await tx.checkoutSession.findFirst({
    where: { cartId: cart.id, status: { not: 'COMPLETED' } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    include: checkoutInclude,
  });
  const countries = await tx.shippingCountry.findMany({
    where: { isActive: true },
    select: { code: true, name: true },
    orderBy: { name: 'asc' },
  });
  const methods = await tx.shippingMethod.findMany({
    where: { isActive: true },
    include: { countries: { select: { code: true, isActive: true } } },
    orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
  });
  return { cart, session, countries, methods };
}
export type CheckoutData = NonNullable<
  Awaited<ReturnType<typeof readCheckout>>
>;
export async function getCheckoutData(token?: string) {
  return getPrisma().$transaction((tx) => readCheckout(tx, token), {
    isolationLevel: 'RepeatableRead',
  });
}
