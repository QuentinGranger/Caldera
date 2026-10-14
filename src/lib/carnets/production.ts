import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { requireAdmin } from '@/lib/admin/auth';
import { getPrisma } from '@/lib/db/prisma';
import { chapterComptoir } from './comptoir';
import { deriveCarnet, parseCarnetContent } from './content';

/** Started releases are managed in Campaigns, never counted as editorial reserve. */
const upcoming = {
  status: { in: ['DRAFT', 'READY'] },
  publishedAt: null,
  campaigns: {
    none: { deliveries: { some: { status: { in: ['SENT', 'SENDING'] } } } },
  },
} satisfies Prisma.CarnetChapterWhereInput;

export async function readEditorialProduction(db: Prisma.TransactionClient) {
  const [chapter, readyCount] = await Promise.all([
    db.carnetChapter.findFirst({
      where: upcoming,
      orderBy: [
        { earlyAccessAt: { sort: 'asc', nulls: 'last' } },
        { number: 'asc' },
      ],
      include: { editionCampaign: true, releaseCampaign: true },
    }),
    db.carnetChapter.count({ where: { ...upcoming, status: 'READY' } }),
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
  let words = 0,
    excerptWords = 0;
  try {
    const derived = deriveCarnet(parseCarnetContent(chapter.content));
    words = derived.full.words;
    excerptWords = derived.excerpt?.words ?? 0;
  } catch {
    // An invalid legacy document is an editorial task, not a broken dashboard.
  }
  const metadata = lastTest?.metadata;
  const versioned =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? metadata
      : null;
  const testCurrent = Boolean(
    campaign &&
    lastTest &&
    (versioned && 'chapterRevision' in versioned
      ? versioned.chapterRevision === chapter.revision &&
        versioned.campaignUpdatedAt === campaign.updatedAt.toISOString()
      : lastTest.createdAt >= chapter.updatedAt &&
        lastTest.createdAt >= campaign.updatedAt),
  );
  const chapterReady =
    chapter.status === 'READY' && words > excerptWords && excerptWords > 0;
  const illustrationReady = Boolean(
    chapter.illustrationUrl && chapter.illustrationAlt?.trim(),
  );
  const unavailable = products.filter((product) => !product.eligible);
  const emailReady = Boolean(
    campaign?.subject.trim() && campaign.preheader?.trim(),
  );
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
      chapterReady,
      excerptReady: excerptWords > 0 && words > excerptWords,
      excerptWords,
      illustrationReady,
      productCount: products.length,
      unavailable: unavailable.map(({ name, unavailableReason }) => ({
        name,
        reason: unavailableReason,
      })),
      testCurrent,
      lastTestAt: lastTest?.createdAt ?? null,
      emailReady,
      customized: campaign?.carnetCustomized ?? false,
      canTest: Boolean(
        chapter.editionCampaign &&
        chapterReady &&
        illustrationReady &&
        emailReady &&
        !unavailable.length,
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
