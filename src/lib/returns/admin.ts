import 'server-only';
import { requireAdmin } from '@/lib/admin/auth';
import type { Prisma, ReturnStatus } from '@/generated/prisma/client';
import {
  pageNumber,
  pageSize,
  param,
  type SearchParams,
} from '@/lib/admin/queries';
import { getPrisma } from '@/lib/db/prisma';
import { OPEN_RETURN_STATUSES } from './rules';

const STATUSES: readonly ReturnStatus[] = [
  'REQUESTED',
  'APPROVED',
  'RECEIVED',
  'REFUNDED',
  'REJECTED',
  'CANCELED',
];

export async function getAdminReturns(params: SearchParams) {
  await requireAdmin();
  const search = param(params, 'search').trim();
  const status = STATUSES.find((value) => value === param(params, 'status'));
  const open = param(params, 'open') === '1';
  const where: Prisma.ReturnRequestWhereInput = {
    ...(status
      ? { status }
      : open
        ? { status: { in: [...OPEN_RETURN_STATUSES] } }
        : {}),
    ...(search
      ? {
          OR: [
            { number: { contains: search, mode: 'insensitive' } },
            {
              order: { orderNumber: { contains: search, mode: 'insensitive' } },
            },
            { order: { email: { contains: search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };
  const page = pageNumber(params);
  const db = getPrisma();
  const [rows, total, counts] = await Promise.all([
    db.returnRequest.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        order: { select: { id: true, orderNumber: true, email: true } },
        items: { select: { quantity: true } },
      },
    }),
    db.returnRequest.count({ where }),
    db.returnRequest.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);
  return {
    rows,
    total,
    page,
    counts: Object.fromEntries(
      counts.map((row) => [row.status, row._count._all]),
    ) as Partial<Record<ReturnStatus, number>>,
  };
}

export async function getAdminReturn(id: string) {
  await requireAdmin();
  return getPrisma().returnRequest.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true } },
      refund: {
        select: {
          id: true,
          amount: true,
          status: true,
          failureReason: true,
          createdAt: true,
        },
      },
      items: {
        include: {
          orderItem: {
            select: {
              id: true,
              productName: true,
              sku: true,
              quantity: true,
              lineTotal: true,
              discountAmount: true,
              variantId: true,
            },
          },
        },
      },
      order: {
        select: {
          id: true,
          orderNumber: true,
          email: true,
          status: true,
          shippingAmount: true,
          deliveredAt: true,
          paidAt: true,
          fulfillmentStatus: true,
          items: { select: { id: true, quantity: true } },
          payment: { select: { amount: true, status: true } },
          refunds: {
            select: {
              amount: true,
              shippingAmount: true,
              status: true,
              items: { select: { orderItemId: true, quantity: true } },
            },
          },
        },
      },
    },
  });
}

/** Returns waiting for the shop, for the dashboard and the navigation. */
export async function countOpenReturns() {
  await requireAdmin();
  return getPrisma().returnRequest.count({
    where: { status: { in: ['REQUESTED', 'RECEIVED'] } },
  });
}
