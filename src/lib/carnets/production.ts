import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { requireAdmin } from '@/lib/admin/auth';
import { getPrisma } from '@/lib/db/prisma';
import { chapterComptoir } from './comptoir';
import { carnetVerificationContext } from './verification-server';
import { carnetReadiness } from './readiness';

/** Started releases are managed in Campaigns, never counted as editorial reserve. */
export const upcomingCarnets = {
  status: { in: ['DRAFT', 'READY'] },
  publishedAt: null,
  campaigns: {
    none: { deliveries: { some: { status: { in: ['SENT', 'SENDING'] } } } },
  },
} satisfies Prisma.CarnetChapterWhereInput;

export async function readEditorialProduction(db: Prisma.TransactionClient) {
  const [chapter, readyCount] = await Promise.all([
    db.carnetChapter.findFirst({
      where: upcomingCarnets,
      orderBy: [
        { earlyAccessAt: { sort: 'asc', nulls: 'last' } },
        { number: 'asc' },
      ],
      include: { editionCampaign: true, releaseCampaign: true },
    }),
    db.carnetChapter.count({ where: { ...upcomingCarnets, status: 'READY' } }),
  ]);
  if (!chapter) return { readyCount, monthsAhead: readyCount / 2, next: null };
  // Explicit ownership only: a later commercial campaign must not validate this edition.
  const campaign = chapter.editionCampaign ?? chapter.releaseCampaign;
  const [products, lastTest] = await Promise.all([
    chapterComptoir(db, chapter.id, false),
    campaign
      ? db.adminAuditLog.findFirst({
          where: {
            action: 'NEWSLETTER_CAMPAIGN_TEST_SENT',
            entityType: 'NewsletterCampaign',
            entityId: campaign.id,
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: { createdAt: true, metadata: true },
        })
      : null,
  ]);
  const readiness = carnetReadiness(chapter, campaign, products, lastTest);
  const metadata = lastTest?.metadata;
  if (
    metadata &&
    typeof metadata === 'object' &&
    !Array.isArray(metadata) &&
    typeof metadata.carnetTestSignature === 'string'
  ) {
    readiness.testCurrent = (
      await carnetVerificationContext(db, chapter, campaign, products)
    ).testCurrent;
  }
  return {
    readyCount,
    monthsAhead: readyCount / 2,
    next: {
      id: chapter.id,
      number: chapter.number,
      title: chapter.title,
      arcTitle: chapter.arcTitle,
      arcPosition: chapter.arcPosition,
      arcTotal: chapter.arcTotal,
      revision: chapter.revision,
      campaignUpdatedAt:
        chapter.editionCampaign?.updatedAt.toISOString() ?? null,
      campaignId: campaign?.id ?? null,
      campaignStatus: campaign?.status ?? null,
      newsletterAt: chapter.earlyAccessAt ?? campaign?.scheduledAt ?? null,
      publicAt: chapter.publicAt,
      ...readiness,
      productCount: products.length,
      lastTestAt: lastTest?.createdAt ?? null,
      customized: campaign?.carnetCustomized ?? false,
      canTest: Boolean(
        chapter.editionCampaign &&
        readiness.chapterReady &&
        readiness.illustrationReady &&
        readiness.emailReady &&
        !readiness.unavailable.length,
      ),
    },
  };
}

export async function getEditorialProduction() {
  await requireAdmin();
  return getPrisma().$transaction(readEditorialProduction, {
    isolationLevel: 'RepeatableRead',
  });
}

export type EditorialProduction = Awaited<
  ReturnType<typeof readEditorialProduction>
>;
