// The validated import, applied in one transaction: supplier offers created
// or updated with their history, draft products for reliable new
// references, offers missing from a full catalogue flagged. Everything it
// changes is recorded so the supplier's latest import can be undone.
// Server only.
import 'server-only';
import { randomUUID } from 'node:crypto';
import {
  Prisma,
  type ProductLanguage,
  type ProductType,
} from '@/generated/prisma/client';
import { audit } from '@/lib/admin/common';
import { AdminError } from '@/lib/admin/validation';
import { createSlug } from '@/lib/catalog/createSlug';
import { diffOffer, type Change } from './analysis';
import { normalizeHeader } from './fields';
import { productTypeFrom } from './matching';
import type { NormalizedValues } from './normalize';
import {
  IMPORT_CATEGORY_SLUG,
  mergeOffer,
  offerRecord,
  offerSnapshot,
  type OfferRecord,
} from './records';
import {
  lockImport,
  longTransaction,
  supplierOffers,
  type Extraction,
  type StoredSummary,
} from './service';

export type AppliedReport = {
  productsCreated: number;
  offersCreated: number;
  offersUpdated: number;
  offersUnchanged: number;
  offersMissing: number;
  ignored: number;
  rejected: number;
  applyMs: number;
};

export type RevertReport = {
  offersRestored: number;
  offersDeleted: number;
  offersBackFromMissing: number;
  productsDeleted: number;
  /** Drafts already worked on (image, publication, order…): kept. */
  productsKept: number;
};

const APPLIED_ACTIONS = [
  'CREATE_PRODUCT',
  'CREATE_OFFER',
  'UPDATE_OFFER',
  'UNCHANGED',
] as const;

const OFFER_COLUMNS = `
  "id" uuid, "variantId" uuid, "ean" text, "name" text, "brand" text,
  "game" text, "series" text, "category" text, "language" text,
  "condition" text, "purchasePrice" numeric, "purchasePriceInclTax" numeric,
  "msrp" numeric, "vatRate" numeric, "stock" integer, "availability" text,
  "releaseDate" date, "restockDate" date, "minOrderQty" integer,
  "packaging" text, "packSize" integer, "description" text,
  "imageUrl" text, "productUrl" text, "status" text,
  "missingSince" timestamp(3), "lastImportId" uuid, "lastSeenAt" timestamp(3)`;

/** Offers rewritten in bulk from flat records (update, and undo alike). */
async function writeOffers(
  tx: Prisma.TransactionClient,
  records: readonly OfferRecord[],
) {
  for (let start = 0; start < records.length; start += 1000) {
    const batch = JSON.stringify(records.slice(start, start + 1000));
    await tx.$executeRawUnsafe(
      `UPDATE "SupplierOffer" AS o SET
        "variantId" = x."variantId", "ean" = x."ean", "name" = x."name",
        "brand" = x."brand", "game" = x."game", "series" = x."series",
        "category" = x."category",
        "language" = x."language"::"ProductLanguage",
        "condition" = x."condition", "purchasePrice" = x."purchasePrice",
        "purchasePriceInclTax" = x."purchasePriceInclTax", "msrp" = x."msrp",
        "vatRate" = x."vatRate", "stock" = x."stock",
        "availability" = x."availability"::"SupplierAvailability",
        "releaseDate" = x."releaseDate", "restockDate" = x."restockDate",
        "minOrderQty" = x."minOrderQty", "packaging" = x."packaging",
        "packSize" = x."packSize", "description" = x."description",
        "imageUrl" = x."imageUrl", "productUrl" = x."productUrl",
        "status" = x."status"::"SupplierOfferStatus",
        "missingSince" = x."missingSince", "lastImportId" = x."lastImportId",
        "lastSeenAt" = x."lastSeenAt", "updatedAt" = now()
      FROM jsonb_to_recordset($1::jsonb) AS x(${OFFER_COLUMNS})
      WHERE o."id" = x."id"`,
      batch,
    );
  }
}

const decimal = (value: string | null) =>
  value === null ? null : new Prisma.Decimal(value);
const day = (value: string | null) =>
  value ? new Date(`${value}T00:00:00Z`) : null;

