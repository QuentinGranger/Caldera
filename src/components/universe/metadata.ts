// Metadata of /univers and its chronicles: canonical, robots and og:image
// (only an illustration actually published in public/).
import type { Metadata } from 'next';
import {
  editorialDecision,
  editorialMetadata,
  fittingTitle,
  lowerFirst,
} from '@/components/editorial/editorial';
import {
  getUniverseChapter,
  universeChapterPath,
  universeImage,
  universeIndex,
  type UniverseChapterSlug,
  type UniverseImage,
} from '@/data/universe';
import type { MetadataImage } from '@/lib/seo/metadata';

const shareImage = (image: UniverseImage | null): MetadataImage | null =>
  image && {
    url: image.src,
    alt: image.alt || undefined,
    width: image.width,
    height: image.height,
  };

/** « Origines : là où la terre s’est ouverte », within TITLE_MAX. */
export function universeChapterTitle(slug: UniverseChapterSlug): string {
  const chapter = getUniverseChapter(slug);
  return fittingTitle(
    `${chapter.title} : ${lowerFirst(chapter.label)}`,
    `${chapter.title} : chronique ${chapter.number} de l’univers`,
  );
}

export function universeChapterMetadata(
  slug: UniverseChapterSlug,
  description: string,
): Metadata {
  const chapter = getUniverseChapter(slug);
  return editorialMetadata({
    title: universeChapterTitle(slug),
    description,
    decision: editorialDecision(universeChapterPath(slug)),
    image: shareImage(universeImage(chapter.hero.src, chapter.hero.alt)),
    type: 'article',
  });
}

export function universeIndexMetadata(): Metadata {
  return editorialMetadata({
    title: universeIndex.title,
    description: universeIndex.description,
    decision: editorialDecision(universeIndex.path),
    image: shareImage(
      universeImage(universeIndex.hero.src, universeIndex.hero.alt),
    ),
  });
}
