import 'server-only';
import type {
  Prisma,
  InventoryAdjustmentType,
} from '@/generated/prisma/client';
import { adminTransaction, audit } from './common';
import { AdminError, choice, id, integer, text, whitelist } from './validation';
export async function changeStock(
  tx: Prisma.TransactionClient,
  adminId: string,
  variantId: string,
  input: {
    quantity: number;
    mode: 'absolute' | 'delta';
    expected?: number;
    type: InventoryAdjustmentType;
    reason: string;
  },
) {
  await tx.$queryRaw`SELECT id FROM "ProductVariant" WHERE id = ${variantId}::uuid FOR UPDATE`;
  const variant = await tx.productVariant.findUniqueOrThrow({
    where: { id: variantId },
  });
  if (input.mode === 'absolute' && input.expected !== variant.stockQuantity)
    throw new AdminError(
      'Le stock a changé depuis l’ouverture du formulaire. Rechargez la page.',
    );
  const next =
    input.mode === 'absolute'
      ? input.quantity
      : variant.stockQuantity + input.quantity;
  if (next < variant.reservedQuantity)
    throw new AdminError(
      `${variant.reservedQuantity} unités sont actuellement réservées. Le stock physique ne peut pas être inférieur à cette quantité.`,
    );
  if (!Number.isSafeInteger(next) || next < 0 || next > 1000000)
    throw new AdminError('Stock physique invalide.');
  const delta = next - variant.stockQuantity;
  if (delta === 0) return variant;
  if ((input.type === 'RESTOCK' || input.type === 'RETURN') && delta < 0)
    throw new AdminError(
      'Un réapprovisionnement ou un retour ajoute du stock.',
    );
  if ((input.type === 'DAMAGE' || input.type === 'LOSS') && delta > 0)
    throw new AdminError('Une perte ou un dommage retire du stock.');
  const updated = await tx.productVariant.update({
    where: { id: variantId },
    data: { stockQuantity: next },
  });
  await tx.inventoryAdjustment.create({
    data: {
      variantId,
      adminUserId: adminId,
      type: input.type,
      quantityDelta: delta,
      previousQuantity: variant.stockQuantity,
      newQuantity: next,
      reason: input.reason,
    },
  });
  await audit(tx, adminId, 'STOCK_ADJUSTED', 'ProductVariant', variantId, {
    previous: variant.stockQuantity,
    next,
    delta,
    type: input.type,
  });
  return updated;
}
export async function adjustStock(adminId: string, form: FormData) {
  whitelist(form, [
    'variantId',
    'mode',
    'quantity',
    'expected',
    'type',
    'reason',
  ]);
  const variantId = id(form, 'variantId')!;
  const mode = choice(form, 'mode', ['absolute', 'delta']);
  const quantity = integer(form, 'quantity', mode === 'delta' ? -1000000 : 0);
  const expected = mode === 'absolute' ? integer(form, 'expected') : undefined;
  const type = choice(form, 'type', [
    'RESTOCK',
    'CORRECTION',
    'DAMAGE',
    'LOSS',
    'RETURN',
    'MANUAL',
  ]);
  const reason = text(form, 'reason', 500);
  return adminTransaction(adminId, (tx) =>
    changeStock(tx, adminId, variantId, {
      mode,
      quantity,
      expected,
      type,
      reason,
    }),
  );
}
