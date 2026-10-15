import 'server-only';
import { createHash } from 'node:crypto';
import type {
  CarnetChapter,
  NewsletterCampaign,
  Prisma,
} from '@/generated/prisma/client';
import type { CarnetProduct } from './comptoir';
import {
  carnetReadiness,
  carnetChecklist,
  carnetProductTestValue,
} from './readiness';
import { carnetAccessToken, verifyCarnetAccess } from './access';
import { carnetPublicDate } from './dates';
import { parseCarnetContent, carnetUrl } from './content';
import { appOrigin } from '@/lib/orders/access';
import { AdminError } from '@/lib/admin/validation';

/** Editorial proof only. Queue/worker metadata and stock quantity changes don't change the tested email. */
export function carnetTestSignature(
  chapter: CarnetChapter,
  campaign: NewsletterCampaign,
  products: CarnetProduct[],
) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        number: chapter.number,
        title: chapter.title,
        slug: chapter.slug,
        arcTitle: chapter.arcTitle,
        arcPosition: chapter.arcPosition,
        arcTotal: chapter.arcTotal,
        content: parseCarnetContent(chapter.content),
        image: chapter.illustrationUrl,
        alt: chapter.illustrationAlt,
        subject: campaign.subject,
        preheader: campaign.preheader,
        customized: campaign.carnetCustomized,
        ...(campaign.carnetCustomized
          ? {
              heading: campaign.heading,
              body: campaign.bodyMarkdown,
              ctaLabel: campaign.ctaLabel,
              ctaUrl: campaign.ctaUrl,
            }
          : {}),
        products: products.map(carnetProductTestValue),
      }),
    )
    .digest('hex');
}
export function carnetAccessConfigured(
  chapter: CarnetChapter,
  campaign: NewsletterCampaign,
) {
  try {
    new URL(carnetUrl(chapter.slug), appOrigin());
    const early = chapter.earlyAccessAt ?? new Date(Date.now() + 3600000);
    const virtual = {
      ...chapter,
      status: 'READY',
      earlyAccessAt: early,
      publicAt: carnetPublicDate(early),
      releaseCampaignId: campaign.id,
    };
    return verifyCarnetAccess(virtual, carnetAccessToken(virtual), early);
  } catch {
    return false;
  }
}
export async function carnetVerificationContext(
  db: Prisma.TransactionClient,
  chapter: CarnetChapter,
  campaign: NewsletterCampaign | null,
  products: CarnetProduct[],
) {
  if (!campaign)
    return { testCurrent: false, testSentAt: null, accessConfigured: false };
  const test = await db.adminAuditLog.findFirst({
    where: {
      action: 'NEWSLETTER_CAMPAIGN_TEST_SENT',
      entityType: 'NewsletterCampaign',
      entityId: campaign.id,
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { createdAt: true, metadata: true },
  });
  const metadata = test?.metadata;
  const signature =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? metadata.carnetTestSignature
      : null;
  let testCurrent = false;
  try {
    testCurrent =
      typeof signature === 'string'
        ? signature ===
          carnetTestSignature(
            chapter,
            campaign,
            campaign.status === 'DRAFT'
              ? products
              : Array.isArray(campaign.carnetProducts)
                ? (campaign.carnetProducts as unknown as CarnetProduct[])
                : [],
          )
        : Boolean(
            metadata &&
            typeof metadata === 'object' &&
            !Array.isArray(metadata) &&
            'chapterRevision' in metadata &&
            'campaignUpdatedAt' in metadata &&
            carnetReadiness(chapter, campaign, products, test).testCurrent,
          );
  } catch {}
  return {
    testCurrent,
    testSentAt: test?.createdAt.toISOString() ?? null,
    accessConfigured: carnetAccessConfigured(chapter, campaign),
  };
}
export async function assertCarnetDeparture(
  db: Prisma.TransactionClient,
  chapter: CarnetChapter,
  campaign: NewsletterCampaign,
  products: CarnetProduct[],
  scheduledAt: Date,
) {
  const context = await carnetVerificationContext(
    db,
    chapter,
    campaign,
    products,
  );
  const projected = chapter.publishedAt
    ? chapter
    : {
        ...chapter,
        earlyAccessAt: scheduledAt,
        publicAt: carnetPublicDate(scheduledAt),
      };
  const checklist = carnetChecklist(projected, campaign, products, {
    ...context,
    scheduleValidated: true,
  });
  if (!checklist.canSchedule)
    throw new AdminError(
      `Programmation bloquée : ${checklist.blocking.map((c) => `${c.label} — ${c.detail}`).join(' · ')}`,
    );
}

export function assertCarnetTestable(
  chapter: CarnetChapter,
  campaign: NewsletterCampaign,
  products: CarnetProduct[],
) {
  const check = carnetChecklist(chapter, campaign, products, {
    testCurrent: false,
    accessConfigured: false,
  });
  const blockers = check.blocking.filter(
    (rule) => !['test', 'access', 'public'].includes(rule.key),
  );
  if (blockers.length)
    throw new AdminError(
      `Test bloqué : ${blockers.map((c) => `${c.label} — ${c.detail}`).join(' · ')}`,
    );
}
