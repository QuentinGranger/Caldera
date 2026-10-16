import 'server-only';
import {
  NewsletterCampaignStatus,
  DiscordPublicationStatus,
  type Prisma,
} from '@/generated/prisma/client';
import { requireAdmin } from './auth';
import { getPrisma } from '@/lib/db/prisma';
import { param, type SearchParams } from './queries';

export const CAMPAIGN_STATES = {
  DRAFT: 'Brouillons',
  QUEUED: 'Programmées',
  SENDING: 'En cours d’envoi',
  COMPLETED: 'Terminées',
} as const;
export const DISCORD_STATES = {
  DRAFT: 'Brouillon',
  PENDING: 'En attente',
  PROCESSING: 'Envoi en cours',
  SENT: 'Envoyé',
  RETRY: 'Délai Discord',
  REVIEW: 'À vérifier dans Discord',
  REJECTED: 'Refusé par Discord',
  CANCELLED: 'Annulé',
} as const;
export const DISCORD_VIEWS = {
  all: 'Toutes',
  drafts: 'Brouillons',
  queue: 'En file',
  review: 'À vérifier',
  sent: 'Envoyées',
  cancelled: 'Annulées',
} as const;
const discordGroups = {
  all: [],
  drafts: ['DRAFT'],
  queue: ['PENDING', 'PROCESSING', 'RETRY'],
  review: ['REVIEW', 'REJECTED'],
  sent: ['SENT'],
  cancelled: ['CANCELLED'],
} satisfies Record<keyof typeof DISCORD_VIEWS, DiscordPublicationStatus[]>;
function listPage(params: SearchParams, key: string, total: number) {
  return Math.min(
    Math.max(1, Math.ceil(total / 25)),
    Math.max(1, Math.min(100000, parseInt(param(params, key), 10) || 1)),
  );
}
export async function readNewsletterCampaignList(
  db: Prisma.TransactionClient,
  params: SearchParams = {},
) {
  const search = param(params, 'campaignSearch').trim();
  const status = Object.values(NewsletterCampaignStatus).find(
    (s) => s === param(params, 'campaignStatus'),
  );
  const where: Prisma.NewsletterCampaignWhereInput = {
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { internalName: { contains: search, mode: 'insensitive' } },
            { subject: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const [total, grouped] = await Promise.all([
    db.newsletterCampaign.count({ where }),
    db.newsletterCampaign.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);
  const page = listPage(params, 'campaignPage', total);
  const campaigns = await db.newsletterCampaign.findMany({
    where,
    take: 25,
    skip: (page - 1) * 25,
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    select: {
      id: true,
      internalName: true,
      subject: true,
      status: true,
      recipientCount: true,
      createdAt: true,
      queuedAt: true,
      completedAt: true,
      scheduledAt: true,
      chapter: {
        select: {
          id: true,
          number: true,
          title: true,
          editionCampaignId: true,
        },
      },
    },
  });
  const deliveries = campaigns.length
    ? await db.newsletterCampaignDelivery.groupBy({
        by: ['campaignId', 'status'],
        where: { campaignId: { in: campaigns.map((c) => c.id) } },
        _count: { _all: true },
        _min: { nextAttemptAt: true },
      })
    : [];
  return {
    page,
    total,
    search,
    status: status ?? '',
    counts: Object.fromEntries(
      grouped.map((row) => [row.status, row._count._all]),
    ) as Partial<Record<NewsletterCampaignStatus, number>>,
    campaigns: campaigns.map((c) => ({
      ...c,
      nextPendingAt:
        deliveries.find(
          (row) => row.campaignId === c.id && row.status === 'PENDING',
        )?._min.nextAttemptAt ?? null,
      deliveryCounts: Object.fromEntries(
        deliveries
          .filter((row) => row.campaignId === c.id)
          .map((row) => [row.status, row._count._all]),
      ),
    })),
  };
}
export async function getNewsletterCampaignList(params: SearchParams) {
  await requireAdmin();
  return readNewsletterCampaignList(getPrisma(), params);
}
export async function readDiscordPublicationList(
  db: Prisma.TransactionClient,
  params: SearchParams = {},
) {
  const requested = param(params, 'view');
  const view = Object.hasOwn(discordGroups, requested)
    ? (requested as keyof typeof discordGroups)
    : 'all';
  const statuses = discordGroups[view];
  const search = param(params, 'search').trim();
  const where: Prisma.DiscordOutboxWhereInput = {
    ...(statuses.length ? { status: { in: statuses } } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { summary: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const [total, grouped] = await Promise.all([
    db.discordOutbox.count({ where }),
    db.discordOutbox.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);
  const page = listPage(params, 'page', total);
  const events = await db.discordOutbox.findMany({
    where,
    take: 25,
    skip: (page - 1) * 25,
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    select: {
      id: true,
      title: true,
      summary: true,
      path: true,
      kind: true,
      status: true,
      messageId: true,
      createdAt: true,
      nextAttemptAt: true,
    },
  });
  const countByStatus = Object.fromEntries(
    grouped.map((row) => [row.status, row._count._all]),
  );
  const counts = Object.fromEntries(
    Object.entries(discordGroups).map(([key, group]) => [
      key,
      group.length
        ? group.reduce((n, state) => n + (countByStatus[state] ?? 0), 0)
        : grouped.reduce((n, row) => n + row._count._all, 0),
    ]),
  ) as Record<keyof typeof discordGroups, number>;
  return { events, page, total, view, search, counts };
}
export async function getDiscordPublicationList(params: SearchParams) {
  await requireAdmin();
  return readDiscordPublicationList(getPrisma(), params);
}
