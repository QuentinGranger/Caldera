import 'server-only';
import { Prisma } from '@/generated/prisma/client';
import { getPrisma } from '@/lib/db/prisma';
import { requireAdmin } from './auth';
import { landedCost } from '@/lib/finance/landedCost';
import {
  breakEvenRevenue,
  estimatedPaymentFees,
  monthlyOperatingBudget,
  reinvestmentCapacity,
} from '@/lib/finance/businessMetrics';
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
  const [rawItems, variants, productOptions, refunds, paidOrders] =
    await Promise.all([
    db.orderItem.findMany({
      where: { order: orderWhere },
      select: {
        productId: true,
        productName: true,
        lineTotal: true,
        discountAmount: true,
        unitCost: true,
        quantity: true,
        order: { select: { paidAt: true } },
        refundItems: {
          where: { refund: { status: 'SUCCEEDED' } },
          select: {
            amount: true,
            quantity: true,
            refund: { select: { restockedAt: true } },
          },
        },
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
        inboundShippingCost: true,
        procurementFees: true,
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
    db.refund.findMany({
      where: { status: 'SUCCEEDED', order: orderWhere },
      select: {
        amount: true,
        shippingAmount: true,
        items: { select: { amount: true } },
      },
    }),
    db.order.findMany({
      where: orderWhere,
      select: { totalAmount: true, paidAt: true },
    }),
  ]);

  // Revenue net of promotional discounts and refunds. Items put back in stock are no longer sold (nor
  // their cost spent); refunded but lost ones still cost their purchase price.
  const items = rawItems.map((item) => {
    const returned = item.refundItems.reduce(
      (sum, refund) => sum + (refund.refund.restockedAt ? refund.quantity : 0),
      0,
    );
    return {
      ...item,
      lineTotal:
        number(item.lineTotal) -
        number(item.discountAmount) -
        item.refundItems.reduce((sum, refund) => sum + number(refund.amount), 0),
      quantity: item.quantity - returned,
    };
  });
  // A goodwill refund without items: taken off the revenue and the margin.
  const goodwill = refunds.reduce(
    (sum, refund) =>
      sum +
      number(refund.amount) -
      number(refund.shippingAmount) -
      refund.items.reduce((total, item) => total + number(item.amount), 0),
    0,
  );
  const refunded = refunds.reduce(
    (sum, refund) => sum + number(refund.amount),
    0,
  );

  const settings = {
    revenueTarget: stored?.revenueTarget.toFixed(2) ?? '10000.00',
    minimumMarginRate: stored?.minimumMarginRate.toFixed(2) ?? '20.00',
    maxStockBudget: stored?.maxStockBudget.toFixed(2) ?? '1000.00',
    cashBalance: stored?.cashBalance.toFixed(2) ?? '0.00',
    cashReserveTarget: stored?.cashReserveTarget.toFixed(2) ?? '0.00',
    monthlyFixedCosts: stored?.monthlyFixedCosts.toFixed(2) ?? '0.00',
    monthlyPackagingBudget:
      stored?.monthlyPackagingBudget.toFixed(2) ?? '0.00',
    monthlyShippingBudget:
      stored?.monthlyShippingBudget.toFixed(2) ?? '0.00',
    monthlyMarketingBudget:
      stored?.monthlyMarketingBudget.toFixed(2) ?? '0.00',
    monthlyOtherCosts: stored?.monthlyOtherCosts.toFixed(2) ?? '0.00',
    paymentFeeRate: stored?.paymentFeeRate.toFixed(2) ?? '0.00',
    paymentFixedFee: stored?.paymentFixedFee.toFixed(2) ?? '0.00',
    reinvestmentRate: stored?.reinvestmentRate.toFixed(2) ?? '100.00',
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
  revenue -= goodwill;
  if (coveredRevenue > 0) coveredRevenue = Math.max(0, coveredRevenue - goodwill);

  let stockValue = 0;
  let stockUnits = 0;
  let stockUnitsWithoutCost = 0;
  for (const variant of variants) {
    stockUnits += variant.stockQuantity;
    const unitLandedCost = landedCost(variant);
    if (unitLandedCost === null) stockUnitsWithoutCost += variant.stockQuantity;
    else stockValue += number(unitLandedCost) * variant.stockQuantity;
  }

  const grossMarginAmount = coveredRevenue - costOfGoodsSold;
  const grossMarginRate = percent(grossMarginAmount, coveredRevenue);
  const marginCoverage = percent(coveredRevenue, revenue);
  const rotation30d = stockUnits > 0 ? soldUnits30 / stockUnits : null;
  const dailySales = soldUnits30 / 30;
  const stockDays = dailySales > 0 ? stockUnits / dailySales : null;
  const target = Number(settings.revenueTarget);
  const stockBudget = Number(settings.maxStockBudget);
  const paidOrderCount = paidOrders.length;
  const collected = paidOrders.reduce(
    (sum, order) => sum + number(order.totalAmount),
    0,
  );
  const averageOrderValue =
    paidOrderCount > 0 ? collected / paidOrderCount : null;
  const paymentFees = estimatedPaymentFees({
    collected,
    orderCount: paidOrderCount,
    percentageRate: Number(settings.paymentFeeRate),
    fixedFee: Number(settings.paymentFixedFee),
  });
  const operatingBudget = monthlyOperatingBudget({
    fixed: Number(settings.monthlyFixedCosts),
    packaging: Number(settings.monthlyPackagingBudget),
    shipping: Number(settings.monthlyShippingBudget),
    marketing: Number(settings.monthlyMarketingBudget),
    other: Number(settings.monthlyOtherCosts),
  });
  const earliestPaidAt = paidOrders.reduce<Date | null>((earliest, order) => {
    if (!order.paidAt) return earliest;
    return !earliest || order.paidAt < earliest ? order.paidAt : earliest;
  }, null);
  const periodStart = trackingStartDate ?? earliestPaidAt ?? new Date();
  const elapsedDays = Math.max(
    1,
    (Date.now() - periodStart.getTime()) / 86400000,
  );
  // A very short launch period is not extrapolated as a full monthly run-rate.
  const observedMonths = Math.max(1, elapsedDays / 30.4375);
  const monthlyRevenue = revenue / observedMonths;
  const monthlyGrossMargin = grossMarginAmount / observedMonths;
  const monthlyPaymentFees = paymentFees / observedMonths;
  const estimatedMonthlyResult =
    monthlyGrossMargin - monthlyPaymentFees - operatingBudget;
  const estimatedNetMarginRate = percent(estimatedMonthlyResult, monthlyRevenue);
  const breakEven = breakEvenRevenue({
    monthlyOperatingCosts: operatingBudget,
    grossMarginRate,
    paymentFeeRate: Number(settings.paymentFeeRate),
    averageOrderValue,
    paymentFixedFee: Number(settings.paymentFixedFee),
  });
  const reinvestment = reinvestmentCapacity({
    cashBalance: Number(settings.cashBalance),
    reserveTarget: Number(settings.cashReserveTarget),
    reinvestmentRate: Number(settings.reinvestmentRate),
    stockBudget,
    stockValue,
  });
  const reserveGap = Math.max(
    0,
    Number(settings.cashReserveTarget) - Number(settings.cashBalance),
  );

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
          (() => {
            const unitLandedCost = landedCost(variant);
            return unitLandedCost === null
              ? 0
              : number(unitLandedCost) * variant.stockQuantity;
          })(),
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
      refunded,
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
      cashReserveTarget: Number(settings.cashReserveTarget),
      reserveGap,
      cashAboveReserve: reinvestment.cashAboveReserve,
      reinvestmentCapacity: reinvestment.capacity,
      stockHeadroom: reinvestment.stockHeadroom,
      monthlyOperatingBudget: operatingBudget,
      paidOrderCount,
      collected,
      averageOrderValue,
      estimatedPaymentFees: paymentFees,
      monthlyPaymentFees,
      monthlyRevenue,
      monthlyGrossMargin,
      estimatedMonthlyResult,
      estimatedNetMarginRate,
      breakEvenRevenue: breakEven,
      observedMonths,
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
    'cashReserveTarget',
    'monthlyFixedCosts',
    'monthlyPackagingBudget',
    'monthlyShippingBudget',
    'monthlyMarketingBudget',
    'monthlyOtherCosts',
    'paymentFeeRate',
    'paymentFixedFee',
    'reinvestmentRate',
    'trackingStartDate',
    'launchProductId',
  ]);
  const revenueTarget = money(form, 'revenueTarget')!;
  const minimumMarginRate = money(form, 'minimumMarginRate')!;
  const maxStockBudget = money(form, 'maxStockBudget')!;
  const cashBalance = signedMoney(form, 'cashBalance');
  const cashReserveTarget = money(form, 'cashReserveTarget')!;
  const monthlyFixedCosts = money(form, 'monthlyFixedCosts')!;
  const monthlyPackagingBudget = money(form, 'monthlyPackagingBudget')!;
  const monthlyShippingBudget = money(form, 'monthlyShippingBudget')!;
  const monthlyMarketingBudget = money(form, 'monthlyMarketingBudget')!;
  const monthlyOtherCosts = money(form, 'monthlyOtherCosts')!;
  const paymentFeeRate = money(form, 'paymentFeeRate')!;
  const paymentFixedFee = money(form, 'paymentFixedFee')!;
  const reinvestmentRate = money(form, 'reinvestmentRate')!;
  const trackingStartDate = date(form, 'trackingStartDate');
  if (number(revenueTarget) <= 0)
    throw new AdminError("L'objectif de chiffre d'affaires doit être supérieur à 0 €.");
  if (number(minimumMarginRate) < 0 || number(minimumMarginRate) > 100)
    throw new AdminError('La marge minimale doit être comprise entre 0 et 100 %.');
  if (number(paymentFeeRate) < 0 || number(paymentFeeRate) > 100)
    throw new AdminError(
      'Le taux de frais de paiement doit être compris entre 0 et 100 %.',
    );
  if (number(reinvestmentRate) < 0 || number(reinvestmentRate) > 100)
    throw new AdminError(
      'Le taux de réinvestissement doit être compris entre 0 et 100 %.',
    );

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
        cashReserveTarget,
        monthlyFixedCosts,
        monthlyPackagingBudget,
        monthlyShippingBudget,
        monthlyMarketingBudget,
        monthlyOtherCosts,
        paymentFeeRate,
        paymentFixedFee,
        reinvestmentRate,
        trackingStartDate,
      },
      update: {
        revenueTarget,
        minimumMarginRate,
        maxStockBudget,
        cashBalance,
        cashReserveTarget,
        monthlyFixedCosts,
        monthlyPackagingBudget,
        monthlyShippingBudget,
        monthlyMarketingBudget,
        monthlyOtherCosts,
        paymentFeeRate,
        paymentFixedFee,
        reinvestmentRate,
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
