import 'server-only';
import { getPrisma } from '@/lib/db/prisma';
import type { Prisma } from '@/generated/prisma/client';
import { carnetAccessState, verifyCarnetAccess } from './access';
import { carnetSummarySelect } from './public';
import { carnetUrl } from './content';
import { identifyCarnetClick } from './analytics-links';
import { trackingAllowed } from '@/lib/email/engagement';
const uuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);

/** Only an existing signed, consented measurement session may create reading observations. */
export async function recordCarnetReading(
  sessionId: string,
  input: {
    event: string;
    chapterId?: unknown;
    access?: unknown;
    variantId?: unknown;
  },
  now = new Date(),
) {
  return getPrisma().$transaction(async (tx) => {
    const locked = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM "MeasurementSession" WHERE id=${sessionId}::uuid FOR UPDATE`;
    if (!locked.length) return;
    const session = await tx.measurementSession.findUniqueOrThrow({
      where: { id: sessionId },
    });
    if (input.event === 'view_item') {
      if (!uuid(input.variantId)) return;
      const variant = await tx.productVariant.findFirst({
        where: {
          id: input.variantId,
          isActive: true,
          product: {
            status: 'ACTIVE',
            isDemonstration: false,
            category: { isActive: true },
          },
        },
        select: { id: true },
      });
      if (!variant) return;
      const reading = await tx.carnetReading.findFirst({
        where: {
          session: { visitorHash: session.visitorHash },
          viewedAt: { gte: new Date(now.getTime() - 86400000), lte: now },
        },
        orderBy: [{ viewedAt: 'desc' }, { id: 'desc' }],
        select: { id: true },
      });
      if (reading)
        await tx.carnetReading.updateMany({
          where: { id: reading.id, productViewedAt: null },
          data: { productViewedAt: now },
        });
      return;
    }
    if (!uuid(input.chapterId)) return;
    const chapter = await tx.carnetChapter.findUnique({
      where: { id: input.chapterId },
      select: carnetSummarySelect,
    });
    if (
      !chapter ||
      !(
        carnetAccessState(chapter, now) === 'public' ||
        verifyCarnetAccess(chapter, input.access, now)
      )
    )
      return;
    if (input.event === 'carnet_view')
      await tx.carnetReading.upsert({
        where: { sessionId_chapterId: { sessionId, chapterId: chapter.id } },
        create: { sessionId, chapterId: chapter.id, viewedAt: now },
        update: {},
      });
    if (input.event === 'carnet_complete')
      await tx.carnetReading.updateMany({
        where: {
          sessionId,
          chapterId: chapter.id,
          completedAt: null,
          viewedAt: { lte: new Date(now.getTime() - 20000) },
        },
        data: { completedAt: now },
      });
  });
}

/** Caller has verified the Resend signature. Recheck consent under the delivery lock. */
export async function recordCarnetEmailClick(
  deliveryId: string,
  raw: unknown,
  occurredAt: Date,
  now = new Date(),
) {
  await getPrisma().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "NewsletterCampaignDelivery" WHERE id=${deliveryId}::uuid FOR UPDATE`;
    const delivery = await tx.newsletterCampaignDelivery.findUnique({
      where: { id: deliveryId },
      include: { subscriber: true, campaign: { include: { chapter: true } } },
    });
    if (
      !delivery?.trackingEnabled ||
      !delivery.trackingConsentAt ||
      !trackingAllowed(delivery.subscriber, now) ||
      delivery.subscriber.emailTrackingConsentAt! >
        delivery.trackingConsentAt ||
      !delivery.campaign.chapter
    )
      return;
    const products = (
      Array.isArray(delivery.campaign.carnetProducts)
        ? delivery.campaign.carnetProducts
        : []
    )
      .filter((p): p is Prisma.JsonObject =>
        Boolean(p && typeof p === 'object' && !Array.isArray(p)),
      )
      .flatMap((p) =>
        typeof p.id === 'string' && typeof p.href === 'string'
          ? [{ id: p.id, href: p.href }]
          : [],
      );
    const click = identifyCarnetClick(raw, delivery.campaignId, {
      storyPath: carnetUrl(delivery.campaign.chapter.slug),
      products,
    });
    if (!click) return;
    await tx.carnetEmailClick.upsert({
      where: { deliveryId_linkKey: { deliveryId, linkKey: click.linkKey } },
      create: { deliveryId, ...click, clickedAt: occurredAt },
      update: {},
    });
  });
}
