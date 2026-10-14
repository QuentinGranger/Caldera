import type {
  CarnetChapter,
  NewsletterCampaign,
} from '@/generated/prisma/client';
import type { CarnetProduct } from './comptoir';
import { deriveCarnet, parseCarnetContent } from './content';

type Chapter = Pick<
  CarnetChapter,
  | 'content'
  | 'status'
  | 'revision'
  | 'updatedAt'
  | 'illustrationUrl'
  | 'illustrationAlt'
>;
type Campaign = Pick<NewsletterCampaign, 'subject' | 'preheader' | 'updatedAt'>;
export type EditorialTest = { createdAt: Date; metadata: unknown } | null;

/** Shared by the production dashboard and calendar; dates alone never validate a test. */
export function carnetReadiness(
  chapter: Chapter,
  campaign: Campaign | null,
  products: Pick<CarnetProduct, 'name' | 'eligible' | 'unavailableReason'>[],
  lastTest: EditorialTest,
) {
  let words = 0,
    excerptWords = 0;
  try {
    const derived = deriveCarnet(parseCarnetContent(chapter.content));
    words = derived.full.words;
    excerptWords = derived.excerpt?.words ?? 0;
  } catch {
    // Invalid legacy documents remain visible as editorial work to finish.
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
        'campaignUpdatedAt' in versioned &&
        versioned.campaignUpdatedAt === campaign.updatedAt.toISOString()
      : lastTest.createdAt >= chapter.updatedAt &&
        lastTest.createdAt >= campaign.updatedAt),
  );
  const excerptReady = excerptWords > 0 && words > excerptWords;
  const chapterReady =
    ['READY', 'EARLY_ACCESS', 'PUBLIC'].includes(chapter.status) &&
    excerptReady;
  const illustrationReady = Boolean(
    chapter.illustrationUrl && chapter.illustrationAlt?.trim(),
  );
  const unavailable = products
    .filter((product) => !product.eligible)
    .map(({ name, unavailableReason }) => ({
      name,
      reason: unavailableReason,
    }));
  const emailReady = Boolean(
    campaign?.subject.trim() && campaign.preheader?.trim(),
  );
  return {
    chapterReady,
    excerptReady,
    excerptWords,
    illustrationReady,
    unavailable,
    emailReady,
    testCurrent,
  };
}
