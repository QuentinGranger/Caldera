import 'server-only';
import { requireAdmin } from '@/lib/admin/auth';
import { Prisma, type Promotion } from '@/generated/prisma/client';
import { adminTransaction, audit } from '@/lib/admin/common';
import { parisDate } from '@/lib/admin/dates';
import { param, type SearchParams } from '@/lib/admin/queries';
import {
  AdminError,
  checked,
  choice,
  id,
  money,
  text,
  whitelist,
} from '@/lib/admin/validation';
import { getPrisma } from '@/lib/db/prisma';
import { MAX_PERCENT_OFF, normalizePromotionCode } from './pricing';

const FIELDS = [
  'id',
  'code',
  'label',
  'type',
  'percentOff',
  'amountOff',
  'minimumSubtotal',
  'startsAt',
  'endsAt',
  'maxRedemptions',
  'maxPerCustomer',
  'isActive',
  'gameId',
  'categoryId',
] as const;

const TYPES = ['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING'] as const;

function optionalInteger(
  form: FormData,
  key: string,
  label: string,
  min: number,
  max: number,
) {
  const value = text(form, key, 7, false);
  if (!value) return null;
  const number = Number(value);
  if (!/^\d+$/.test(value) || number < min || number > max)
    throw new AdminError(`${label} : nombre entier de ${min} à ${max}.`);
  return number;
}

/** A calendar day in Paris: from its first minute, or until its last one. */
function day(form: FormData, key: string, end: boolean) {
  const value = text(form, key, 10, false);
  if (!value) return null;
  const result = parisDate(value, end);
  if (!result) throw new AdminError('Date invalide.');
  return result;
}

function parsePromotion(form: FormData) {
  whitelist(form, FIELDS);
  const code = normalizePromotionCode(text(form, 'code', 40));
  if (!code)
    throw new AdminError(
      'Code invalide : 3 à 32 caractères, lettres, chiffres et tirets, sans tiret au début ni à la fin.',
    );
  const type = choice(form, 'type', TYPES);
  const percentOff =
    type === 'PERCENTAGE'
      ? optionalInteger(form, 'percentOff', 'Pourcentage', 1, MAX_PERCENT_OFF)
      : null;
  if (type === 'PERCENTAGE' && percentOff === null)
    throw new AdminError('Indiquez le pourcentage de réduction.');
  const amountOff =
    type === 'FIXED_AMOUNT' ? money(form, 'amountOff', true) : null;
  if (type === 'FIXED_AMOUNT' && (!amountOff || amountOff.lte(0)))
    throw new AdminError('Indiquez le montant de la réduction.');
  const startsAt = day(form, 'startsAt', false);
  const endsAt = day(form, 'endsAt', true);
  if (startsAt && endsAt && endsAt <= startsAt)
    throw new AdminError('La date de fin doit suivre la date de début.');
  return {
    code,
    label: text(form, 'label', 80),
    type,
    percentOff,
    amountOff,
    minimumSubtotal: money(form, 'minimumSubtotal', true),
    startsAt,
    endsAt,
    maxRedemptions: optionalInteger(
      form,
      'maxRedemptions',
      'Utilisations au total',
      1,
      1000000,
    ),
    maxPerCustomer: optionalInteger(
      form,
      'maxPerCustomer',
      'Utilisations par client',
      1,
      1000,
    ),
    isActive: checked(form, 'isActive'),
    gameId: id(form, 'gameId', true) ?? null,
    categoryId: id(form, 'categoryId', true) ?? null,
  };
}

/** Creates or edits a code. Once used, its code can no longer be renamed. */
export async function savePromotion(adminId: string, form: FormData) {
  const promotionId = id(form, 'id', true);
  const data = parsePromotion(form);
  try {
    return await adminTransaction(adminId, async (tx) => {
      if (
        data.gameId &&
        !(await tx.game.findUnique({ where: { id: data.gameId } }))
      )
        throw new AdminError('Jeu introuvable.');
      if (
        data.categoryId &&
        !(await tx.category.findUnique({ where: { id: data.categoryId } }))
      )
        throw new AdminError('Catégorie introuvable.');
      if (!promotionId) {
        const created = await tx.promotion.create({
          data: { ...data, createdById: adminId },
        });
        await audit(tx, adminId, 'PROMOTION_CREATED', 'Promotion', created.id, {
          code: created.code,
        });
        return created;
      }
      await tx.$queryRaw`SELECT id FROM "Promotion" WHERE id = ${promotionId}::uuid FOR UPDATE`;
      const current = await tx.promotion.findUnique({
        where: { id: promotionId },
        include: { _count: { select: { redemptions: true } } },
      });
      if (!current) throw new AdminError('Code promo introuvable.');
      if (current.code !== data.code && current._count.redemptions)
        throw new AdminError(
          'Ce code a déjà servi : il ne peut plus être renommé. Créez-en un nouveau.',
        );
      const updated = await tx.promotion.update({
        where: { id: promotionId },
        data,
      });
      await audit(tx, adminId, 'PROMOTION_UPDATED', 'Promotion', updated.id, {
        code: updated.code,
        isActive: updated.isActive,
      });
      return updated;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    )
      throw new AdminError('Ce code existe déjà.');
    throw error;
  }
}

/** Disabled codes stay in the history; an unused one can be deleted. */
export async function deletePromotion(adminId: string, form: FormData) {
  whitelist(form, ['id']);
  const promotionId = id(form)!;
  await adminTransaction(adminId, async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Promotion" WHERE id = ${promotionId}::uuid FOR UPDATE`;
    const promotion = await tx.promotion.findUnique({
      where: { id: promotionId },
      include: { _count: { select: { redemptions: true } } },
    });
    if (!promotion) throw new AdminError('Code promo introuvable.');
    if (promotion._count.redemptions)
      throw new AdminError(
        'Ce code a déjà servi : désactivez-le plutôt que de le supprimer.',
      );
    await tx.checkoutSession.updateMany({
      where: { promotionId },
      data: { promotionId: null, readyFingerprint: null },
    });
    await tx.promotion.delete({ where: { id: promotionId } });
    await audit(tx, adminId, 'PROMOTION_DELETED', 'Promotion', promotionId, {
      code: promotion.code,
    });
  });
}

