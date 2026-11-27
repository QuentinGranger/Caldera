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

/** Order the full inventory by its latest shelf assignment before paging. */
export async function countsByLocation(
  search: string,
  offset: number,
  limit: number,
) {
  return getPrisma().$queryRaw<
    {
      id: string;
      sku: string;
      stockQuantity: number;
      updatedAt: Date;
      location: string | null;
      total: number;
    }[]
  >`
    SELECT v.id, v.sku, v."stockQuantity", v."updatedAt", shelf.location,
           COUNT(*) OVER ()::int AS total
    FROM "ProductVariant" v
    JOIN "Product" p ON p.id = v."productId"
    LEFT JOIN LATERAL (
      SELECT CASE WHEN metadata->>'location' ~ ${locationPattern.source}
                  THEN metadata->>'location' END AS location
      FROM "AdminAuditLog"
      WHERE "entityType" = 'ProductVariant' AND "entityId" = v.id AND action = ${PROFILE_EVENT}
      ORDER BY "createdAt" DESC, id DESC
      LIMIT 1
    ) shelf ON TRUE
    WHERE v."isActive" AND NOT p."isDemonstration" AND p.status <> 'ARCHIVED'
    ${
      search
        ? Prisma.sql`AND (strpos(lower(v.sku), lower(${search})) > 0
                    OR strpos(lower(p.name), lower(${search})) > 0
                    OR strpos(lower(shelf.location), lower(${search})) > 0)`
        : Prisma.empty
    }
    ORDER BY shelf.location COLLATE "C" ASC NULLS LAST, v.sku, v.id
    LIMIT ${limit} OFFSET ${offset}
  `;
}
