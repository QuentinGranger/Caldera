import type {
  CarnetChapter,
  NewsletterCampaign,
} from '@/generated/prisma/client';
import { carnetAccessState } from './access';
import type { carnetReadiness } from './readiness';

export const EDITORIAL_STATES = [
  'Brouillon',
  'Texte prêt',
  'Prêt à envoyer',
  'Programmé',
  'Accès anticipé',
  'Public',
] as const;
export type EditorialState = (typeof EDITORIAL_STATES)[number];
export function carnetCalendarStatus(
  chapter: Pick<
    CarnetChapter,
    | 'id'
    | 'status'
    | 'earlyAccessAt'
    | 'publicAt'
    | 'publishedAt'
    | 'releaseCampaignId'
    | 'editionCampaignId'
  >,
  campaign: Pick<NewsletterCampaign, 'id' | 'status'> | null,
  release: Pick<NewsletterCampaign, 'id' | 'status'> | null,
  ready: ReturnType<typeof carnetReadiness>,
  now = new Date(),
): EditorialState {
  const access = carnetAccessState(chapter, now);
  if (access === 'public') return 'Public';
  if (access === 'early') return 'Accès anticipé';
  if (
    access === 'scheduled' &&
    (chapter.publishedAt ||
      (release?.id === chapter.releaseCampaignId &&
        ['QUEUED', 'SENDING'].includes(release.status)))
  )
    return 'Programmé';
  if (!ready.chapterReady) return 'Brouillon';
  if (
    campaign?.id === chapter.editionCampaignId &&
    campaign?.status === 'DRAFT' &&
    ready.illustrationReady &&
    ready.emailReady &&
    !ready.unavailable.length &&
    ready.testCurrent
  )
    return 'Prêt à envoyer';
  return 'Texte prêt';
}
