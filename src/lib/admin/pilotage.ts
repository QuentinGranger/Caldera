import 'server-only';
import { Prisma } from '@/generated/prisma/client';
import { getPrisma } from '@/lib/db/prisma';
import { requireAdmin } from './auth';
import { AdminError, date, money, text, uuid, whitelist } from './validation';

const SETTINGS_ID = 'caldera';

function number(value: { toString(): string } | null | undefined) {
  return value == null ? 0 : Number(value.toString());
}

function percent(value: number, total: number) {
  return total > 0 ? (value / total) * 100 : 0;
}

function signedMoney(form: FormData, key: string) {
  const value = text(form, key, 20).replace(',', '.');
  if (!/^-?\d{1,8}(\.\d{1,2})?$/.test(value))
    throw new AdminError(
      `Montant ${key} invalide : deux décimales maximum.`,
    );
  return new Prisma.Decimal(value);
}

export async function getBusinessPilotage() {
  await requireAdmin();
  const db = getPrisma();
  const stored = await db.businessPilotageSettings.findUnique({
    where: { id: SETTINGS_ID },
    include: { launchProducts: { select: { productId: true } } },
  });
  const trackingStartDate = stored?.trackingStartDate ?? null;
  const orderWhere = {
    status: 'PAID' as const,
    ...(trackingStartDate ? { paidAt: { gte: trackingStartDate } } : {}),
  };
  const [items, variants, productOptions] = await Promise.all([
    db.orderItem.findMany({
      where: { order: orderWhere },
      select: {
        productId: true,
        productName: true,
        lineTotal: true,
        unitCost: true,
        quantity: true,
        order: { select: { paidAt: true } },
      },
    }),
    db.productVariant.findMany({
      where: {
        isActive: true,
        product: { status: { not: 'ARCHIVED' } },
      },
      select: {
        productId: true,
        stockQuantity: true,
        costPrice: true,
      },
    }),
    db.product.findMany({
      where: {
        OR: [
          { status: { not: 'ARCHIVED' } },
          { pilotageLaunches: { some: { settingsId: SETTINGS_ID } } },
        ],
      },
      select: { id: true, name: true, productType: true, status: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    }),
  ]);

  const settings = {
    revenueTarget: stored?.revenueTarget.toFixed(2) ?? '10000.00',
    minimumMarginRate: stored?.minimumMarginRate.toFixed(2) ?? '20.00',
    maxStockBudget: stored?.maxStockBudget.toFixed(2) ?? '1000.00',
    cashBalance: stored?.cashBalance.toFixed(2) ?? '0.00',
    trackingStartDate: trackingStartDate?.toISOString().slice(0, 10) ?? '',
    launchProductIds: stored?.launchProducts.map((item) => item.productId) ?? [],
  };

  let revenue = 0;
  let coveredRevenue = 0;
  let costOfGoodsSold = 0;
  let soldUnits30 = 0;
  const since30 = Date.now() - 30 * 86400000;

  for (const item of items) {
    const lineRevenue = number(item.lineTotal);
    revenue += lineRevenue;
    if (item.unitCost !== null) {
      coveredRevenue += lineRevenue;
      costOfGoodsSold += number(item.unitCost) * item.quantity;
    }
    if (item.order.paidAt && item.order.paidAt.getTime() >= since30)
      soldUnits30 += item.quantity;
  }

  let stockValue = 0;
  let stockUnits = 0;
  let stockUnitsWithoutCost = 0;
  for (const variant of variants) {
    stockUnits += variant.stockQuantity;
    if (variant.costPrice === null) stockUnitsWithoutCost += variant.stockQuantity;
    else stockValue += number(variant.costPrice) * variant.stockQuantity;
  }

  const grossMarginAmount = coveredRevenue - costOfGoodsSold;
  const grossMarginRate = percent(grossMarginAmount, coveredRevenue);
  const marginCoverage = percent(coveredRevenue, revenue);
  const rotation30d = stockUnits > 0 ? soldUnits30 / stockUnits : null;
  const dailySales = soldUnits30 / 30;
  const stockDays = dailySales > 0 ? stockUnits / dailySales : null;
  const target = Number(settings.revenueTarget);
  const stockBudget = Number(settings.maxStockBudget);

  const launchProducts = productOptions
    .filter((product) => settings.launchProductIds.includes(product.id))
    .map((product) => {
      const productItems = items.filter((item) => item.productId === product.id);
      const productVariants = variants.filter(
        (variant) => variant.productId === product.id,
      );
      const productRevenue = productItems.reduce(
        (sum, item) => sum + number(item.lineTotal),
        0,
      );
      const productCoveredRevenue = productItems.reduce(
        (sum, item) =>
          sum + (item.unitCost === null ? 0 : number(item.lineTotal)),
        0,
      );
      const productCost = productItems.reduce(
        (sum, item) =>
          sum +
          (item.unitCost === null ? 0 : number(item.unitCost) * item.quantity),
        0,
      );
      const productStockUnits = productVariants.reduce(
        (sum, variant) => sum + variant.stockQuantity,
        0,
      );
      const productStockValue = productVariants.reduce(
        (sum, variant) =>
          sum +
          (variant.costPrice === null
            ? 0
            : number(variant.costPrice) * variant.stockQuantity),
        0,
      );
      return {
        ...product,
        revenue: productRevenue,
        soldUnits: productItems.reduce((sum, item) => sum + item.quantity, 0),
        stockUnits: productStockUnits,
        stockValue: productStockValue,
        marginRate:
          productCoveredRevenue > 0
            ? percent(productCoveredRevenue - productCost, productCoveredRevenue)
            : null,
      };
    });

  return {
    settings,
    productOptions,
    launchProducts,
    metrics: {
      revenue,
      revenueTarget: target,
      targetProgress: percent(revenue, target),
      coveredRevenue,
      costOfGoodsSold,
      grossMarginAmount,
      grossMarginRate,
      marginCoverage,
      minimumMarginRate: Number(settings.minimumMarginRate),
      stockValue,
      stockBudget,
      stockBudgetUsage: percent(stockValue, stockBudget),
      stockUnits,
      stockUnitsWithoutCost,
      cashBalance: Number(settings.cashBalance),
      soldUnits30,
      rotation30d,
      stockDays,
    },
  };
}

export async function saveBusinessPilotage(form: FormData) {
  whitelist(form, [
    'revenueTarget',
    'minimumMarginRate',
    'maxStockBudget',
    'cashBalance',
    'trackingStartDate',
    'launchProductId',
  ]);
  const revenueTarget = money(form, 'revenueTarget')!;
  const minimumMarginRate = money(form, 'minimumMarginRate')!;
  const maxStockBudget = money(form, 'maxStockBudget')!;
  const cashBalance = signedMoney(form, 'cashBalance');
  const trackingStartDate = date(form, 'trackingStartDate');
  if (number(revenueTarget) <= 0)
    throw new AdminError("L'objectif de chiffre d'affaires doit être supérieur à 0 €.");
  if (number(minimumMarginRate) < 0 || number(minimumMarginRate) > 100)
    throw new AdminError('La marge minimale doit être comprise entre 0 et 100 %.');

  const launchProductIds = [
    ...new Set(
      form
        .getAll('launchProductId')
        .map((value) => {
          if (typeof value !== 'string')
            throw new AdminError('Produit de lancement invalide.');
          return uuid(value);
        }),
    ),
  ];

  const db = getPrisma();
  return db.$transaction(async (tx) => {
    if (launchProductIds.length) {
      const count = await tx.product.count({
        where: { id: { in: launchProductIds }, status: { not: 'ARCHIVED' } },
      });
      if (count !== launchProductIds.length)
        throw new AdminError(
          'Un produit de lancement est introuvable ou archivé. Rechargez la page.',
        );
    }
    const settings = await tx.businessPilotageSettings.upsert({
      where: { id: SETTINGS_ID },
      create: {
        id: SETTINGS_ID,
        revenueTarget,
        minimumMarginRate,
        maxStockBudget,
        cashBalance,
        trackingStartDate,
      },
      update: {
        revenueTarget,
        minimumMarginRate,
        maxStockBudget,
        cashBalance,
        trackingStartDate,
      },
    });
    await tx.businessPilotageLaunchProduct.deleteMany({
      where: { settingsId: SETTINGS_ID },
    });
    if (launchProductIds.length)
      await tx.businessPilotageLaunchProduct.createMany({
        data: launchProductIds.map((productId) => ({
          settingsId: SETTINGS_ID,
          productId,
        })),
      });
    return settings;
  });
}
