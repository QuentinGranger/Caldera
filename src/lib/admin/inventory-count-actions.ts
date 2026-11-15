'use server';

import { revalidatePath } from 'next/cache';
import type { Prisma } from '@/generated/prisma/client';
import { invalidateCatalogCache } from '@/lib/cache/catalogCache';
import {
  COUNT_EVENT,
  PROFILE_EVENT,
  currentCount,
  inventoryControls,
  locationPattern,
} from '@/lib/inventory/controls';
import { requireAdmin } from './auth';
import { adminTransaction } from './common';
import { changeStock } from './inventory';
import type { AdminActionState } from './action-types';
import { AdminError, id, integer, text, whitelist } from './validation';

async function writeEvent(
  tx: Prisma.TransactionClient,
  adminUserId: string,
  entityId: string,
  action: string,
  metadata: Prisma.InputJsonObject,
) {
  // Stock row is already locked. A transaction started earlier can acquire that lock later,
  // so use the event's actual write time and preserve order even within one millisecond.
  const [row] = await tx.$queryRaw<{ createdAt: Date }[]>`
    SELECT GREATEST(
      date_trunc('milliseconds', clock_timestamp() AT TIME ZONE 'UTC'),
      COALESCE(MAX("createdAt") + INTERVAL '1 millisecond', 'epoch'::timestamp)
    ) AS "createdAt"
    FROM "AdminAuditLog"
    WHERE "entityType" = 'ProductVariant' AND "entityId" = ${entityId}::uuid AND action = ${action}
  `;
  await tx.adminAuditLog.create({
    data: {
      adminUserId,
      entityId,
      entityType: 'ProductVariant',
      action,
      metadata,
      createdAt: row?.createdAt,
    },
  });
}

async function submit(
  form: FormData,
  kind: 'profile' | 'count' | 'approve',
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  try {
    const variantId = id(form, 'variantId')!;
    const message = await adminTransaction(admin.id, async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ProductVariant" WHERE id = ${variantId}::uuid FOR UPDATE`;
      const variant = await tx.productVariant.findUnique({
        where: { id: variantId },
        select: {
          stockQuantity: true,
          updatedAt: true,
          isActive: true,
          product: { select: { isDemonstration: true, status: true } },
        },
      });
      if (
        !variant?.isActive ||
        variant.product.isDemonstration ||
        variant.product.status === 'ARCHIVED'
      )
        throw new AdminError('Variante réelle active introuvable.');

      if (kind === 'profile') {
        whitelist(form, ['variantId', 'location', 'leadTimeDays']);
        const location = text(form, 'location', 48, false).toUpperCase();
        if (location && !locationPattern.test(location))
          throw new AdminError(
            'Code invalide. Utilisez par exemple GAR-A03-B02.',
          );
        const days = text(form, 'leadTimeDays', 3, false);
        const leadTimeDays = days
          ? integer(form, 'leadTimeDays', 1, 365)
          : null;
        await writeEvent(tx, admin.id, variantId, PROFILE_EVENT, {
          location: location || null,
          leadTimeDays,
        });
        return 'Emplacement et délai enregistrés.';
      }

      const version = variant.updatedAt.toISOString();
      if (kind === 'count') {
        whitelist(form, ['variantId', 'expectedVersion', 'quantity']);
        if (text(form, 'expectedVersion', 30) !== version)
          throw new AdminError(
            'Le stock a évolué. Rechargez la page et refaites le comptage.',
          );
        const quantity = integer(form, 'quantity');
        await writeEvent(tx, admin.id, variantId, COUNT_EVENT, {
          quantity,
          expected: variant.stockQuantity,
          version,
        });
        return 'Comptage enregistré. Le stock est inchangé.';
      }

      whitelist(form, ['variantId', 'countId', 'reason']);
      const count = (await inventoryControls([variantId], tx)).counts.get(
        variantId,
      );
      if (
        !count ||
        count.id !== id(form, 'countId') ||
        !currentCount(count, variant)
      )
        throw new AdminError(
          'Ce comptage doit être refait : le stock ou le comptage a changé.',
        );
      if (count.quantity === variant.stockQuantity)
        throw new AdminError('Ce comptage ne présente aucun écart.');
      const updated = await changeStock(tx, admin.id, variantId, {
        type: 'CORRECTION',
        mode: 'absolute',
        quantity: count.quantity,
        expected: count.expected,
        reason: text(form, 'reason', 500),
      });
      await writeEvent(tx, admin.id, variantId, COUNT_EVENT, {
        quantity: count.quantity,
        expected: updated.stockQuantity,
        version: updated.updatedAt.toISOString(),
        approvedCountId: count.id,
      });
      return 'Correction validée et inscrite dans l’historique.';
    });
    if (kind === 'approve') invalidateCatalogCache();
    revalidatePath('/admin/stocks', 'layout');
    return { success: true, message };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof AdminError
          ? error.message
          : 'Enregistrement impossible. Rechargez la page et réessayez.',
    };
  }
}

export async function saveInventoryProfileAction(
  _: AdminActionState,
  form: FormData,
) {
  return submit(form, 'profile');
}
export async function recordPhysicalCountAction(
  _: AdminActionState,
  form: FormData,
) {
  return submit(form, 'count');
}
export async function approvePhysicalCountAction(
  _: AdminActionState,
  form: FormData,
) {
  return submit(form, 'approve');
}
