import 'server-only';
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

export async function getCeoOrderSummary(now = new Date()) {
  const ago = (hours: number) => new Date(now.getTime() - hours * 3_600_000);
  const today = parisToday(now);
  const [counts] = await getPrisma().$queryRaw<Counts[]>`
    WITH open_paid AS (
      SELECT o."fulfillmentStatus", o."paidAt",
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
    ), payments AS (
      SELECT COUNT(*) FILTER (WHERE o.status = 'PAYMENT_REVIEW')::int AS review,
             COUNT(*) FILTER (
               WHERE o.status = 'PAYMENT_PROCESSING'
                 AND o."updatedAt" <= ${ago(1)}
             )::int AS processing
      FROM "Order" o WHERE o.status IN ('PAYMENT_REVIEW', 'PAYMENT_PROCESSING')
    ), refunds AS (
      SELECT COUNT(*) FILTER (WHERE status = 'REQUIRES_ACTION')::int AS action,
             COUNT(*) FILTER (WHERE status = 'PENDING' AND "createdAt" <= ${ago(24)})::int AS pending
      FROM "Refund" WHERE status IN ('PENDING', 'REQUIRES_ACTION')
    )
    SELECT
      (SELECT COUNT(*)::int FROM orders_to_ship WHERE "fulfillmentStatus" = 'UNFULFILLED') AS "toPrepare",
      (SELECT COUNT(*)::int FROM orders_to_ship WHERE "fulfillmentStatus" = 'PREPARING') AS "preparing",
      (SELECT COUNT(*)::int FROM orders_to_ship WHERE "fulfillmentStatus" = 'READY_TO_SHIP') AS "readyToShip",
      (SELECT COUNT(*)::int FROM open_paid WHERE verified AND awaiting_preorder) AS "waitingPreorder",
      (SELECT COUNT(*)::int FROM orders_to_ship WHERE "paidAt" <= ${ago(48)}) AS "awaitingShipment48h",
      (SELECT COUNT(*)::int FROM open_paid WHERE NOT verified) AS "inconsistentPaidOrders",
      payments.review AS "paymentReview",
      payments.processing AS "paymentProcessing1h",
      refunds.action AS "refundActionRequired",
      refunds.pending AS "refundPending24h"
    FROM payments, refunds
  `;
  if (!counts) throw new Error('Le relevé des commandes est incomplet.');
  return { schema: 1, asOf: now.toISOString(), ...counts };
}
