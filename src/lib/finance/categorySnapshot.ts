import 'server-only';
import { getPrisma } from '@/lib/db/prisma';
import { includedTax, parseInvoiceSnapshot } from '@/lib/invoices/document';
import { toCents } from '@/lib/refunds/amounts';
import { parisMidnightUtc, previousParisDay } from './dailySnapshot';

const names = {
  pokemon: 'Pokémon',
  otherTcg: 'Autres JCC',
  boardGames: 'Jeux de société',
  accessories: 'Accessoires',
  unclassified: 'Non classé',
} as const;
type Category = keyof typeof names;

function categoryOf(
  product: {
    productType: string;
    game: { slug: string } | null;
    category: { slug: string; parent: { slug: string } | null };
  } | null,
): Category {
  if (!product) return 'unclassified';
  const slugs = [product.category.slug, product.category.parent?.slug];
  if (product.productType === 'ACCESSORY' || slugs.includes('accessoires'))
    return 'accessories';
  if (
    slugs.some(
      (slug) => slug === 'jeux-de-societe' || slug === 'jeux-de-plateau',
    )
  )
    return 'boardGames';
  if (product.game?.slug === 'pokemon') return 'pokemon';
  return product.game ? 'otherTcg' : 'unclassified';
}

export function lastClosedMonth(reference = new Date()) {
  const localDay = previousParisDay(
    new Date(reference.getTime() + 24 * 60 * 60_000),
  );
  const previous = new Date(localDay.slice(0, 7) + '-01T00:00:00Z');
  previous.setUTCMonth(previous.getUTCMonth() - 1);
  return previous.toISOString().slice(0, 7);
}

export async function getCategorySnapshot(period: string) {
  const start = parisMidnightUtc(period + '-01');
  const nextMonth = new Date(period + '-01T00:00:00Z');
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  const end = parisMidnightUtc(nextMonth.toISOString().slice(0, 10));
  const where = {
    status: 'PAID' as const,
    currency: 'EUR',
    paidAt: { gte: start, lt: end },
  };
  const db = getPrisma();
  const [orders, goodwill] = await db.$transaction(
    [
      db.order.findMany({
        where,
        select: {
          taxMode: true,
          invoices: {
            where: { kind: 'INVOICE' },
            take: 1,
            orderBy: { issuedAt: 'asc' },
            select: { snapshot: true },
          },
          items: {
            orderBy: { id: 'asc' },
            select: {
              sku: true,
              productName: true,
              quantity: true,
              lineTotal: true,
              discountAmount: true,
              taxAmount: true,
              taxRate: true,
              unitCost: true,
              product: {
                select: {
                  isDemonstration: true,
                  productType: true,
                  game: { select: { slug: true } },
                  category: {
                    select: { slug: true, parent: { select: { slug: true } } },
                  },
                },
              },
              refundItems: {
                where: {
                  refund: {
                    status: 'SUCCEEDED',
                    currency: 'EUR',
                    succeededAt: { not: null },
                  },
                },
                select: {
                  amount: true,
                  quantity: true,
                  refund: { select: { restockedAt: true } },
                },
              },
            },
          },
        },
      }),
      db.refund.findMany({
        where: {
          order: where,
          status: 'SUCCEEDED',
          currency: 'EUR',
          succeededAt: { not: null },
        },
        select: {
          amount: true,
          shippingAmount: true,
          items: { select: { amount: true } },
        },
      }),
    ],
    { isolationLevel: 'RepeatableRead' },
  );

  const buckets = new Map(
    (Object.keys(names) as Category[]).map((key) => [
      key,
      { net: 0, cost: 0, units: 0, lines: 0, missingCost: 0, missingTax: 0 },
    ]),
  );
  for (const order of orders) {
    const invoice = order.invoices[0]
      ? parseInvoiceSnapshot(order.invoices[0].snapshot)
      : null;
    for (const [index, item] of order.items.entries()) {
      if (item.product?.isDemonstration) continue;
      const bucket = buckets.get(categoryOf(item.product))!;
      const invoiceLine = invoice?.lines[index];
      const gross = toCents(item.lineTotal) - toCents(item.discountAmount);
      const matched =
        invoiceLine?.description === item.productName &&
        invoiceLine.detail?.startsWith(item.sku + ' · ') &&
        toCents(invoiceLine.total) === gross;
      const rate =
        order.taxMode === 'NONE'
          ? 0
          : matched && invoiceLine.taxRate !== null
            ? Number(invoiceLine.taxRate)
            : (item.taxRate?.toNumber() ?? null);
      const tax =
        order.taxMode === 'NONE'
          ? 0
          : matched
            ? toCents(invoiceLine.taxAmount)
            : toCents(item.taxAmount);
      let returned = 0;
      let refundedNet = 0;
      for (const refund of item.refundItems) {
        const amount = toCents(refund.amount);
        refundedNet += amount - (rate === null ? 0 : includedTax(amount, rate));
        if (refund.refund.restockedAt) returned += refund.quantity;
      }
      const units = Math.max(0, item.quantity - returned);
      bucket.lines++;
      bucket.units += units;
      if (rate === null) bucket.missingTax++;
      else bucket.net += gross - tax - refundedNet;
      if (units && item.unitCost === null) bucket.missingCost++;
      else if (item.unitCost !== null)
        bucket.cost += toCents(item.unitCost) * units;
    }
  }

  const unallocated = goodwill.reduce(
    (sum, refund) =>
      sum +
      Math.max(
        0,
        toCents(refund.amount) -
          toCents(refund.shippingAmount) -
          refund.items.reduce((total, item) => total + toCents(item.amount), 0),
      ),
    0,
  );
  return {
    schema: 1,
    kind: 'categories',
    period,
    generatedAt: new Date().toISOString(),
    basis:
      'Commandes payées du mois de Paris ; remboursements confirmés imputés à la vente d’origine, hors port et gestes commerciaux sans catégorie.',
    unallocatedRefundTtc: unallocated / 100,
    categories: [...buckets].map(([key, row]) => {
      const complete = Boolean(
        row.lines && !row.missingTax && !row.missingCost,
      );
      return {
        key,
        name: names[key],
        salesLines: row.lines,
        netUnits: row.units,
        netRevenueHt: row.missingTax ? null : row.net / 100,
        grossMarginHt: complete ? (row.net - row.cost) / 100 : null,
        grossMarginRate:
          complete && row.net > 0
            ? Math.round(((row.net - row.cost) / row.net) * 10000) / 100
            : null,
        missingCostLines: row.missingCost,
        missingTaxLines: row.missingTax,
      };
    }),
  };
}
