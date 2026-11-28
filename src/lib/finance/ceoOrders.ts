import 'server-only';
import { Prisma } from '@/generated/prisma/client';
import { getPrisma } from '@/lib/db/prisma';
import { parisToday } from './cashForecast';

type Counts = {
  toPrepare: number;
  preparing: number;
  readyToShip: number;
  waitingPreorder: number;
  awaitingShipment48h: number;
  paymentReview: number;
  paymentProcessing1h: number;
  inconsistentPaidOrders: number;
  refundActionRequired: number;
  refundPending24h: number;
};

type Priorities = {
  total: number;
  orders: { id: string; reference: string; level: number; reasons: string[] }[];
};

export async function getCeoOrderSummary(
  now = new Date(),
  includePriorities = false,
) {
  const ago = (hours: number) => new Date(now.getTime() - hours * 3_600_000);
  const today = parisToday(now);
  const [counts] = await getPrisma().$queryRaw<
    (Counts & { priorities?: Priorities })[]
  >`
    WITH open_paid AS (
      SELECT o.id, o."fulfillmentStatus", o."paidAt", o."updatedAt",
             (p.status IS NOT DISTINCT FROM 'SUCCEEDED'
               AND p.amount = o."totalAmount" AND p.currency = o.currency
               AND o."paidAt" IS NOT NULL
               AND EXISTS (
                 SELECT 1 FROM "StockReservation" r WHERE r."orderId" = o.id
               )
               AND NOT EXISTS (
                 SELECT 1 FROM "StockReservation" r
                 WHERE r."orderId" = o.id AND r.status <> 'CONSUMED'
               )) IS TRUE AS verified,
             EXISTS (
               SELECT 1 FROM "OrderItem" item
               JOIN "Product" product ON product.id = item."productId"
               WHERE item."orderId" = o.id AND product.preorder
                 AND (product."releaseDate" IS NULL OR product."releaseDate" > ${today}::date)
             ) AS awaiting_preorder
      FROM "Order" o
      LEFT JOIN "Payment" p ON p."orderId" = o.id
      WHERE o.status = 'PAID'
        AND o."fulfillmentStatus" IN ('UNFULFILLED', 'PREPARING', 'READY_TO_SHIP')
        AND NOT EXISTS (
          SELECT 1 FROM "Refund" f
          WHERE f."orderId" = o.id AND f.status = 'SUCCEEDED'
          GROUP BY f."orderId" HAVING SUM(f.amount) >= o."totalAmount"
        )
    ), orders_to_ship AS (
      SELECT * FROM open_paid WHERE verified AND NOT awaiting_preorder
    ), signals (id, reason, level, since) AS (
      SELECT id, 'awaitingShipment48h', 2, "paidAt" FROM orders_to_ship WHERE "paidAt" <= ${ago(48)}
      UNION ALL SELECT id, 'inconsistentPaidOrders', 1, COALESCE("paidAt", "updatedAt") FROM open_paid WHERE NOT verified
      UNION ALL SELECT id, 'paymentReview', 1, "updatedAt" FROM "Order" WHERE status = 'PAYMENT_REVIEW'
      UNION ALL SELECT id, 'paymentProcessing1h', 2, "updatedAt" FROM "Order" WHERE status = 'PAYMENT_PROCESSING' AND "updatedAt" <= ${ago(1)}
      UNION ALL SELECT "orderId", 'refundActionRequired', 1, "createdAt" FROM "Refund" WHERE status = 'REQUIRES_ACTION'
      UNION ALL SELECT "orderId", 'refundPending24h', 2, "createdAt" FROM "Refund" WHERE status = 'PENDING' AND "createdAt" <= ${ago(24)}
    )
    ${
      includePriorities
        ? Prisma.sql`, dossiers AS (
      SELECT id, min(level) AS level, min(since) AS since, array_agg(DISTINCT reason ORDER BY reason) AS reasons
      FROM signals GROUP BY id
    ), shortlist AS (
      SELECT d.*, o."orderNumber" AS reference FROM dossiers d JOIN "Order" o ON o.id = d.id
      ORDER BY d.level, d.since, d.id LIMIT 50
    )`
        : Prisma.empty
    }
    SELECT
      (SELECT COUNT(*)::int FROM orders_to_ship WHERE "fulfillmentStatus" = 'UNFULFILLED') AS "toPrepare",
      (SELECT COUNT(*)::int FROM orders_to_ship WHERE "fulfillmentStatus" = 'PREPARING') AS "preparing",
      (SELECT COUNT(*)::int FROM orders_to_ship WHERE "fulfillmentStatus" = 'READY_TO_SHIP') AS "readyToShip",
      (SELECT COUNT(*)::int FROM open_paid WHERE verified AND awaiting_preorder) AS "waitingPreorder",
      COUNT(*) FILTER (WHERE reason = 'awaitingShipment48h')::int AS "awaitingShipment48h",
      COUNT(*) FILTER (WHERE reason = 'inconsistentPaidOrders')::int AS "inconsistentPaidOrders",
      COUNT(*) FILTER (WHERE reason = 'paymentReview')::int AS "paymentReview",
      COUNT(*) FILTER (WHERE reason = 'paymentProcessing1h')::int AS "paymentProcessing1h",
      COUNT(*) FILTER (WHERE reason = 'refundActionRequired')::int AS "refundActionRequired",
      COUNT(*) FILTER (WHERE reason = 'refundPending24h')::int AS "refundPending24h"
      ${
        includePriorities
          ? Prisma.sql`, jsonb_build_object(
        'total', (SELECT count(*) FROM dossiers),
        'orders', COALESCE((SELECT jsonb_agg((to_jsonb(s) - 'since') ORDER BY s.level, s.since, s.id) FROM shortlist s), '[]'::jsonb)
      ) AS priorities`
          : Prisma.empty
      }
    FROM signals
  `;
  if (!counts) throw new Error('Le relevé des commandes est incomplet.');
  return { schema: 1, asOf: now.toISOString(), ...counts };
}
