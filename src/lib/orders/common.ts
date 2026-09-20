import 'server-only';
import { Prisma } from '@/generated/prisma/client';
import { getPrisma } from '@/lib/db/prisma';
export class OrderError extends Error {}
export const STOCK_RESERVATION_TTL = 20 * 60 * 1000;
export const STORE_CURRENCY = 'EUR';
export const openOrderStatuses = [
  'PENDING_PAYMENT',
  'PAYMENT_FAILED',
  'PAYMENT_PROCESSING',
  'PAYMENT_REVIEW',
] as const;
export const orderInclude = {
  shipments: { where: { isPrimary: true }, orderBy: { createdAt: 'asc' } },
  payment: true,
  items: { orderBy: { id: 'asc' } },
  addresses: true,
  reservations: { orderBy: { variantId: 'asc' } },
  checkoutSession: {
    select: { cartId: true, cart: { select: { tokenHash: true } } },
  },
} satisfies Prisma.OrderInclude;
export type OrderRecord = Prisma.OrderGetPayload<{
  include: typeof orderInclude;
}>;
/** Prisma exposes conflicts from raw SQL through the driver adapter (P2010). */
function isTransactionConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code === 'P2034') return true;
  if (error.code !== 'P2010') return false;
  if (['40001', '40P01'].includes(String(error.meta?.code))) return true;
  const adapter = error.meta?.driverAdapterError;
  if (!adapter || typeof adapter !== 'object' || !('cause' in adapter))
    return false;
  const cause = adapter.cause;
  return Boolean(
    cause &&
    typeof cause === 'object' &&
    'kind' in cause &&
    cause.kind === 'TransactionWriteConflict',
  );
}
export async function transaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await getPrisma().$transaction(fn, {
        isolationLevel: 'Serializable',
        timeout: 15000,
      });
    } catch (error) {
      if (isTransactionConflict(error) && attempt < 4) continue;
      throw error;
    }
  }
}
/** All payment operations lock Cart → Order → variants (sorted IDs). */
export async function lockOrder(tx: Prisma.TransactionClient, orderId: string) {
  const ref = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    select: { checkoutSession: { select: { cartId: true } } },
  });
  await tx.cart.update({
    where: { id: ref.checkoutSession.cartId },
    data: { updatedAt: new Date() },
  });
  return tx.order.update({
    where: { id: orderId },
    data: { updatedAt: new Date() },
    include: orderInclude,
  });
}
export function orderLog(
  action: string,
  orderId: string,
  details: { intentId?: string; eventId?: string; status?: string } = {},
) {
  console.info(
    JSON.stringify({ scope: 'payments', action, orderId, ...details }),
  );
}
