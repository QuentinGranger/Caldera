import { Prisma } from '@/generated/prisma/client';
import { getPrisma } from '@/lib/db/prisma';

export const PROFILE_EVENT = 'INVENTORY_PROFILE_SAVED';
export const COUNT_EVENT = 'INVENTORY_COUNT_RECORDED';
export const locationPattern = /^[A-Z0-9]{1,12}(?:-[A-Z0-9]{1,12}){1,5}$/;

export type InventoryProfile = {
  location: string | null;
  leadTimeDays: number | null;
};
export const blankProfile: InventoryProfile = {
  location: null,
  leadTimeDays: null,
};
export type PhysicalCount = {
  id: string;
  at: Date;
  quantity: number;
  expected: number;
  version: string;
};

type ReadDb = Pick<ReturnType<typeof getPrisma>, '$queryRaw'>;
export async function inventoryControls(
  variantIds: readonly string[],
  db: ReadDb = getPrisma(),
) {
  const profiles = new Map<string, InventoryProfile>();
  const counts = new Map<string, PhysicalCount>();
  if (!variantIds.length) return { profiles, counts };
  const events = await db.$queryRaw<
    {
      id: string;
      entityId: string;
      action: string;
      metadata: Prisma.JsonValue;
      createdAt: Date;
    }[]
  >`
    SELECT DISTINCT ON ("entityId", action) id, "entityId", action, metadata, "createdAt"
    FROM "AdminAuditLog"
    WHERE "entityType" = 'ProductVariant'
      AND "entityId" IN (${Prisma.join(variantIds.map((id) => Prisma.sql`${id}::uuid`))})
      AND action IN (${PROFILE_EVENT}, ${COUNT_EVENT})
    ORDER BY "entityId", action, "createdAt" DESC, id DESC
  `;
  for (const row of events) {
    const meta = row.metadata;
    if (!meta || Array.isArray(meta) || typeof meta !== 'object') continue;
    if (row.action === PROFILE_EVENT) {
      profiles.set(row.entityId, {
        location:
          typeof meta.location === 'string' &&
          locationPattern.test(meta.location)
            ? meta.location
            : null,
        leadTimeDays:
          typeof meta.leadTimeDays === 'number' &&
          Number.isInteger(meta.leadTimeDays) &&
          meta.leadTimeDays > 0 &&
          meta.leadTimeDays <= 365
            ? meta.leadTimeDays
            : null,
      });
    } else if (
      typeof meta.quantity === 'number' &&
      typeof meta.expected === 'number' &&
      typeof meta.version === 'string'
    ) {
      counts.set(row.entityId, {
        id: row.id,
        at: row.createdAt,
        quantity: meta.quantity,
        expected: meta.expected,
        version: meta.version,
      });
    }
  }
  return { profiles, counts };
}

export function currentCount(
  count: PhysicalCount,
  variant: { updatedAt: Date; stockQuantity: number },
) {
  return (
    count.version === variant.updatedAt.toISOString() &&
    count.expected === variant.stockQuantity
  );
}