function createData(record: OfferRecord, supplierId: string) {
  return {
    id: record.id,
    supplierId,
    supplierSku: record.supplierSku,
    variantId: record.variantId,
    ean: record.ean,
    name: record.name,
    brand: record.brand,
    game: record.game,
    series: record.series,
    category: record.category,
    language: record.language,
    condition: record.condition,
    purchasePrice: decimal(record.purchasePrice),
    purchasePriceInclTax: decimal(record.purchasePriceInclTax),
    msrp: decimal(record.msrp),
    vatRate: decimal(record.vatRate),
    stock: record.stock,
    availability: record.availability,
    releaseDate: day(record.releaseDate),
    restockDate: day(record.restockDate),
    minOrderQty: record.minOrderQty,
    packaging: record.packaging,
    packSize: record.packSize,
    description: record.description,
    imageUrl: record.imageUrl,
    productUrl: record.productUrl,
    status: record.status,
    missingSince: record.missingSince ? new Date(record.missingSince) : null,
    lastImportId: record.lastImportId,
    lastSeenAt: new Date(record.lastSeenAt),
  } satisfies Prisma.SupplierOfferCreateManyInput;
}

const upper = (value: string | null | undefined) => value?.toUpperCase() ?? '';

/** The supplier's reference as a SKU part: letters, digits and dashes. */
const skuPart = (value: string) =>
  value
    .toUpperCase()
    .normalize('NFD')
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'REF';

async function importCategory(tx: Prisma.TransactionClient) {
  return tx.category.upsert({
    where: { slug: IMPORT_CATEGORY_SLUG },
    create: {
      name: 'À classer — imports fournisseurs',
      slug: IMPORT_CATEGORY_SLUG,
      description:
        'Brouillons créés depuis un catalogue fournisseur. Choisissez leur vraie catégorie avant publication.',
      isActive: false,
      sortOrder: 9999,
    },
    update: {},
    select: { id: true },
  });
}

type Draft = {
  rowId: string;
  values: NormalizedValues;
};

/**
 * Draft products for new references: never published, in the hidden
 * category, supplier stock not counted as shop stock.
 */
async function createDrafts(
  tx: Prisma.TransactionClient,
  drafts: readonly Draft[],
  context: { importId: string; code: string; adminId: string },
) {
  const created = new Map<string, string>();
  if (!drafts.length) return created;
  const category = await importCategory(tx);
  const [games, sets] = await Promise.all([
    tx.game.findMany({ select: { id: true, name: true } }),
    tx.tcgSet.findMany({ select: { id: true, name: true, gameId: true } }),
  ]);
  const gameByName = new Map<string, string | null>();
  for (const game of games) {
    const key = normalizeHeader(game.name);
    // Two games with the same name: none is chosen.
    gameByName.set(key, gameByName.has(key) ? null : game.id);
  }
  const bases = drafts.map((draft) => ({
    slug: `${createSlug(draft.values.name!).slice(0, 80)}-${context.code.toLowerCase()}`,
    sku: `SUP-${context.code}-${skuPart(draft.values.supplierSku!)}`,
  }));
  const [slugsTaken, skusTaken, barcodesTaken] = await Promise.all([
    tx.product.findMany({
      where: {
        OR: [...new Set(bases.map((base) => base.slug))].map((slug) => ({
          slug: { startsWith: slug },
        })),
      },
      select: { slug: true },
    }),
    tx.productVariant.findMany({
      where: {
        OR: [...new Set(bases.map((base) => base.sku))].map((sku) => ({
          sku: { startsWith: sku },
        })),
      },
      select: { sku: true },
    }),
    tx.productVariant.findMany({
      where: {
        barcode: {
          in: drafts
            .map((draft) => draft.values.ean)
            .filter((ean): ean is string => Boolean(ean)),
        },
      },
      select: { barcode: true },
    }),
  ]);
  const slugs = new Set(slugsTaken.map((row) => row.slug));
  const skus = new Set(skusTaken.map((row) => row.sku));
  const barcodes = new Set(barcodesTaken.map((row) => row.barcode));
  const unique = (base: string, taken: Set<string>) => {
    let value = base;
    for (let suffix = 2; taken.has(value); suffix++)
      value = `${base}-${suffix}`;
    taken.add(value);
    return value;
  };
  const audits: Prisma.AdminAuditLogCreateManyInput[] = [];
  for (const [index, draft] of drafts.entries()) {
    const { values } = draft;
    const gameId =
      gameByName.get(normalizeHeader(values.game ?? '')) ??
      gameByName.get(normalizeHeader(values.brand ?? '')) ??
      null;
    const setKey = normalizeHeader(values.series ?? '');
    const setMatches = setKey
      ? sets.filter(
          (set) =>
            normalizeHeader(set.name) === setKey &&
            (!gameId || set.gameId === gameId),
        )
      : [];
    const set = setMatches.length === 1 ? setMatches[0]! : null;
    const barcode = values.ean && !barcodes.has(values.ean) ? values.ean : null;
    if (barcode) barcodes.add(barcode);
    const product = await tx.product.create({
      data: {
        name: values.name!.slice(0, 200),
        slug: unique(bases[index]!.slug, slugs),
        status: 'DRAFT',
        productType: productTypeFrom(values.name!) as ProductType,
        categoryId: category.id,
        gameId: set?.gameId ?? gameId,
        tcgSetId: set?.id ?? null,
        releaseDate: day(values.releaseDate),
        sourceImportId: context.importId,
        variants: {
          create: {
            sku: unique(bases[index]!.sku, skus),
            barcode,
            language: (values.language ?? 'FR') as ProductLanguage,
            // Recommended retail price as a starting point, else 0 (which
            // blocks publication until the shop sets its price).
            price: decimal(values.msrp) ?? new Prisma.Decimal(0),
            costPrice: decimal(values.purchasePrice),
            stockQuantity: 0,
            isDefault: true,
          },
        },
      },
      select: { id: true, variants: { select: { id: true } } },
    });
    created.set(draft.rowId, product.variants[0]!.id);
    audits.push({
      adminUserId: context.adminId,
      action: 'PRODUCT_CREATED',
      entityType: 'Product',
      entityId: product.id,
      metadata: { source: 'supplier-import', importId: context.importId },
    });
  }
  await tx.adminAuditLog.createMany({ data: audits });
  return created;
}

