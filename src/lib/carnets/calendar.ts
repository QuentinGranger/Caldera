import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { getPrisma } from '@/lib/db/prisma';
import { requireAdmin } from '@/lib/admin/auth';
import { upcomingCarnets } from './production';
import { carnetMonth } from './calendar-month';
import { carnetCalendarStatus } from './calendar-status';
import { carnetReadiness } from './readiness';
import { loadChapterComptoirs } from './comptoir';

const campaignSelect = {
  id: true,
  status: true,
  subject: true,
  preheader: true,
  updatedAt: true,
  scheduledAt: true,
} satisfies Prisma.NewsletterCampaignSelect;
const include = {
  editionCampaign: { select: campaignSelect },
  releaseCampaign: { select: campaignSelect },
} satisfies Prisma.CarnetChapterInclude;
type Chapter = Prisma.CarnetChapterGetPayload<{ include: typeof include }>;

export async function readCarnetCalendar(
  db: Prisma.TransactionClient,
  rawMonth: unknown,
  now = new Date(),
) {
  const month = carnetMonth(rawMonth, now);
  const interval = { gte: month.start, lt: month.end };
  const monthly = await db.carnetChapter.findMany({
    where: {
      status: { not: 'ARCHIVED' },
      OR: [
        { earlyAccessAt: interval },
        { publicAt: interval },
        { earlyAccessAt: null, editionCampaign: { scheduledAt: interval } },
        {
          earlyAccessAt: null,
          editionCampaignId: null,
          releaseCampaign: { scheduledAt: interval },
        },
      ],
    },
    include,
  });
  const reserve = await db.carnetChapter.findMany({
    where: { ...upcomingCarnets, status: 'READY' },
    include,
  });
  const undatedWhere = {
    ...upcomingCarnets,
    earlyAccessAt: null,
    publicAt: null,
    AND: [
      {
        OR: [
          { editionCampaign: { scheduledAt: null } },
          { editionCampaignId: null },
        ],
      },
      {
        OR: [
          { releaseCampaign: { scheduledAt: null } },
          { releaseCampaignId: null },
        ],
      },
    ],
  } satisfies Prisma.CarnetChapterWhereInput;
  const unscheduledTotal = await db.carnetChapter.count({
    where: undatedWhere,
  });
  const unscheduled = await db.carnetChapter.findMany({
    where: undatedWhere,
    include,
    orderBy: { number: 'asc' },
    take: 10,
  });
  const chapters = [
    ...new Map(
      [...monthly, ...reserve, ...unscheduled].map((chapter) => [
        chapter.id,
        chapter,
      ]),
    ).values(),
  ];
  const products = await loadChapterComptoirs(
    db,
    chapters.map((chapter) => chapter.id),
  );
  const campaignIds = chapters.flatMap((chapter) => {
    const campaign = chapter.editionCampaign ?? chapter.releaseCampaign;
    return campaign ? [campaign.id] : [];
  });
  const tests = await db.adminAuditLog.findMany({
    where: {
      action: 'NEWSLETTER_CAMPAIGN_TEST_SENT',
      entityType: 'NewsletterCampaign',
      entityId: { in: campaignIds },
    },
    distinct: ['entityId'],
    orderBy: [{ entityId: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }],
    select: { entityId: true, createdAt: true, metadata: true },
  });
  const testByCampaign = new Map(tests.map((test) => [test.entityId, test]));
  const readiness = new Map(
    chapters.map((chapter) => {
      const campaign = chapter.editionCampaign ?? chapter.releaseCampaign;
      return [
        chapter.id,
        carnetReadiness(
          chapter,
          campaign,
          products.get(chapter.id) ?? [],
          campaign ? (testByCampaign.get(campaign.id) ?? null) : null,
        ),
      ];
    }),
  );
  const inMonth = (date: Date | null) =>
    Boolean(date && date >= month.start && date < month.end);
  const entry = (chapter: Chapter) => {
    const campaign = chapter.editionCampaign ?? chapter.releaseCampaign;
    const ready = readiness.get(chapter.id)!;
    const newsletterAt = chapter.earlyAccessAt ?? campaign?.scheduledAt ?? null;
    const state = carnetCalendarStatus(
      chapter,
      campaign,
      chapter.releaseCampaign,
      ready,
      now,
    );
    const tasks = [
      ...(!ready.chapterReady
        ? ['Valider le texte et sa coupure newsletter']
        : []),
      ...(!ready.illustrationReady
        ? ['Ajouter l’illustration et son texte alternatif']
        : []),
      ...(!ready.emailReady ? ['Compléter l’objet et le preheader'] : []),
      ...ready.unavailable.map(
        (product) => `Comptoir : ${product.name} (${product.reason})`,
      ),
      ...(!ready.testCurrent ? ['Envoyer un test de la version actuelle'] : []),
    ];
    return {
      id: chapter.id,
      number: chapter.number,
      title: chapter.title,
      arcTitle: chapter.arcTitle,
      arcPosition: chapter.arcPosition,
      arcTotal: chapter.arcTotal,
      state,
      newsletterAt,
      publicAt: chapter.publicAt,
      newsletterInMonth: inMonth(newsletterAt),
      publicInMonth: inMonth(chapter.publicAt),
      provisional: !chapter.releaseCampaignId && !chapter.publishedAt,
      excerptWords: ready.excerptWords,
      tasks: ['Brouillon', 'Texte prêt'].includes(state)
        ? tasks
        : ready.unavailable.map(
            (product) =>
              `Comptoir à vérifier : ${product.name} (${product.reason})`,
          ),
    };
  };
  const entries = monthly.map(entry).sort((a, b) => {
    const firstEvent = (e: typeof a) =>
      Math.min(
        ...[
          e.newsletterInMonth ? e.newsletterAt!.getTime() : Infinity,
          e.publicInMonth ? e.publicAt!.getTime() : Infinity,
        ],
      );
    return firstEvent(a) - firstEvent(b) || a.number - b.number;
  });
  const readyCount = reserve.filter(
    (chapter) =>
      readiness.get(chapter.id)!.chapterReady &&
      !['Accès anticipé', 'Public'].includes(entry(chapter).state),
  ).length;
  const sendReadyCount = reserve.filter(
    (chapter) => entry(chapter).state === 'Prêt à envoyer',
  ).length;
  return {
    month,
    entries,
    unscheduled: unscheduled.map(entry),
    unscheduledTotal,
    readyCount,
    sendReadyCount,
    newsletterCount: entries.filter((e) => e.newsletterInMonth).length,
    publicCount: entries.filter((e) => e.publicInMonth).length,
  };
}

export async function getCarnetCalendar(rawMonth: unknown) {
  await requireAdmin();
  return getPrisma().$transaction((tx) => readCarnetCalendar(tx, rawMonth), {
    isolationLevel: 'RepeatableRead',
  });
}
export type CarnetEditorialCalendar = Awaited<
  ReturnType<typeof readCarnetCalendar>
>;
