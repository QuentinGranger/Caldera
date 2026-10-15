import type { CarnetChapter } from '@/generated/prisma/client';
import { carnetAccessState } from './access';
import { deriveCarnet, parseCarnetContent } from './content';

export type ArcChapter = Pick<
  CarnetChapter,
  | 'id'
  | 'number'
  | 'title'
  | 'arcTitle'
  | 'arcPosition'
  | 'arcTotal'
  | 'status'
  | 'updatedAt'
  | 'earlyAccessAt'
  | 'publicAt'
  | 'publishedAt'
  | 'releaseCampaignId'
>;
export const arcTitleKey = (title: string) =>
  title
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('fr-FR');
export const tidyArcTitle = (title: string) =>
  title.normalize('NFKC').trim().replace(/\s+/g, ' ');
export function groupCarnetArcs(chapters: ArcChapter[]) {
  const groups = new Map<
    string,
    { key: string; title: string | null; chapters: ArcChapter[] }
  >();
  for (const chapter of [...chapters].sort((a, b) => a.number - b.number)) {
    const title = chapter.arcTitle ? tidyArcTitle(chapter.arcTitle) : '';
    const key = title ? `arc:${arcTitleKey(title)}` : 'unassigned';
    const group = groups.get(key) ?? {
      key,
      title: title || null,
      chapters: [],
    };
    group.chapters.push(chapter);
    groups.set(key, group);
  }
  let number = 0;
  return [...groups.values()]
    .sort(
      (a, b) =>
        Number(!a.title) - Number(!b.title) ||
        a.chapters[0]!.number - b.chapters[0]!.number,
    )
    .map((group) => {
      const declared = [
        ...new Set(
          group.chapters.flatMap((c) => (c.arcTotal ? [c.arcTotal] : [])),
        ),
      ];
      const positions = group.chapters.flatMap((c) =>
        c.arcPosition ? [c.arcPosition] : [],
      );
      const total = Math.max(group.chapters.length, ...declared, ...positions);
      const missing = group.title
        ? Array.from({ length: total }, (_, i) => i + 1).filter(
            (p) => !positions.includes(p),
          )
        : [];
      const warnings = [
        ...(declared.length > 1
          ? ['Les chapitres déclarent des totaux d’arc différents.']
          : []),
        ...(new Set(positions).size < positions.length
          ? ['Plusieurs chapitres occupent la même position.']
          : []),
        ...(declared.length &&
        Math.max(...declared) < Math.max(group.chapters.length, ...positions)
          ? ['Le nombre de chapitres ou une position dépasse le total déclaré.']
          : []),
        ...(group.title && group.chapters.some((c) => !c.arcPosition)
          ? ['Certains chapitres n’ont pas de position dans l’arc.']
          : []),
      ];
      return {
        ...group,
        number: group.title ? ++number : null,
        total,
        declared: declared.length > 0,
        missing: warnings.length ? [] : missing,
        warnings,
        updatedAt: new Date(
          Math.max(...group.chapters.map((c) => c.updatedAt.getTime())),
        ),
        chapters: group.chapters.sort(
          (a, b) =>
            (a.arcPosition ?? Infinity) - (b.arcPosition ?? Infinity) ||
            a.number - b.number,
        ),
      };
    });
}

export function arcChapterState(
  chapter: ArcChapter & Pick<CarnetChapter, 'content'>,
  now = new Date(),
) {
  if (chapter.status === 'ARCHIVED')
    return { kind: 'ARCHIVED' as const, label: 'Archivé' };
  const access = carnetAccessState(chapter, now);
  if (access === 'public') return { kind: 'PUBLIC' as const, label: 'Public' };
  if (access === 'early')
    return { kind: 'EARLY' as const, label: 'Accès anticipé' };
  try {
    const text = deriveCarnet(parseCarnetContent(chapter.content));
    if (
      ['READY', 'EARLY_ACCESS', 'PUBLIC'].includes(chapter.status) &&
      text.excerpt?.words &&
      text.full.words > text.excerpt.words
    )
      return {
        kind: 'READY' as const,
        label: 'Prêt',
      };
    return text.full.words
      ? { kind: 'WORKING' as const, label: 'En cours' }
      : { kind: 'EMPTY' as const, label: 'Pas commencé' };
  } catch {
    return { kind: 'WORKING' as const, label: 'À compléter' };
  }
}

/** Prefill only; opening a gap never creates a chapter or reserves an episode number. */
export function arcDraftDefaults(input: Record<string, unknown>) {
  const title =
    typeof input.arcTitle === 'string' ? tidyArcTitle(input.arcTitle) : '';
  const valid = (value: unknown) =>
    typeof value === 'string' &&
    /^\d{1,4}$/.test(value) &&
    Number(value) >= 1 &&
    Number(value) <= 1000
      ? String(Number(value))
      : '';
  const position = valid(input.arcPosition),
    total = valid(input.arcTotal);
  return {
    arcTitle: title.length <= 200 ? title : '',
    arcPosition: position,
    arcTotal:
      total && (!position || Number(total) >= Number(position)) ? total : '',
  };
}