export async function applyImport(
  adminId: string,
  importId: string,
  options: { ignoreReview: boolean },
) {
  const started = Date.now();
  return longTransaction(adminId, async (tx) => {
    const record = await lockImport(tx, importId, ['REVIEW']);
    await tx.$queryRaw`
      SELECT id FROM "Supplier" WHERE id = ${record.supplierId}::uuid FOR UPDATE`;
    // The preview compared with the offers of that moment.
    const newer = await tx.supplierImport.count({
      where: {
        supplierId: record.supplierId,
        id: { not: importId },
        OR: [
          { appliedAt: { gt: record.analyzedAt ?? new Date(0) } },
          { revertedAt: { gt: record.analyzedAt ?? new Date(0) } },
        ],
      },
    });
    if (newer)
      throw new AdminError(
        'Un autre import de ce fournisseur a été appliqué ou annulé depuis l’analyse : relancez l’analyse (étape Colonnes).',
      );
    const toReview = await tx.supplierImportRow.count({
      where: { importId, action: 'REVIEW' },
    });
    if (toReview && !options.ignoreReview)
      throw new AdminError(
        `${toReview} ligne${toReview > 1 ? 's restent' : ' reste'} à vérifier : décidez-en, ou cochez « ignorer les lignes à vérifier ».`,
      );
    if (toReview)
      await tx.supplierImportRow.updateMany({
        where: { importId, action: 'REVIEW' },
        data: { action: 'IGNORE', decidedAt: new Date() },
      });
    const now = new Date();
    const rows = await tx.supplierImportRow.findMany({
      where: { importId, action: { in: [...APPLIED_ACTIONS] } },
      orderBy: { rowNumber: 'asc' },
      select: { id: true, values: true, variantId: true, action: true },
    });
    const current = new Map(
      (await supplierOffers(tx, record.supplierId)).map((offer) => [
        upper(offer.supplierSku),
        offer,
      ]),
    );
    // Two rows of one reference: the first applied wins (they were flagged).
    const seen = new Set<string>();
    const skipped: string[] = [];
    const applicable = rows.filter((row) => {
      const sku = upper((row.values as NormalizedValues).supplierSku);
      if (sku && !seen.has(sku)) {
        seen.add(sku);
        return true;
      }
      skipped.push(row.id);
      return false;
    });
    if (skipped.length)
      await tx.supplierImportRow.updateMany({
        where: { id: { in: skipped } },
        data: { action: 'IGNORE', decidedAt: now },
      });
    const drafts = await createDrafts(
      tx,
      applicable
        .filter((row) => row.action === 'CREATE_PRODUCT')
        .map((row) => ({
          rowId: row.id,
          values: row.values as NormalizedValues,
        })),
      { importId, code: record.supplier.code, adminId },
    );
    const creates: OfferRecord[] = [];
    const updates: OfferRecord[] = [];
    const changes: Prisma.SupplierOfferChangeCreateManyInput[] = [];
    const rowUpdates: {
      id: string;
      offerId: string;
      before: OfferRecord | null;
    }[] = [];
    const counts = { created: 0, updated: 0, unchanged: 0 };
    for (const row of applicable) {
      const values = row.values as NormalizedValues;
      const stored = current.get(upper(values.supplierSku)) ?? null;
      const before = stored ? offerRecord(stored) : null;
      const next = mergeOffer(before, values, {
        id: randomUUID(),
        importId,
        variantId: drafts.get(row.id) ?? row.variantId,
        now,
      });
      const rowChanges: Change[] = stored
        ? diffOffer(offerSnapshot(stored), values)
        : [
            {
              kind: 'NEW_OFFER',
              field: null,
              before: null,
              after: next.supplierSku,
            },
          ];
      if (stored && stored.variantId !== next.variantId)
        rowChanges.push({
          kind: 'INFO',
          field: 'variantId',
          before: stored.variantId,
          after: next.variantId,
        });
      if (stored) {
        updates.push(next);
        if (rowChanges.length) counts.updated++;
        else counts.unchanged++;
      } else {
        creates.push(next);
        counts.created++;
      }
      for (const change of rowChanges)
        changes.push({
          offerId: next.id,
          importId,
          kind: change.kind,
          field: change.field,
          before: change.before ?? Prisma.DbNull,
          after: change.after ?? Prisma.DbNull,
        });
      rowUpdates.push({ id: row.id, offerId: next.id, before });
    }
    for (let start = 0; start < creates.length; start += 1000)
      await tx.supplierOffer.createMany({
        data: creates
          .slice(start, start + 1000)
          .map((offer) => createData(offer, record.supplierId)),
      });
    await writeOffers(tx, updates);
    // A full catalogue: what it no longer lists is flagged, never deleted.
    let missing = 0;
    if (record.scope === 'FULL') {
      const listed = new Set(
        (
          await tx.$queryRaw<{ sku: string | null }[]>`
            SELECT upper("values"->>'supplierSku') AS sku
            FROM "SupplierImportRow" WHERE "importId" = ${importId}::uuid`
        ).map((row) => row.sku),
      );
      const gone = [...current.values()].filter(
        (offer) =>
          offer.status === 'ACTIVE' && !listed.has(upper(offer.supplierSku)),
      );
      if (gone.length) {
        await tx.supplierOffer.updateMany({
          where: { id: { in: gone.map((offer) => offer.id) } },
          data: { status: 'MISSING', missingSince: now },
        });
        for (const offer of gone)
          changes.push({
            offerId: offer.id,
            importId,
            kind: 'DISAPPEARED',
            field: 'status',
            before: 'ACTIVE',
            after: 'MISSING',
          });
      }
      missing = gone.length;
    }
    for (let start = 0; start < changes.length; start += 2000)
      await tx.supplierOfferChange.createMany({
        data: changes.slice(start, start + 2000),
      });
    for (let start = 0; start < rowUpdates.length; start += 1000)
      await tx.$executeRawUnsafe(
        `UPDATE "SupplierImportRow" AS r SET
          "offerId" = x."offerId", "before" = x."before", "appliedAt" = $2
        FROM jsonb_to_recordset($1::jsonb)
          AS x("id" uuid, "offerId" uuid, "before" jsonb)
        WHERE r."id" = x."id"`,
        JSON.stringify(rowUpdates.slice(start, start + 1000)),
        now,
      );
    const [ignored, rejected] = await Promise.all([
      tx.supplierImportRow.count({ where: { importId, action: 'IGNORE' } }),
      tx.supplierImportRow.count({ where: { importId, action: 'REJECT' } }),
    ]);
    const report: AppliedReport = {
      productsCreated: drafts.size,
      offersCreated: counts.created,
      offersUpdated: counts.updated,
      offersUnchanged: counts.unchanged,
      offersMissing: missing,
      ignored,
      rejected,
      applyMs: Date.now() - started,
    };
    const summary = record.summary as StoredSummary | null;
    const extraction = record.extraction as Extraction | null;
    await tx.supplierImport.update({
      where: { id: importId },
      data: {
        status: 'APPLIED',
        appliedAt: now,
        appliedById: adminId,
        durationMs:
          (extraction?.ms ?? 0) + (summary?.analysisMs ?? 0) + report.applyMs,
        summary: { ...summary, applied: report } as Prisma.InputJsonValue,
      },
    });
    if (record.profileId)
      await tx.supplierProfile.update({
        where: { id: record.profileId },
        data: { useCount: { increment: 1 }, lastUsedAt: now },
      });
    // The file and page words are no longer needed; rows stay as the report.
    await tx.supplierImportChunk.deleteMany({ where: { importId } });
    await tx.supplierImportPage.updateMany({
      where: { importId },
      data: { words: Prisma.DbNull, rows: Prisma.DbNull },
    });
    await audit(
      tx,
      adminId,
      'SUPPLIER_IMPORT_APPLIED',
      'SupplierImport',
      importId,
      report,
    );
    return report;
  });
}

