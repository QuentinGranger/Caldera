import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { getPrisma } from '@/lib/db/prisma';
import { carnetAccessState, verifyCarnetAccess } from './access';
// Explicit safe projection: no narrative is fetched until authorization succeeds.
export const carnetSummarySelect = {
  id: true,
  number: true,
  title: true,
  slug: true,
  arcTitle: true,
  arcPosition: true,
  arcTotal: true,
  illustrationUrl: true,
  illustrationAlt: true,
  location: true,
  status: true,
  earlyAccessAt: true,
  publicAt: true,
  publishedAt: true,
  releaseCampaignId: true,
  updatedAt: true,
} satisfies Prisma.CarnetChapterSelect;
export function publicCarnetWhere(
  now = new Date(),
): Prisma.CarnetChapterWhereInput {
  return {
    status: { in: ['READY', 'EARLY_ACCESS', 'PUBLIC'] },
    earlyAccessAt: { lte: now },
    publicAt: { lte: now },
    OR: [{ releaseCampaignId: { not: null } }, { publishedAt: { not: null } }],
  };
}
export async function listPublicCarnets(now = new Date()) {
  return getPrisma().carnetChapter.findMany({
    where: publicCarnetWhere(now),
    select: carnetSummarySelect,
    orderBy: [{ number: 'desc' }],
  });
}
export async function readCarnet(
  slug: string,
  token: unknown,
  now = new Date(),
) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 120)
    return null;
  const db = getPrisma();
  // A consistent snapshot prevents archive/reschedule races between projection and content read.
  return db.$transaction(
    async (tx) => {
      const chapter = await tx.carnetChapter.findUnique({
        where: { slug },
        select: carnetSummarySelect,
      });
      if (!chapter) return null;
      const state = carnetAccessState(chapter, now);
      if (state === 'hidden') return null;
      const allowed =
        state === 'public' || verifyCarnetAccess(chapter, token, now);
      const narrative = allowed
        ? await tx.carnetChapter.findUniqueOrThrow({
            where: { id: chapter.id },
            select: { content: true },
          })
        : null;
      return { chapter, state, content: narrative?.content ?? null };
    },
    { isolationLevel: 'RepeatableRead' },
  );
}
