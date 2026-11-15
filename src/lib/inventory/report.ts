import 'server-only';
import { Prisma } from '@/generated/prisma/client';
import { getPrisma } from '@/lib/db/prisma';
import { currentCount, inventoryControls } from './controls';

const DAY = 86_400_000;
const SAMPLE = 28;
const LIMIT = 1500;
const ROWS = 60;

export async function getInventoryReport(now = new Date()) {
  const generatedAt = now.toISOString();
  const empty = {
    lowStock: [],
    discrepancies: [],
    dormant: [],
    countCoverage: { counted: 0, stale: 0, missing: 0 },
    totals: { lowStock: 0, discrepancies: 0, dormant: 0 },
  };
  return getPrisma().$transaction(
    async (db) => {
      const variants = await db.productVariant.findMany({
        where: {
          isActive: true,
          product: { isDemonstration: false, status: { not: 'ARCHIVED' } },
        },
        orderBy: [{ sku: 'asc' }, { id: 'asc' }],
        take: LIMIT + 1,
        select: {
          id: true,
          sku: true,
          stockQuantity: true,
          reservedQuantity: true,
          availableQuantity: true,
          lowStockThreshold: true,
          updatedAt: true,
          createdAt: true,
          product: {
            select: {
              name: true,
              publishedAt: true,
              status: true,
              preorder: true,
            },
          },
        },
      });
      const limited = variants.length > LIMIT;
      const rows = variants.slice(0, LIMIT);
      const base = {
        schema: 1,
        generatedAt,
        windowDays: SAMPLE,
        productsAnalyzed: rows.length,
        limited,
      };
      if (!rows.length) return { ...base, ...empty };
      const ids = rows.map((row) => row.id);
      const inVariants = Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`));
      const from = new Date(now.getTime() - SAMPLE * DAY);
      const controls = await inventoryControls(ids, db);
      const sales = await db.$queryRaw<
        { variantId: string; units: number; lastSaleAt: Date }[]
      >`
      SELECT item."variantId",
             COALESCE(SUM(line.quantity) FILTER (WHERE sale."paidAt" >= ${from}), 0)::int AS units,
             MAX(sale."paidAt") AS "lastSaleAt"
      FROM "OrderItem" item
      JOIN "Order" sale ON sale.id = item."orderId"
      CROSS JOIN LATERAL (
        SELECT GREATEST(0, item.quantity - COALESCE(SUM(refund_item.quantity), 0)) AS quantity
        FROM "RefundItem" refund_item
        JOIN "Refund" refund ON refund.id = refund_item."refundId"
        WHERE refund_item."orderItemId" = item.id
          AND refund.status = 'SUCCEEDED'
      ) line
      WHERE item."variantId" IN (${inVariants}) AND sale.status = 'PAID'
        AND sale."paidAt" <= ${now} AND line.quantity > 0
      GROUP BY item."variantId"
    `;
      const receipts = await db.inventoryAdjustment.groupBy({
        by: ['variantId'],
        where: {
          variantId: { in: ids },
          previousQuantity: 0,
          newQuantity: { gt: 0 },
          createdAt: { lte: now },
        },
        _max: { createdAt: true },
      });
      const sold = new Map(sales.map((row) => [row.variantId, row]));
      const stocked = new Map(
        receipts.map((row) => [row.variantId, row._max.createdAt]),
      );
      const lowStock = [];
      const discrepancies = [];
      const dormant = [];
      const countCoverage = { counted: 0, stale: 0, missing: 0 };

      for (const variant of rows) {
        const profile = controls.profiles.get(variant.id);
        const count = controls.counts.get(variant.id);
        const common = {
          sku: variant.sku,
          name: variant.product.name,
          location: profile?.location ?? null,
        };
        if (!count) countCoverage.missing++;
        else if (!currentCount(count, variant)) countCoverage.stale++;
        else {
          countCoverage.counted++;
          const difference = count.quantity - variant.stockQuantity;
          if (difference)
            discrepancies.push({
              ...common,
              countedAt: count.at.toISOString(),
              expected: variant.stockQuantity,
              physical: count.quantity,
              reserved: variant.reservedQuantity,
              difference,
              blockedByReservations: count.quantity < variant.reservedQuantity,
            });
        }

        if (variant.product.status !== 'ACTIVE' || variant.product.preorder)
          continue;
        const record = sold.get(variant.id);
        const units = record?.units ?? 0;
        const leadTimeDays = profile?.leadTimeDays ?? null;
        const expectedDemand =
          leadTimeDays !== null && units > 0
            ? Math.ceil((units / SAMPLE) * leadTimeDays)
            : null;
        const threshold = Math.max(
          variant.lowStockThreshold,
          expectedDemand ?? 0,
        );
        if (variant.availableQuantity <= threshold)
          lowStock.push({
            ...common,
            available: variant.availableQuantity,
            reserved: variant.reservedQuantity,
            unitsSold28d: units,
            weeklyAverage: units / 4,
            leadTimeDays,
            fixedThreshold: variant.lowStockThreshold,
            threshold,
            expectedDemand,
            reason:
              variant.availableQuantity === 0 ? 'rupture' : 'seuil_atteint',
            recommendation:
              leadTimeDays === null
                ? 'Confirmer le délai fournisseur.'
                : units === 0
                  ? 'Vérifier la demande avant tout achat.'
                  : 'Étudier un réassort et confirmer le devis.',
          });

        if (variant.availableQuantity <= 0) continue;
        const baseline =
          record?.lastSaleAt?.getTime() ??
          Math.max(
            variant.createdAt.getTime(),
            variant.product.publishedAt?.getTime() ?? 0,
            stocked.get(variant.id)?.getTime() ?? 0,
          );
        const days = Math.floor((now.getTime() - baseline) / DAY);
        if (days >= 30)
          dormant.push({
            ...common,
            days,
            band: days >= 90 ? 90 : days >= 60 ? 60 : 30,
            available: variant.availableQuantity,
            lastSaleAt: record?.lastSaleAt?.toISOString() ?? null,
            since: new Date(baseline).toISOString(),
            recommendation:
              days >= 90
                ? 'Examiner une offre groupée ou un déstockage soumis à validation.'
                : days >= 60
                  ? 'Vérifier la visibilité de la fiche et tester une mise en avant.'
                  : 'Vérifier la fiche, le stock et le placement catalogue.',
          });
      }
      lowStock.sort((a, b) => a.available - b.available);
      discrepancies.sort(
        (a, b) => Math.abs(b.difference) - Math.abs(a.difference),
      );
      dormant.sort((a, b) => b.days - a.days);
      return {
        ...base,
        countCoverage,
        totals: {
          lowStock: lowStock.length,
          discrepancies: discrepancies.length,
          dormant: dormant.length,
        },
        lowStock: lowStock.slice(0, ROWS),
        discrepancies: discrepancies.slice(0, ROWS),
        dormant: dormant.slice(0, ROWS),
      };
    },
    { isolationLevel: 'RepeatableRead', timeout: 10000 },
  );
}