/** Undoes the supplier's latest applied import. */
export async function revertImport(adminId: string, importId: string) {
  return longTransaction(adminId, async (tx) => {
    const record = await lockImport(tx, importId, ['APPLIED']);
    await tx.$queryRaw`
      SELECT id FROM "Supplier" WHERE id = ${record.supplierId}::uuid FOR UPDATE`;
    const later = await tx.supplierImport.count({
      where: {
        supplierId: record.supplierId,
        status: 'APPLIED',
        appliedAt: { gt: record.appliedAt! },
      },
    });
    if (later)
      throw new AdminError(
        'Un import plus récent de ce fournisseur a été appliqué : annulez-le d’abord.',
      );
    const rows = await tx.supplierImportRow.findMany({
      where: { importId, appliedAt: { not: null } },
      select: { offerId: true, before: true },
    });
    const restored = rows
      .map((row) => row.before as OfferRecord | null)
      .filter((before): before is OfferRecord => before !== null);
    // A product deleted since: the restored offer is no longer linked.
    const variants = new Set(
      (
        await tx.productVariant.findMany({
          where: {
            id: {
              in: restored
                .map((offer) => offer.variantId)
                .filter((id): id is string => Boolean(id)),
            },
          },
          select: { id: true },
        })
      ).map((variant) => variant.id),
    );
    const lastImports = new Set(
      (
        await tx.supplierImport.findMany({
          where: {
            id: {
              in: restored
                .map((offer) => offer.lastImportId)
                .filter((id): id is string => Boolean(id)),
            },
          },
          select: { id: true },
        })
      ).map((row) => row.id),
    );
    await writeOffers(
      tx,
      restored.map((offer) => ({
        ...offer,
        variantId:
          offer.variantId && variants.has(offer.variantId)
            ? offer.variantId
            : null,
        lastImportId:
          offer.lastImportId && lastImports.has(offer.lastImportId)
            ? offer.lastImportId
            : null,
      })),
    );
    const createdOffers = rows
      .filter((row) => row.before === null && row.offerId)
      .map((row) => row.offerId!);
    const deleted = await tx.supplierOffer.deleteMany({
      where: { id: { in: createdOffers }, lastImportId: importId },
    });
    const gone = await tx.supplierOfferChange.findMany({
      where: { importId, kind: 'DISAPPEARED' },
      select: { offerId: true },
    });
    const back = await tx.supplierOffer.updateMany({
      where: {
        id: { in: gone.map((change) => change.offerId) },
        status: 'MISSING',
      },
      data: { status: 'ACTIVE', missingSince: null },
    });
    // Drafts nobody has worked on yet go; the others stay, as they are.
    const products = await tx.product.findMany({
      where: { sourceImportId: importId },
      select: {
        id: true,
        status: true,
        _count: {
          select: {
            images: true,
            orderItems: true,
            wishlistItems: true,
            pilotageLaunches: true,
          },
        },
        variants: {
          select: {
            id: true,
            _count: {
              select: {
                orderItems: true,
                cartItems: true,
                reservations: true,
                adjustments: true,
              },
            },
          },
        },
      },
    });
    const untouched = products.filter(
      (product) =>
        product.status === 'DRAFT' &&
        Object.values(product._count).every((count) => count === 0) &&
        product.variants.every((variant) =>
          Object.values(variant._count).every((count) => count === 0),
        ),
    );
    const ids = untouched.map((product) => product.id);
    if (ids.length) {
      await tx.productVariant.deleteMany({ where: { productId: { in: ids } } });
      await tx.product.deleteMany({ where: { id: { in: ids } } });
    }
    await tx.supplierOfferChange.deleteMany({ where: { importId } });
    const report: RevertReport = {
      offersRestored: restored.length,
      offersDeleted: deleted.count,
      offersBackFromMissing: back.count,
      productsDeleted: ids.length,
      productsKept: products.length - ids.length,
    };
    const summary = record.summary as Record<string, unknown> | null;
    await tx.supplierImport.update({
      where: { id: importId },
      data: {
        status: 'REVERTED',
        revertedAt: new Date(),
        summary: { ...summary, reverted: report } as Prisma.InputJsonValue,
      },
    });
    await audit(
      tx,
      adminId,
      'SUPPLIER_IMPORT_REVERTED',
      'SupplierImport',
      importId,
      report,
    );
    return report;
  });
}
