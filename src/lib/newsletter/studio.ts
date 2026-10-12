import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { requireAdmin } from '@/lib/admin/auth';
import { getPrisma } from '@/lib/db/prisma';
import { AdminError } from '@/lib/admin/validation';

export const AUDIENCES = ['all', 'recent', 'established'] as const;
export type CampaignAudience = (typeof AUDIENCES)[number];
export function audienceWhere(
  audience: string,
  now = new Date(),
): Prisma.NewsletterSubscriberWhereInput {
  if (!AUDIENCES.includes(audience as CampaignAudience))
    throw new AdminError('Audience invalide.');
  return {
    status: 'ACTIVE',
    ...(audience === 'recent'
      ? { confirmedAt: { gte: new Date(now.getTime() - 30 * 86400000) } }
      : {}),
    ...(audience === 'established'
      ? { confirmedAt: { lt: new Date(now.getTime() - 30 * 86400000) } }
      : {}),
  };
}
export function campaignSchedule(value: string, now = new Date()) {
  if (!value) return now;
  const date = new Date(value);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) ||
    !Number.isFinite(date.getTime()) ||
    date.getTime() < now.getTime() + 60000 ||
    date.getTime() > now.getTime() + 180 * 86400000
  )
    throw new AdminError(
      'Choisissez une date comprise entre une minute et 180 jours dans le futur.',
    );
  return date;
}
export type NewsletterProductOption = {
  id: string;
  name: string;
  href: string;
  image: string;
  price: string;
  description: string;
};
export async function getNewsletterStudioData() {
  await requireAdmin();
  const db = getPrisma();
  const [counts, products] = await Promise.all([
    Promise.all(
      AUDIENCES.map(async (value) => ({
        value,
        count: await db.newsletterSubscriber.count({
          where: audienceWhere(value),
        }),
      })),
    ),
    db.product.findMany({
      where: {
        status: 'ACTIVE',
        isDemonstration: false,
        category: { isActive: true },
        variants: { some: { isActive: true } },
      },
      take: 200,
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        shortDescription: true,
        images: {
          take: 1,
          orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
          select: { url: true },
        },
        variants: {
          where: { isActive: true },
          orderBy: [{ price: 'asc' }],
          take: 1,
          select: { price: true },
        },
      },
    }),
  ]);
  return {
    audiences: counts,
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      href: `/produit/${p.slug}`,
      image: p.images[0]?.url ?? '',
      price: p.variants[0]
        ? `À partir de ${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(p.variants[0].price))}`
        : '',
      description: p.shortDescription ?? '',
    })),
  };
}

/** Never silently turn a scheduled send into an immediate send. */
export function validatedCampaignSchedule(
  input: { mode: string; scheduledAt: string; local: string; timeZone: string },
  now = new Date(),
) {
  if (!input.mode) return campaignSchedule(input.scheduledAt, now); // legacy callers
  if (!['now', 'later'].includes(input.mode))
    throw new AdminError('Mode d’envoi invalide.');
  if (input.mode === 'now') {
    if (input.scheduledAt)
      throw new AdminError(
        'Le choix de l’envoi immédiat est incohérent avec la date.',
      );
    return now;
  }
  if (
    !input.scheduledAt ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input.local)
  )
    throw new AdminError(
      'Choisissez une date et une heure valides pour la programmation.',
    );
  const date = campaignSchedule(input.scheduledAt, now);
  try {
    const parts = new Intl.DateTimeFormat('sv-SE', {
      timeZone: input.timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .format(date)
      .replace(' ', 'T');
    if (parts !== input.local) throw new Error('mismatch');
  } catch {
    throw new AdminError(
      'L’heure choisie n’a pas été confirmée. Sélectionnez à nouveau la date et vérifiez votre fuseau horaire.',
    );
  }
  return date;
}
