import 'server-only';
import type { Prisma, Promotion } from '@/generated/prisma/client';
import { toCents } from '@/lib/refunds/amounts';
import type { PromotionRule, PromotionUsage } from './pricing';

/** A category and every category below it. */
export function categoryDescendants(
  rootId: string,
  rows: readonly { id: string; parentId: string | null }[],
) {
  const found = new Set([rootId]);
  for (let grew = true; grew;) {
    grew = false;
    for (const row of rows)
      if (row.parentId && found.has(row.parentId) && !found.has(row.id)) {
        found.add(row.id);
        grew = true;
      }
  }
  return found;
}

export async function promotionRule(
  tx: Prisma.TransactionClient,
  promotion: Promotion,
): Promise<PromotionRule> {
  const categories = promotion.categoryId
    ? await tx.category.findMany({ select: { id: true, parentId: true } })
    : [];
  return {
    id: promotion.id,
    code: promotion.code,
    label: promotion.label,
    type: promotion.type,
    percentOff: promotion.percentOff,
    amountOffCents: promotion.amountOff ? toCents(promotion.amountOff) : null,
    minimumSubtotalCents: promotion.minimumSubtotal
      ? toCents(promotion.minimumSubtotal)
      : null,
    startsAt: promotion.startsAt,
    endsAt: promotion.endsAt,
    isActive: promotion.isActive,
    maxRedemptions: promotion.maxRedemptions,
    maxPerCustomer: promotion.maxPerCustomer,
    gameId: promotion.gameId,
    categoryIds: promotion.categoryId
      ? categoryDescendants(promotion.categoryId, categories)
      : null,
  };
}

/** Uses that count against the limits: orders being paid and paid orders. */
export async function promotionUsage(
  tx: Prisma.TransactionClient,
  promotionId: string,
  email: string | null,
): Promise<PromotionUsage> {
  const counted: Prisma.PromotionRedemptionWhereInput = {
    promotionId,
    status: { in: ['RESERVED', 'CONSUMED'] },
  };
  const total = await tx.promotionRedemption.count({ where: counted });
  const customer = email
    ? await tx.promotionRedemption.count({
        where: { ...counted, email: email.toLowerCase() },
      })
    : 0;
  return { total, customer };
}

/** The order is paid: its use of the code is final. */
export async function consumePromotion(
  tx: Prisma.TransactionClient,
  orderId: string,
) {
  await tx.promotionRedemption.updateMany({
    where: { orderId, status: 'RESERVED' },
    data: { status: 'CONSUMED' },
  });
}

/** The order was never paid: the code can be used again. */
export async function releasePromotion(
  tx: Prisma.TransactionClient,
  orderId: string,
) {
  await tx.promotionRedemption.updateMany({
    where: { orderId, status: 'RESERVED' },
    data: { status: 'RELEASED' },
  });
}
