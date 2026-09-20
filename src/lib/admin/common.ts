import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { transaction } from '@/lib/orders/common';
import { AdminError } from './validation';
export async function adminTransaction<T>(
  adminId: string,
  run: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  return transaction(async (tx) => {
    const admin = await tx.adminUser.findFirst({
      where: { id: adminId, isActive: true, role: 'ADMIN' },
      select: { id: true },
    });
    if (!admin) throw new AdminError('Session administrateur invalide.');
    return run(tx);
  });
}
export function audit(
  tx: Prisma.TransactionClient,
  adminUserId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Prisma.InputJsonObject = {},
) {
  return tx.adminAuditLog.create({
    data: { adminUserId, action, entityType, entityId, metadata },
  });
}
export async function lockProduct(
  tx: Prisma.TransactionClient,
  productId: string,
) {
  await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${productId}::uuid FOR UPDATE`;
  const product = await tx.product.findUnique({ where: { id: productId } });
  if (!product) throw new AdminError('Produit introuvable.');
  return product;
}
