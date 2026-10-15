import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { requireAdmin } from '@/lib/admin/auth';
import { uuid } from '@/lib/admin/validation';
import { getPrisma } from '@/lib/db/prisma';
import { carnetAccessState } from './access';
export async function readCarnetAnalytics(
  db: Prisma.TransactionClient,
  chapterId: string,
  now = new Date(),
) {
  const chapter = await db.carnetChapter.findUnique({
    where: { id: chapterId },
    select: { id: true, number: true, title: true },
  });
  if (!chapter) return null;
  const since = new Date(now.getTime() - 90 * 86400000);
  const rows = await db.$queryRaw<
    { readers: bigint; complete: bigint; product: bigint }[]
  >`
    SELECT count(DISTINCT s."visitorHash") AS readers,
      count(DISTINCT s."visitorHash") FILTER(WHERE r."completedAt" IS NOT NULL) AS complete,
      count(DISTINCT s."visitorHash") FILTER(WHERE r."productViewedAt" IS NOT NULL) AS product
    FROM "CarnetReading" r JOIN "MeasurementSession" s ON s.id=r."sessionId"
    WHERE r."chapterId"=${chapterId}::uuid AND r."viewedAt">=${since} AND r."viewedAt"<=${now}`;
  const clickRows = await db.$queryRaw<
    { linkKey: string; productId: string | null; count: bigint }[]
  >`
    SELECT k."linkKey", k."productId", count(*) AS count FROM "CarnetEmailClick" k
    JOIN "NewsletterCampaignDelivery" d ON d.id=k."deliveryId"
    JOIN "NewsletterCampaign" c ON c.id=d."campaignId"
    JOIN "NewsletterSubscriber" s ON s.id=d."subscriberId"
    WHERE c."chapterId"=${chapterId}::uuid AND k."clickedAt">=${since} AND k."clickedAt"<=${now}
      AND d."trackingEnabled" AND d."trackingConsentAt" IS NOT NULL
      AND s.status='ACTIVE' AND s."emailTracking" AND s."emailTrackingConsentAt" IS NOT NULL
      AND s."emailTrackingConsentAt">=${new Date(now.getTime() - 180 * 86400000)}
      AND s."emailTrackingConsentAt"<=d."trackingConsentAt" AND s."emailTrackingConsentAt"<=${now}
    GROUP BY k."linkKey", k."productId"`;
  const clicks = clickRows.map((row) => ({
    ...row,
    _count: Number(row.count),
  }));
  const productIds = clicks.flatMap((c) => (c.productId ? [c.productId] : []));
  const products = await db.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, productType: true },
  });
  const retention = await db.$queryRaw<
    {
      id: string;
      number: number;
      title: string;
      status: string;
      earlyAccessAt: Date | null;
      publicAt: Date | null;
      publishedAt: Date | null;
      releaseCampaignId: string | null;
      readers: bigint;
    }[]
  >`
    WITH cohort AS (
      SELECT s."visitorHash",min(r."viewedAt") AS first FROM "CarnetReading" r
      JOIN "MeasurementSession" s ON s.id=r."sessionId"
      WHERE r."chapterId"=${chapterId}::uuid AND r."viewedAt">=${since} AND r."viewedAt"<=${now} GROUP BY s."visitorHash"
    ) SELECT c.id,c.number,c.title,c.status,c."earlyAccessAt",c."publicAt",c."publishedAt",c."releaseCampaignId",
      count(DISTINCT s."visitorHash") FILTER(WHERE b."visitorHash" IS NOT NULL AND r."viewedAt">b.first) AS readers
    FROM "CarnetChapter" c LEFT JOIN "CarnetReading" r ON r."chapterId"=c.id AND r."viewedAt">=${since} AND r."viewedAt"<=${now}
    LEFT JOIN "MeasurementSession" s ON s.id=r."sessionId" LEFT JOIN cohort b ON b."visitorHash"=s."visitorHash"
    WHERE c.number>${chapter.number} AND c.status<>'ARCHIVED' GROUP BY c.id ORDER BY c.number`;
  const email = await db.newsletterCampaignDelivery.aggregate({
    where: {
      campaign: { chapterId },
      trackingEnabled: true,
      status: 'SENT',
      sentAt: { gte: since, lte: now },
    },
    _count: { _all: true, deliveredAt: true, openedAt: true, clickedAt: true },
  });
  const total = Number(rows[0]?.readers ?? 0);
  return {
    chapter,
    since,
    readers: total,
    completed: Number(rows[0]?.complete ?? 0),
    productReaders: Number(rows[0]?.product ?? 0),
    storyClicks: clicks
      .filter((c) => c.linkKey === 'story_continue')
      .reduce((sum, c) => sum + c._count, 0),
    products: products
      .map((product) => ({
        productId: product.id,
        name: product.name,
        type: product.productType as string | null,
        linkKey: clicks
          .filter((c) => c.productId === product.id)
          .map((c) => c.linkKey)
          .join(', '),
        clicks: clicks
          .filter((c) => c.productId === product.id)
          .reduce((sum, c) => sum + c._count, 0),
      }))
      .concat(
        [
          ...new Set(
            productIds.filter((id) => !products.some((p) => p.id === id)),
          ),
        ].map((id) => ({
          productId: id,
          name: 'Produit supprimé',
          type: null,
          linkKey: clicks
            .filter((c) => c.productId === id)
            .map((c) => c.linkKey)
            .join(', '),
          clicks: clicks
            .filter((c) => c.productId === id)
            .reduce((sum, c) => sum + c._count, 0),
        })),
      ),
    retention: retention.map((row) => ({
      id: row.id,
      number: row.number,
      title: row.title,
      readers: Number(row.readers),
      rate: total ? Number(row.readers) / total : null,
      state: carnetAccessState(row, now),
    })),
    email: email._count,
  };
}
export async function getCarnetAnalytics(id: string) {
  await requireAdmin();
  try {
    uuid(id);
  } catch {
    return null;
  }
  return getPrisma().$transaction((tx) => readCarnetAnalytics(tx, id), {
    isolationLevel: 'RepeatableRead',
  });
}
