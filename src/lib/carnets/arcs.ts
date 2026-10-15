import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { requireAdmin } from '@/lib/admin/auth';
import { getPrisma } from '@/lib/db/prisma';
import { param, type SearchParams } from '@/lib/admin/queries';
import { CARNET_STATUSES } from './content';
import {
  arcChapterState,
  arcTitleKey,
  groupCarnetArcs,
  tidyArcTitle,
} from './arcs-model';

export const ARCS_PER_PAGE = 8;
const metadata = {
  id: true,
  number: true,
  title: true,
  arcTitle: true,
  arcPosition: true,
  arcTotal: true,
  status: true,
  updatedAt: true,
  earlyAccessAt: true,
  publicAt: true,
  publishedAt: true,
  releaseCampaignId: true,
} satisfies Prisma.CarnetChapterSelect;

export async function readCarnetArcs(
  db: Prisma.TransactionClient,
  params: SearchParams,
  now = new Date(),
) {
  // Lightweight global index keeps arc numbering/progress independent of page and filters.
  const chapters = await db.carnetChapter.findMany({
    select: metadata,
    orderBy: { number: 'asc' },
  });
  const groups = groupCarnetArcs(chapters);
  const search = arcTitleKey(param(params, 'search').slice(0, 200));
  const status = CARNET_STATUSES.find((s) => s === param(params, 'status'));
  const filtered = groups
    .map((group) => ({
      ...group,
      matches: group.chapters.filter(
        (chapter) =>
          (status
            ? chapter.status === status
            : chapter.status !== 'ARCHIVED') &&
          (!search ||
            arcTitleKey(`${chapter.title} ${chapter.arcTitle ?? ''}`).includes(
              search,
            ) ||
            String(chapter.number) === search),
      ),
    }))
    .filter((group) => group.matches.length);
  if (param(params, 'sort') === 'modified')
    filtered.sort(
      (a, b) =>
        b.updatedAt.getTime() - a.updatedAt.getTime() ||
        (a.number ?? Infinity) - (b.number ?? Infinity),
    );
  const total = filtered.length,
    pages = Math.max(1, Math.ceil(total / ARCS_PER_PAGE));
  const page = Math.min(
    pages,
    Math.max(1, Number.parseInt(param(params, 'page'), 10) || 1),
  );
  const selected = filtered.slice(
    (page - 1) * ARCS_PER_PAGE,
    page * ARCS_PER_PAGE,
  );
  const rows = await db.carnetChapter.findMany({
    where: { id: { in: selected.flatMap((g) => g.chapters.map((c) => c.id)) } },
    select: { ...metadata, content: true },
  });
  const states = new Map(
    rows.map((chapter) => [chapter.id, arcChapterState(chapter, now)]),
  );
  return {
    total,
    page,
    pages,
    matchingChapters: filtered.reduce((sum, g) => sum + g.matches.length, 0),
    filtered: Boolean(search || status),
    arcs: selected.map((group) => {
      const counts = {
        ready: 0,
        public: 0,
        early: 0,
        working: 0,
        empty: 0,
        archived: 0,
      };
      for (const chapter of group.chapters) {
        const kind = states.get(chapter.id)!.kind;
        counts[
          kind === 'READY'
            ? 'ready'
            : kind === 'PUBLIC'
              ? 'public'
              : kind === 'EARLY'
                ? 'early'
                : kind === 'WORKING'
                  ? 'working'
                  : kind === 'EMPTY'
                    ? 'empty'
                    : 'archived'
        ]++;
      }
      return {
        key: group.key,
        title: group.title,
        number: group.number,
        total: group.total,
        declared: group.declared,
        warnings: group.warnings,
        missing: group.missing,
        counts,
        complete: counts.ready + counts.public + counts.early,
        chapterCount: group.chapters.length,
        chapters: group.matches.map((chapter) => ({
          id: chapter.id,
          number: chapter.number,
          title: chapter.title,
          position: chapter.arcPosition,
          ...states.get(chapter.id)!,
        })),
      };
    }),
  };
}
export async function getAdminCarnetArcs(params: SearchParams) {
  await requireAdmin();
  return getPrisma().$transaction((tx) => readCarnetArcs(tx, params), {
    isolationLevel: 'RepeatableRead',
  });
}
export async function getCarnetArcTitles() {
  await requireAdmin();
  const chapters = await getPrisma().carnetChapter.findMany({
    where: { arcTitle: { not: null } },
    select: { arcTitle: true },
    orderBy: { number: 'asc' },
  });
  const titles = new Map<string, string>();
  for (const chapter of chapters) {
    const title = tidyArcTitle(chapter.arcTitle!);
    if (title && !titles.has(arcTitleKey(title)))
      titles.set(arcTitleKey(title), title);
  }
  return [...titles.values()];
}
export type CarnetArcs = Awaited<ReturnType<typeof readCarnetArcs>>;