export type PromotionState =
  | 'PROMO_ACTIVE'
  | 'PROMO_SCHEDULED'
  | 'PROMO_EXPIRED'
  | 'PROMO_EXHAUSTED'
  | 'PROMO_DISABLED';

export function promotionState(
  promotion: Pick<
    Promotion,
    'isActive' | 'startsAt' | 'endsAt' | 'maxRedemptions'
  >,
  used: number,
  now = new Date(),
): PromotionState {
  if (!promotion.isActive) return 'PROMO_DISABLED';
  if (promotion.endsAt && promotion.endsAt <= now) return 'PROMO_EXPIRED';
  if (promotion.maxRedemptions !== null && used >= promotion.maxRedemptions)
    return 'PROMO_EXHAUSTED';
  if (promotion.startsAt && promotion.startsAt > now) return 'PROMO_SCHEDULED';
  return 'PROMO_ACTIVE';
}

async function usageByPromotion(ids: string[]) {
  const rows = await getPrisma().promotionRedemption.groupBy({
    by: ['promotionId', 'status'],
    where: { promotionId: { in: ids } },
    _count: { _all: true },
    _sum: { discountAmount: true },
  });
  const usage = new Map<
    string,
    { consumed: number; reserved: number; discount: Prisma.Decimal }
  >();
  for (const id of ids)
    usage.set(id, {
      consumed: 0,
      reserved: 0,
      discount: new Prisma.Decimal(0),
    });
  for (const row of rows) {
    const entry = usage.get(row.promotionId)!;
    if (row.status === 'CONSUMED') {
      entry.consumed = row._count._all;
      entry.discount = row._sum.discountAmount ?? new Prisma.Decimal(0);
    } else if (row.status === 'RESERVED') entry.reserved = row._count._all;
  }
  return usage;
}

export async function getAdminPromotions(params: SearchParams) {
  await requireAdmin();
  const search = param(params, 'search')?.trim().toUpperCase().slice(0, 40);
  const promotions = await getPrisma().promotion.findMany({
    where: search
      ? {
          OR: [
            { code: { contains: search } },
            { label: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {},
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 200,
    include: {
      game: { select: { name: true } },
      category: { select: { name: true } },
    },
  });
  const usage = await usageByPromotion(promotions.map((row) => row.id));
  const now = new Date();
  const state = param(params, 'state');
  return promotions
    .map((promotion) => {
      const uses = usage.get(promotion.id)!;
      return {
        ...promotion,
        uses,
        state: promotionState(promotion, uses.consumed + uses.reserved, now),
      };
    })
    .filter((row) => !state || row.state === state);
}

export async function getAdminPromotion(promotionId: string) {
  await requireAdmin();
  const db = getPrisma();
  const promotion = await db.promotion.findUnique({
    where: { id: promotionId },
    include: {
      createdBy: { select: { name: true } },
      redemptions: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              status: true,
              totalAmount: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });
  if (!promotion) return null;
  const uses = (await usageByPromotion([promotion.id])).get(promotion.id)!;
  const revenue = await db.order.aggregate({
    where: {
      promotionRedemption: { promotionId, status: 'CONSUMED' },
    },
    _sum: { totalAmount: true },
  });
  return {
    ...promotion,
    uses,
    revenue: revenue._sum.totalAmount ?? new Prisma.Decimal(0),
    state: promotionState(promotion, uses.consumed + uses.reserved),
  };
}

/** Games and categories a code can be limited to. */
export async function getPromotionScopes() {
  await requireAdmin();
  const db = getPrisma();
  return Promise.all([
    db.game.findMany({
      select: { id: true, name: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
    db.category.findMany({
      select: { id: true, name: true, parentId: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
  ]);
}

const parisDay = (value: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(value);

/** Stored values as the edit form shows them (end date inclusive). */
export function promotionFormValue(promotion: Promotion) {
  return {
    id: promotion.id,
    code: promotion.code,
    label: promotion.label,
    type: promotion.type,
    percentOff: promotion.percentOff?.toString() ?? '',
    amountOff: promotion.amountOff?.toFixed(2).replace('.', ',') ?? '',
    minimumSubtotal:
      promotion.minimumSubtotal?.toFixed(2).replace('.', ',') ?? '',
    startsAt: promotion.startsAt ? parisDay(promotion.startsAt) : '',
    endsAt: promotion.endsAt
      ? parisDay(new Date(promotion.endsAt.getTime() - 1))
      : '',
    maxRedemptions: promotion.maxRedemptions?.toString() ?? '',
    maxPerCustomer: promotion.maxPerCustomer?.toString() ?? '',
    isActive: promotion.isActive,
    gameId: promotion.gameId ?? '',
    categoryId: promotion.categoryId ?? '',
  };
}

/** Categories in tree order, with their depth for indentation. */
export function categoryOptions(
  rows: { id: string; name: string; parentId: string | null }[],
) {
  const result: { id: string; name: string; depth: number }[] = [];
  const visit = (parentId: string | null, depth: number) => {
    for (const row of rows.filter((item) => item.parentId === parentId)) {
      result.push({ id: row.id, name: row.name, depth });
      if (depth < 8) visit(row.id, depth + 1);
    }
  };
  visit(null, 0);
  return result;
}
