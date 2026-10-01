import 'server-only';
import * as Sentry from '@sentry/nextjs';
import { ContentError, getAllContent } from '@/lib/content';
import type { InterludeContent } from './CatalogInterlude';
import type { Teaser } from './pageCopy';

/**
 * The guide of an aisle as an interlude: its own title and summary, « Lire
 * le guide ». Nothing when the guide is missing or the content unreadable:
 * the page renders without it.
 */
export async function teaserContent(
  teaser: Teaser | undefined,
): Promise<InterludeContent | null> {
  if (!teaser) return null;
  try {
    const entry = (await getAllContent()).find(
      (candidate) => candidate.href === `/guides/${teaser.guide}`,
    );
    return entry
      ? {
          image: teaser.image,
          eyebrow: teaser.eyebrow,
          title: entry.title,
          text: entry.description,
          link: { href: entry.href, label: 'Lire le guide' },
        }
      : null;
  } catch (error) {
    if (!(error instanceof ContentError)) throw error;
    Sentry.captureException(error);
    return null;
  }
}
