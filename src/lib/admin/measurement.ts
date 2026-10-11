import 'server-only';
import { requireAdmin } from './auth';
import { getPrisma } from '@/lib/db/prisma';

export async function getMeasurementOverview() {
  await requireAdmin();
  const db = getPrisma();
  const since = new Date(Date.now() - 30 * 86400000);
  const mature = new Date(Date.now() - 86400000);
  const [
    sales,
    refunds,
    payments,
    checkouts,
    completed,
    repeat,
    items,
    stock,
    campaigns,
    lifecycle,
  ] = await Promise.all([
    db.order.aggregate({
      where: { paidAt: { gte: since }, payment: { status: 'SUCCEEDED' } },
      _count: true,
      _sum: {
        totalAmount: true,
        shippingAmount: true,
        taxAmount: true,
        subtotalAmount: true,
        discountAmount: true,
      },
    }),
    db.refund.aggregate({
      where: { status: 'SUCCEEDED', succeededAt: { gte: since } },
      _sum: { amount: true },
      _count: true,
    }),
    db.payment.groupBy({
      by: ['status'],
      where: { createdAt: { gte: since } },
      _count: true,
      _sum: { amount: true },
    }),
    db.checkoutSession.count({
      where: { createdAt: { gte: since, lte: mature } },
    }),
    db.checkoutSession.count({
      where: {
        createdAt: { gte: since, lte: mature },
        order: { payment: { status: 'SUCCEEDED' } },
      },
    }),
    db.$queryRaw<
      { first: bigint; repeat: bigint }[]
    >`WITH cohort AS (SELECT o.id, EXISTS (SELECT 1 FROM "Order" prior JOIN "Payment" pp ON pp."orderId"=prior.id AND pp.status='SUCCEEDED' WHERE lower(prior.email)=lower(o.email) AND prior."paidAt"<o."paidAt") AS recurring FROM "Order" o JOIN "Payment" p ON p."orderId"=o.id AND p.status='SUCCEEDED' WHERE o."paidAt">=${since}) SELECT count(*) FILTER(WHERE NOT recurring) AS first,count(*) FILTER(WHERE recurring) AS repeat FROM cohort`,
    db.orderItem.findMany({
      where: {
        order: { paidAt: { gte: since }, payment: { status: 'SUCCEEDED' } },
      },
      select: {
        productId: true,
        productName: true,
        quantity: true,
        lineTotal: true,
        discountAmount: true,
        taxAmount: true,
        unitCost: true,
        refundItems: {
          where: { refund: { status: 'SUCCEEDED' } },
          select: { quantity: true, amount: true },
        },
      },
    }),
    db.productVariant.findMany({
      where: { isActive: true, product: { isDemonstration: false } },
      select: {
        productId: true,
        stockQuantity: true,
        reservedQuantity: true,
        product: { select: { name: true } },
      },
    }),
    db.newsletterCampaign.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        internalName: true,
        _count: { select: { deliveries: true } },
      },
    }),
    db.lifecycleDelivery.groupBy({
      by: ['kind', 'status'],
      where: { createdAt: { gte: since } },
      _count: true,
    }),
  ]);
  const products = new Map<
    string,
    {
      id: string;
      name: string;
      units: number;
      revenue: number;
      cost: number;
      knownUnits: number;
      stock: number;
    }
  >();
  for (const v of stock) {
    const p = products.get(v.productId) ?? {
      id: v.productId,
      name: v.product.name,
      units: 0,
      revenue: 0,
      cost: 0,
      knownUnits: 0,
      stock: 0,
    };
    p.stock += Math.max(0, v.stockQuantity - v.reservedQuantity);
    products.set(v.productId, p);
  }
  for (const i of items) {
    const id = i.productId ?? i.productName;
    const p = products.get(id) ?? {
      id,
      name: i.productName,
      units: 0,
      revenue: 0,
      cost: 0,
      knownUnits: 0,
      stock: 0,
    };
    const returned = i.refundItems.reduce((sum, r) => sum + r.quantity, 0);
    p.units += Math.max(0, i.quantity - returned);
    const paidLine = Number(i.lineTotal) - Number(i.discountAmount);
    const refundedLine = i.refundItems.reduce(
      (sum, r) => sum + Number(r.amount),
      0,
    );
    p.revenue +=
      paidLine -
      Number(i.taxAmount) -
      refundedLine +
      (paidLine > 0
        ? Number(i.taxAmount) * Math.min(1, refundedLine / paidLine)
        : 0);
    if (i.unitCost !== null) {
      p.knownUnits += Math.max(0, i.quantity - returned);
      p.cost += Number(i.unitCost) * Math.max(0, i.quantity - returned);
    }
    products.set(id, p);
  }
  const measurement =
    process.env.MEASUREMENT_ENABLED === 'true'
      ? await db.$queryRaw<
          {
            channel: string;
            source: string;
            campaign: string | null;
            sessions: bigint;
            visitors: bigint;
            product: bigint;
            cart: bigint;
            checkout: bigint;
            payment: bigint;
            orders: bigint;
            revenue: number;
            cartMature: bigint;
            cartAbandoned: bigint;
          }[]
        >`
    WITH paid AS (SELECT mo."sessionId", count(*) AS orders,sum(o."totalAmount") AS revenue FROM "MeasurementOrder" mo JOIN "Order" o ON o.id=mo."orderId" JOIN "Payment" p ON p."orderId"=o.id AND p.status='SUCCEEDED' GROUP BY mo."sessionId")
    SELECT s.channel,s.source,s.campaign,count(*) AS sessions,count(DISTINCT s."visitorHash") AS visitors,
      count(*) FILTER(WHERE s."productViewed") AS product,count(*) FILTER(WHERE s."cartAdded") AS cart,
      count(*) FILTER(WHERE s."checkoutStarted") AS checkout,count(*) FILTER(WHERE s."paymentStarted") AS payment,
      COALESCE(sum(p.orders),0)::bigint AS orders,COALESCE(sum(p.revenue),0)::float8 AS revenue,
      count(*) FILTER(WHERE s."cartAdded" AND s."lastSeenAt"<${mature}) AS "cartMature",
      count(*) FILTER(WHERE s."cartAdded" AND s."lastSeenAt"<${mature} AND p.orders IS NULL) AS "cartAbandoned"
    FROM "MeasurementSession" s LEFT JOIN paid p ON p."sessionId"=s.id WHERE s."startedAt">=${since} GROUP BY s.channel,s.source,s.campaign ORDER BY revenue DESC`
      : [];
  const visitors =
    process.env.MEASUREMENT_ENABLED === 'true'
      ? await db.$queryRaw<
          { count: bigint; orders: bigint }[]
        >`SELECT count(DISTINCT s."visitorHash") AS count, (SELECT count(*) FROM "MeasurementOrder" mo JOIN "Order" o ON o.id=mo."orderId" JOIN "Payment" p ON p."orderId"=o.id AND p.status='SUCCEEDED' JOIN "MeasurementSession" ms ON ms.id=mo."sessionId" WHERE ms."startedAt">=${since}) AS orders FROM "MeasurementSession" s WHERE s."startedAt">=${since}`
      : [];
  return {
    measurement,
    visitors: Number(visitors[0]?.count ?? 0),
    attributedOrders: Number(visitors[0]?.orders ?? 0),
    since,
    sales,
    refunds,
    payments,
    checkouts,
    completed,
    repeat: repeat[0],
    products: [...products.values()]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 50),
    campaigns: await Promise.all(
      campaigns.map(async (campaign) => ({
        ...campaign,
        sent: await db.newsletterCampaignDelivery.count({
          where: { campaignId: campaign.id, status: 'SENT' },
        }),
      })),
    ),
    lifecycle,
  };
}
