import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { OrderError, type OrderRecord } from '@/lib/orders/common';
/** Caller holds the order/cart lock. A terminal reservation is never changed again. */
export async function releaseReservations(
  tx: Prisma.TransactionClient,
  order: OrderRecord,
  expired: boolean,
) {
  for (const row of order.reservations.filter((r) => r.status === 'ACTIVE')) {
    const changed =
      await tx.$executeRaw`UPDATE "ProductVariant" SET "reservedQuantity" = "reservedQuantity" - ${row.quantity}, "updatedAt" = NOW() WHERE "id" = ${row.variantId}::uuid AND "reservedQuantity" >= ${row.quantity}`;
    if (changed !== 1) throw new OrderError('Réservation incohérente.');
    await tx.stockReservation.update({
      where: { id: row.id },
      data: { status: expired ? 'EXPIRED' : 'RELEASED' },
    });
  }
}
export async function canConsume(
  tx: Prisma.TransactionClient,
  order: OrderRecord,
) {
  if (!order.items.length || order.reservations.length !== order.items.length)
    return false;
  for (const row of order.reservations) {
    const item = order.items.find((i) => i.variantId === row.variantId);
    if (row.status !== 'ACTIVE' || item?.quantity !== row.quantity)
      return false;
    const [variant] = await tx.$queryRaw<
      { stockQuantity: number; reservedQuantity: number }[]
    >`SELECT "stockQuantity", "reservedQuantity" FROM "ProductVariant" WHERE "id" = ${row.variantId}::uuid FOR UPDATE`;
    if (
      !variant ||
      variant.stockQuantity < row.quantity ||
      variant.reservedQuantity < row.quantity
    )
      return false;
  }
  // expiresAt alone does not invalidate stock: Stripe may still be processing.
  return true;
}
export async function consumeReservations(
  tx: Prisma.TransactionClient,
  order: OrderRecord,
) {
  for (const row of order.reservations) {
    const changed =
      await tx.$executeRaw`UPDATE "ProductVariant" SET "stockQuantity" = "stockQuantity" - ${row.quantity}, "reservedQuantity" = "reservedQuantity" - ${row.quantity}, "updatedAt" = NOW() WHERE "id" = ${row.variantId}::uuid AND "stockQuantity" >= ${row.quantity} AND "reservedQuantity" >= ${row.quantity}`;
    if (changed !== 1) throw new OrderError('Réservation incohérente.');
    await tx.stockReservation.update({
      where: { id: row.id },
      data: { status: 'CONSUMED' },
    });
  }
}
