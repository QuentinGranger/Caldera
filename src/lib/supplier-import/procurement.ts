import 'server-only';
import { getPrisma } from '@/lib/db/prisma';

const OFFER_LIMIT = 1000;
const CHANGE_LIMIT = 20;
const LOOKBACK_DAYS = 7;

export async function getProcurementSnapshot(now = new Date()) {
  const db = getPrisma();
  const since = new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000);
  const activeSupplier = { isActive: true };
  const where = { status: 'ACTIVE' as const, supplier: activeSupplier };
  const [suppliers, offers, changes, availability, changeCount] =
    await db.$transaction(
      [
        db.supplier.findMany({
          where: activeSupplier,
          orderBy: { code: 'asc' },
          select: {
            name: true,
            code: true,
            imports: {
              where: { status: 'APPLIED' },
              orderBy: { appliedAt: 'desc' },
              take: 1,
              select: { appliedAt: true },
            },
          },
        }),
        db.supplierOffer.findMany({
          where,
          orderBy: [{ lastSeenAt: 'desc' }, { id: 'asc' }],
          take: OFFER_LIMIT + 1,
          select: {
            name: true,
            supplierSku: true,
            supplier: { select: { code: true } },
            ean: true,
            language: true,
            condition: true,
            variantId: true,
            purchasePrice: true,
            minOrderQty: true,
            packSize: true,
            stock: true,
            availability: true,
            lastSeenAt: true,
          },
        }),
        db.supplierOfferChange.findMany({
          where: {
            createdAt: { gte: since, lte: now },
            offer: { supplier: activeSupplier },
            supplierImport: { status: 'APPLIED' },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: CHANGE_LIMIT,
          select: {
            kind: true,
            createdAt: true,
            offer: {
              select: {
                name: true,
                supplierSku: true,
                supplier: { select: { code: true } },
              },
            },
          },
        }),
        db.supplierOffer.groupBy({
          by: ['availability'],
          where,
          _count: { _all: true },
        }),
        db.supplierOfferChange.count({
          where: {
            createdAt: { gte: since, lte: now },
            offer: { supplier: activeSupplier },
            supplierImport: { status: 'APPLIED' },
          },
        }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );

  return {
    schema: 1,
    generatedAt: now.toISOString(),
    lookbackDays: LOOKBACK_DAYS,
    suppliers: suppliers.map(({ code, name, imports }) => ({
      code,
      name,
      lastImportAt: imports[0]?.appliedAt?.toISOString() ?? null,
    })),
    offers: offers
      .slice(0, OFFER_LIMIT)
      .map(({ supplier, purchasePrice, lastSeenAt, ...offer }) => ({
        ...offer,
        supplierCode: supplier.code,
        unitHt: purchasePrice?.toNumber() ?? null,
        lastSeenAt: lastSeenAt.toISOString(),
      })),
    offersTruncated: offers.length > OFFER_LIMIT,
    availability: Object.fromEntries(
      availability.map((row) => [row.availability, row._count._all]),
    ),
    changeCount,
    changes: changes.map(({ offer, kind, createdAt }) => ({
      kind,
      at: createdAt.toISOString(),
      name: offer.name,
      supplierCode: offer.supplier.code,
      supplierSku: offer.supplierSku,
    })),
  };
}
