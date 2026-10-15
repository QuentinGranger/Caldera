import 'server-only';
import type {
  CarnetChapter,
  NewsletterCampaign,
  Prisma,
} from '@/generated/prisma/client';
import { AdminError } from '@/lib/admin/validation';
import { renderNewsletterCampaignEmail } from '@/emails/newsletter-campaign';
import { parseCarnetContent, deriveCarnet, carnetUrl } from './content';
import { appOrigin } from '@/lib/orders/access';
import { carnetAccessToken, carnetAccessUrl } from './access';
import { carnetEmailContent } from './email';
import type { CarnetProduct } from './comptoir';
import { carnetPublicDate } from './dates';
export function assertCarnetReady(chapter: CarnetChapter) {
  if (!['READY', 'EARLY_ACCESS', 'PUBLIC'].includes(chapter.status))
    throw new AdminError(
      'Le Carnet doit être prêt éditorialement avant la diffusion.',
    );
  const derived = deriveCarnet(parseCarnetContent(chapter.content));
  if (!derived.excerpt?.words || derived.full.words <= derived.excerpt.words)
    throw new AdminError('Ajoutez une coupure avec du récit avant et après.');
  return derived.excerpt;
}
// All callers lock the campaign first, then the chapter (same order as the worker).
export async function planCarnetRelease(
  tx: Prisma.TransactionClient,
  campaign: NewsletterCampaign,
  start: Date,
) {
  if (!campaign.chapterId) return null;
  await tx.$queryRaw`SELECT id FROM "CarnetChapter" WHERE id=${campaign.chapterId}::uuid FOR UPDATE`;
  const chapter = await tx.carnetChapter.findUniqueOrThrow({
    where: { id: campaign.chapterId },
  });
  assertCarnetReady(chapter);
  if (chapter.publishedAt) return chapter; // Subsequent campaigns cannot move the first release.
  if (chapter.releaseCampaignId && chapter.releaseCampaignId !== campaign.id)
    throw new AdminError(
      'Une autre campagne pilote déjà la diffusion de ce Carnet.',
    );
  const planned = {
    ...chapter,
    earlyAccessAt: start,
    publicAt: carnetPublicDate(start),
    releaseCampaignId: campaign.id,
  };
  carnetAccessToken(planned); // Fail before queuing if the signing configuration is unavailable.
  return tx.carnetChapter.update({
    where: { id: chapter.id },
    data: {
      earlyAccessAt: planned.earlyAccessAt,
      publicAt: planned.publicAt,
      releaseCampaignId: campaign.id,
      revision: { increment: 1 },
    },
  });
}
export async function freezeCarnetRelease(
  tx: Prisma.TransactionClient,
  campaign: NewsletterCampaign,
  now: Date,
) {
  if (!campaign.chapterId) return;
  await tx.$queryRaw`SELECT id FROM "CarnetChapter" WHERE id=${campaign.chapterId}::uuid FOR UPDATE`;
  const chapter = await tx.carnetChapter.findUniqueOrThrow({
    where: { id: campaign.chapterId },
  });
  assertCarnetReady(chapter);
  if (chapter.publishedAt) return;
  if (
    chapter.releaseCampaignId !== campaign.id ||
    !chapter.earlyAccessAt ||
    !chapter.publicAt
  )
    throw new AdminError(
      'Calendrier Carnet incohérent : vérifiez la programmation.',
    );
  const early =
    campaign.sendImmediately && now < chapter.publicAt
      ? now
      : chapter.earlyAccessAt;
  await tx.carnetChapter.update({
    where: { id: chapter.id },
    data: {
      earlyAccessAt: early,
      publicAt: carnetPublicDate(early),
      publishedAt: now,
      revision: { increment: 1 },
    },
  });
}
export function renderCarnetCampaign(
  campaign: NewsletterCampaign,
  chapter: CarnetChapter,
  urls: { logo: string; unsubscribe?: string },
  trackingEnabled = true,
) {
  assertCarnetReady(chapter);
  const href =
    chapter.earlyAccessAt &&
    chapter.publicAt &&
    (chapter.releaseCampaignId || chapter.publishedAt)
      ? carnetAccessUrl(chapter)
      : `${appOrigin()}${carnetUrl(chapter.slug)}`;
  if (campaign.carnetCustomized) {
    // Sign only this chapter's canonical path; preserve its functional query and fragment.
    const clean = carnetUrl(chapter.slug);
    const storyHref = (input: string) => {
      try {
        const url = new URL(input, appOrigin());
        if (
          url.origin !== new URL(appOrigin()).origin ||
          url.pathname !== clean
        )
          return input;
        const signed = new URL(href);
        if (signed.searchParams.has('access'))
          url.searchParams.set('access', signed.searchParams.get('access')!);
        // Relative form also makes local previews use the canonical public marketing origin.
        return url.pathname + url.search + url.hash;
      } catch {
        return input;
      }
    };
    const bodyMarkdown = campaign.bodyMarkdown.replace(
      /"href":"([^"\\]*)"/g,
      (match, url: string) => `"href":${JSON.stringify(storyHref(url))}`,
    );
    return renderNewsletterCampaignEmail(
      {
        ...campaign,
        bodyMarkdown,
        campaignId: campaign.id,
        trackingEnabled,
        carnetLinks: {
          number: chapter.number,
          storyPath: carnetUrl(chapter.slug),
          products: Array.isArray(campaign.carnetProducts)
            ? (campaign.carnetProducts as unknown as CarnetProduct[])
            : [],
        },
        ctaUrl: campaign.ctaUrl ? storyHref(campaign.ctaUrl) : null,
      },
      urls,
    );
  }
  const products = Array.isArray(campaign.carnetProducts)
    ? (campaign.carnetProducts as unknown as CarnetProduct[])
    : [];
  return renderNewsletterCampaignEmail(
    {
      ...carnetEmailContent(
        { ...chapter, content: parseCarnetContent(chapter.content) },
        products,
        campaign,
        href,
      ),
      campaignId: campaign.id,
      trackingEnabled,
    },
    urls,
  );
}
