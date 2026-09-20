import 'server-only';
import {
  Prisma,
  ProductLanguage,
  ProductStatus,
  ProductType,
  OrderStatus,
  PaymentStatus,
  FulfillmentStatus,
} from '@/generated/prisma/client';
import { getPrisma } from '@/lib/db/prisma';
import { parisDate } from './dates';
import { requireAdmin } from './auth';
import { uuid } from './validation';
export type SearchParams = Record<string, string | string[] | undefined>;
export const pageSize = 25;
export function param(params: SearchParams, key: string) {
  const value = params[key];
  return typeof value === 'string' ? value.slice(0, 200) : '';
}
export function pageNumber(params: SearchParams) {
  return Math.max(
    1,
    Math.min(100000, Number.parseInt(param(params, 'page'), 10) || 1),
  );
}
function enumValue<T extends string>(value: string, values: readonly T[]) {
  return values.find((item) => item === value);
}
function validId(value: string) {
  try {
    return uuid(value);
  } catch {
    return undefined;
  }
}
export async function getAdminOptions() {
  await requireAdmin();
  const db = getPrisma();
  const [categories, sets] = await Promise.all([
    db.category.findMany({
      select: { id: true, name: true, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
    db.tcgSet.findMany({
      select: { id: true, name: true, isActive: true },
      orderBy: { name: 'asc' },
    }),
  ]);
  return { categories, sets };
}
export async function getAdminProducts(params: SearchParams) {
  await requireAdmin();
  const db = getPrisma();
  const page = pageNumber(params);
  const filters: Prisma.Sql[] = [Prisma.sql`TRUE`];
  const search = param(params, 'search');
  if (search) {
    const pattern = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
    filters.push(
      Prisma.sql`(p.name ILIKE ${pattern} OR p.slug ILIKE ${pattern} OR EXISTS (SELECT 1 FROM "ProductVariant" s WHERE s."productId" = p.id AND (s.sku ILIKE ${pattern} OR s.barcode ILIKE ${pattern})))`,
    );
  }
  const status = enumValue(
    param(params, 'status'),
    Object.values(ProductStatus),
  );
  if (status) filters.push(Prisma.sql`p.status = ${status}::"ProductStatus"`);
  const type = enumValue(
    param(params, 'productType'),
    Object.values(ProductType),
  );
  if (type) filters.push(Prisma.sql`p."productType" = ${type}::"ProductType"`);
  const category = validId(param(params, 'categoryId'));
  if (category) filters.push(Prisma.sql`p."categoryId" = ${category}::uuid`);
  const set = validId(param(params, 'tcgSetId'));
  if (set) filters.push(Prisma.sql`p."tcgSetId" = ${set}::uuid`);
  const language = enumValue(
    param(params, 'language'),
    Object.values(ProductLanguage),
  );
  if (language)
    filters.push(
      Prisma.sql`EXISTS (SELECT 1 FROM "ProductVariant" l WHERE l."productId" = p.id AND l.language = ${language}::"ProductLanguage")`,
    );
  const availability = param(params, 'availability');
  if (availability === 'out')
    filters.push(Prisma.sql`COALESCE(v.available, 0) = 0`);
  if (availability === 'in')
    filters.push(Prisma.sql`COALESCE(v.available, 0) > 0`);
  if (availability === 'low') filters.push(Prisma.sql`v.low = TRUE`);
  const from = Prisma.sql`FROM "Product" p LEFT JOIN LATERAL (
    SELECT MIN(price) AS price, SUM("availableQuantity") AS available, BOOL_OR("availableQuantity" > 0 AND "availableQuantity" <= "lowStockThreshold") AS low
    FROM "ProductVariant" WHERE "productId" = p.id AND "isActive" = TRUE
  ) v ON TRUE WHERE ${Prisma.join(filters, ' AND ')}`;
  const sorts: Record<string, Prisma.Sql> = {
    name: Prisma.sql`p.name ASC`,
    created: Prisma.sql`p."createdAt" DESC`,
    updated: Prisma.sql`p."updatedAt" DESC`,
    price: Prisma.sql`v.price ASC NULLS LAST`,
    stock: Prisma.sql`COALESCE(v.available,0) ASC`,
  };
  const [rows, counts] = await db.$transaction(
    [
      db.$queryRaw<
        { id: string; price: Prisma.Decimal | null; available: number }[]
      >(
        Prisma.sql`SELECT p.id, v.price, COALESCE(v.available, 0)::int AS available ${from} ORDER BY ${sorts[param(params, 'sort')] ?? sorts.updated}, p.id LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
      ),
      db.$queryRaw<{ count: number }[]>(
        Prisma.sql`SELECT COUNT(*)::int AS count ${from}`,
      ),
    ],
    { isolationLevel: 'RepeatableRead' },
  );
  const products = await db.product.findMany({
    where: { id: { in: rows.map((row) => row.id) } },
    select: {
      id: true,
      name: true,
      slug: true,
      productType: true,
      status: true,
      updatedAt: true,
      category: { select: { name: true } },
      tcgSet: { select: { name: true } },
      images: {
        take: 1,
        orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
        select: { url: true, alt: true },
      },
      variants: {
        take: 1,
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        select: { sku: true },
      },
    },
  });
  return {
    page,
    total: counts[0]?.count ?? 0,
    products: rows.flatMap((row) => {
      const product = products.find((item) => item.id === row.id);
      return product
        ? [{ ...product, price: row.price, available: row.available }]
        : [];
    }),
  };
}
export async function getAdminProduct(id: string) {
  await requireAdmin();
  if (!validId(id)) return null;
  return getPrisma().product.findUnique({
    where: { id },
    include: {
      tags: true,
      images: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
      variants: {
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        include: {
          adjustments: {
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: { adminUser: { select: { name: true } } },
          },
          reservations: {
            where: { status: 'ACTIVE' },
            include: { order: { select: { id: true, orderNumber: true } } },
          },
        },
      },
    },
  });
}
export async function getAdminStocks(params: SearchParams) {
  await requireAdmin();
  const db = getPrisma();
  const page = pageNumber(params);
  const search = param(params, 'search');
  const availability = param(params, 'availability');
  const where: Prisma.ProductVariantWhereInput = {
    ...(search
      ? {
          OR: [
            { sku: { contains: search, mode: 'insensitive' } },
            { product: { name: { contains: search, mode: 'insensitive' } } },
          ],
        }
      : {}),
    ...(availability === 'out'
      ? { availableQuantity: 0 }
      : availability === 'low'
        ? {
            availableQuantity: {
              gt: 0,
              lte: db.productVariant.fields.lowStockThreshold,
            },
          }
        : availability === 'reserved'
          ? { reservedQuantity: { gt: 0 } }
          : {}),
  };
  const [variants, total] = await Promise.all([
    db.productVariant.findMany({
      where,
      take: pageSize,
      skip: (page - 1) * pageSize,
      orderBy: [{ availableQuantity: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        productId: true,
        sku: true,
        language: true,
        stockQuantity: true,
        reservedQuantity: true,
        availableQuantity: true,
        lowStockThreshold: true,
        isActive: true,
        product: { select: { name: true } },
        _count: { select: { reservations: { where: { status: 'ACTIVE' } } } },
      },
    }),
    db.productVariant.count({ where }),
  ]);
  return { variants, total, page };
}
export async function getAdminOrders(params: SearchParams) {
  await requireAdmin();
  const db = getPrisma();
  const page = pageNumber(params);
  const search = param(params, 'search');
  const status = enumValue(param(params, 'status'), Object.values(OrderStatus));
  const payment = enumValue(
    param(params, 'payment'),
    Object.values(PaymentStatus),
  );
  const fulfillment = enumValue(
    param(params, 'fulfillment'),
    Object.values(FulfillmentStatus),
  );
  const where: Prisma.OrderWhereInput = {
    AND: [
      ...(fulfillment
        ? [{ fulfillmentStatus: fulfillment, status: 'PAID' as const }]
        : []),
      ...(param(params, 'view') === 'todo'
        ? [
            {
              status: 'PAID' as const,
              fulfillmentStatus: {
                in: [
                  FulfillmentStatus.UNFULFILLED,
                  FulfillmentStatus.PREPARING,
                  FulfillmentStatus.READY_TO_SHIP,
                ],
              },
            },
          ]
        : []),
    ],
    ...(param(params, 'emails') === 'failed'
      ? { emails: { some: { status: 'FAILED' } } }
      : {}),
    ...(search
      ? {
          OR: [
            { orderNumber: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            {
              shipments: {
                some: {
                  trackingNumber: { contains: search, mode: 'insensitive' },
                },
              },
            },
            { publicId: { contains: search, mode: 'insensitive' } },
            {
              items: {
                some: { sku: { contains: search, mode: 'insensitive' } },
              },
            },
          ],
        }
      : {}),
    ...(status ? { status } : {}),
    ...(payment ? { payment: { status: payment } } : {}),
    ...(param(params, 'shipping')
      ? { shippingMethodCode: param(params, 'shipping') }
      : {}),
    createdAt: {
      gte: parisDate(param(params, 'from')),
      lt: parisDate(param(params, 'to'), true),
    },
  };
  const sorts: Record<string, Prisma.OrderOrderByWithRelationInput> = {
    oldest: { createdAt: 'asc' },
    newest: { createdAt: 'desc' },
    amount: { totalAmount: 'asc' },
    amountDesc: { totalAmount: 'desc' },
    paid: { paidAt: { sort: 'desc', nulls: 'last' } },
    shipped: { shippedAt: { sort: 'desc', nulls: 'last' } },
  };
  const [orders, total, shipping] = await Promise.all([
    db.order.findMany({
      where,
      take: pageSize,
      skip: (page - 1) * pageSize,
      orderBy: [
        sorts[param(params, 'sort')] ?? { createdAt: 'desc' },
        { id: 'asc' },
      ],
      select: {
        id: true,
        orderNumber: true,
        createdAt: true,
        email: true,
        status: true,
        totalAmount: true,
        shippingMethodName: true,
        fulfillmentStatus: true,
        payment: { select: { status: true } },
        _count: { select: { items: true } },
      },
    }),
    db.order.count({ where }),
    db.shippingMethod.findMany({
      select: { code: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);
  return { orders, total, page, shipping };
}
export async function getAdminOrder(id: string) {
  await requireAdmin();
  if (!validId(id)) return null;
  const order = await getPrisma().order.findUnique({
    where: { id },
    include: {
      items: { orderBy: { id: 'asc' } },
      addresses: true,
      payment: true,
      shipments: { where: { isPrimary: true }, orderBy: { createdAt: 'asc' } },
      emails: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          type: true,
          status: true,
          attemptCount: true,
          firstAttemptAt: true,
          retryBlocked: true,
          lastError: true,
          sentAt: true,
          providerMessageId: true,
        },
      },
      reservations: {
        include: { variant: { select: { sku: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!order) return null;
  const fulfillmentAudit = await getPrisma().adminAuditLog.findMany({
    where: {
      entityType: 'Order',
      entityId: id,
      action: {
        in: [
          'ORDER_PREPARATION_STARTED',
          'ORDER_READY_TO_SHIP',
          'ORDER_SHIPPED',
          'ORDER_DELIVERED',
          'SHIPMENT_CREATED',
          'SHIPMENT_UPDATED',
          'SHIPMENT_TRACKING_UPDATED',
        ],
      },
    },
    orderBy: { createdAt: 'asc' },
    include: { adminUser: { select: { name: true } } },
  });
  return { ...order, fulfillmentAudit };
}
export async function getAdminTaxonomy(
  kind: 'category' | 'set',
  params: SearchParams,
) {
  await requireAdmin();
  const db = getPrisma();
  const page = pageNumber(params);
  const search = param(params, 'search');
  const where = search
    ? { name: { contains: search, mode: 'insensitive' as const } }
    : {};
  const selected = validId(param(params, 'edit'));
  if (kind === 'category') {
    const [rows, total, editing] = await Promise.all([
      db.category.findMany({
        where,
        take: pageSize,
        skip: (page - 1) * pageSize,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: {
          parent: { select: { name: true } },
          _count: { select: { products: true } },
        },
      }),
      db.category.count({ where }),
      selected ? db.category.findUnique({ where: { id: selected } }) : null,
    ]);
    return { kind, rows, total, page, editing } as const;
  }
  const [rows, total, editing] = await Promise.all([
    db.tcgSet.findMany({
      where,
      take: pageSize,
      skip: (page - 1) * pageSize,
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    }),
    db.tcgSet.count({ where }),
    selected ? db.tcgSet.findUnique({ where: { id: selected } }) : null,
  ]);
  return { kind, rows, total, page, editing } as const;
}
export async function getDashboard() {
  await requireAdmin();
  const db = getPrisma();
  const since = new Date(Date.now() - 7 * 86400000);
  const [
    active,
    out,
    low,
    waiting,
    recentPaid,
    reservations,
    review,
    failed,
    paidTotal,
    recentOrders,
    logs,
  ] = await Promise.all([
    db.product.count({ where: { status: 'ACTIVE' } }),
    db.product.count({
      where: {
        status: 'ACTIVE',
        variants: { none: { isActive: true, availableQuantity: { gt: 0 } } },
      },
    }),
    db.product.count({
      where: {
        status: 'ACTIVE',
        variants: {
          some: {
            isActive: true,
            availableQuantity: {
              gt: 0,
              lte: db.productVariant.fields.lowStockThreshold,
            },
          },
        },
      },
    }),
    db.order.count({
      where: { status: { in: ['PENDING_PAYMENT', 'PAYMENT_PROCESSING'] } },
    }),
    db.order.count({ where: { status: 'PAID', paidAt: { gte: since } } }),
    db.stockReservation.count({ where: { status: 'ACTIVE' } }),
    db.order.count({ where: { status: 'PAYMENT_REVIEW' } }),
    db.payment.count({
      where: { status: 'FAILED', updatedAt: { gte: since } },
    }),
    db.order.aggregate({
      where: { status: 'PAID' },
      _sum: { totalAmount: true },
    }),
    db.order.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, orderNumber: true, status: true, totalAmount: true },
    }),
    db.adminAuditLog.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: { adminUser: { select: { name: true } } },
    }),
  ]);
  return {
    active,
    out,
    low,
    waiting,
    recentPaid,
    reservations,
    review,
    failed,
    paidTotal: paidTotal._sum.totalAmount,
    recentOrders,
    logs,
  };
}

export async function getFulfillmentDashboard() {
  await requireAdmin();
  const db = getPrisma();
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const [unfulfilled, preparing, ready, shippedToday, failedEmails] =
    await Promise.all([
      db.order.count({
        where: { status: 'PAID', fulfillmentStatus: 'UNFULFILLED' },
      }),
      db.order.count({
        where: { status: 'PAID', fulfillmentStatus: 'PREPARING' },
      }),
      db.order.count({
        where: { status: 'PAID', fulfillmentStatus: 'READY_TO_SHIP' },
      }),
      db.order.count({
        where: {
          status: 'PAID',
          shippedAt: { gte: parisDate(today), lt: parisDate(today, true) },
        },
      }),
      db.emailDelivery.count({ where: { status: 'FAILED' } }),
    ]);
  return { unfulfilled, preparing, ready, shippedToday, failedEmails };
}
