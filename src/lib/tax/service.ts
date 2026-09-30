import 'server-only';
import type { Prisma, TaxMode } from '@/generated/prisma/client';
import { getPrisma } from '@/lib/db/prisma';
import { invoiceSettings } from '@/lib/invoices/service';
import { transaction } from '@/lib/orders/common';
import { fromCents, toCents } from '@/lib/refunds/amounts';
import {
  stripeTaxGateway,
  TaxProviderError,
  type TaxGateway,
} from './gateway';

/** The regime a new order is placed under, frozen on the order. */
export async function currentTaxMode(
  tx: Prisma.TransactionClient,
): Promise<TaxMode> {
  const settings = await invoiceSettings(tx);
  if (settings.vatRegime === 'FRANCHISE') return 'NONE';
  return settings.stripeTaxEnabled ? 'STRIPE_TAX' : 'LOCAL';
}

function log(action: string, id: string, error: unknown) {
  console.error(
    JSON.stringify({
      scope: 'stripe_tax',
      action,
      id,
      code: error instanceof TaxProviderError ? error.code : 'UNEXPECTED',
    }),
  );
}

/**
 * VAT of a Stripe Tax order, calculated before the payment (the total does not
 * change: prices include VAT). Stored once; never blocks the payment.
 */
export async function ensureTaxCalculation(
  orderId: string,
  gateway: TaxGateway = stripeTaxGateway,
) {
  const db = getPrisma();
  const order = await db.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: { orderBy: { id: 'asc' } }, addresses: true },
  });
  if (order.taxMode !== 'STRIPE_TAX' || order.taxCalculationId) return order;
  const settings = await invoiceSettings(db);
  const address = order.addresses.find((row) => row.role === 'SHIPPING');
  if (!address) throw new TaxProviderError('ADRESSE_DE_LIVRAISON_ABSENTE');
  const calculation = await gateway.calculate({
    lines: order.items.map((item) => ({
      reference: item.id,
      amountCents: toCents(item.lineTotal) - toCents(item.discountAmount),
      taxCode: settings.productTaxCode,
    })),
    shipping: {
      amountCents: toCents(order.shippingAmount),
      taxCode: settings.shippingTaxCode,
    },
    address: {
      line1: address.addressLine1,
      line2: address.addressLine2,
      postalCode: address.postalCode,
      city: address.city,
      country: address.countryCode,
    },
  });
  return transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId}::uuid FOR UPDATE`;
    const current = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
    });
    if (current.taxCalculationId) return current;
    for (const line of calculation.lines) {
      const item = order.items.find((row) => row.id === line.reference);
      if (!item) throw new TaxProviderError('LIGNE_INCONNUE');
      await tx.orderItem.update({
        where: { id: item.id },
        data: { taxAmount: fromCents(line.taxCents), taxRate: line.rate },
      });
    }
    return tx.order.update({
      where: { id: orderId },
      data: {
        taxCalculationId: calculation.id,
        taxAmount: fromCents(calculation.taxCents),
        shippingTaxAmount: fromCents(calculation.shipping.taxCents),
        shippingTaxRate: calculation.shipping.rate,
      },
    });
  });
}

/** Same, logging instead of failing: the checkout must go on without it. */
export async function tryTaxCalculation(orderId: string, gateway?: TaxGateway) {
  try {
    await ensureTaxCalculation(orderId, gateway);
  } catch (error) {
    log('calculation_retry_needed', orderId, error);
  }
}

/**
 * Stripe Tax bookkeeping that could not be done on the spot: calculations,
 * the sale once paid, reversals of confirmed refunds. Idempotent keys make
 * every retry safe.
 */
export async function syncTax({
  gateway = stripeTaxGateway,
  limit = 20,
}: { gateway?: TaxGateway; limit?: number } = {}) {
  const db = getPrisma();
  let synced = 0;
  let failed = 0;
  const orders = await db.order.findMany({
    where: {
      taxMode: 'STRIPE_TAX',
      status: 'PAID',
      taxTransactionId: null,
    },
    orderBy: { paidAt: 'asc' },
    take: limit,
    select: { id: true, orderNumber: true },
  });
  for (const row of orders) {
    try {
      const order = await ensureTaxCalculation(row.id, gateway);
      const id = await gateway.record(
        order.taxCalculationId!,
        row.orderNumber,
        `caldera-tax:${row.id}`,
      );
      await db.order.updateMany({
        where: { id: row.id, taxTransactionId: null },
        data: { taxTransactionId: id },
      });
      synced++;
    } catch (error) {
      failed++;
      log('transaction_retry_needed', row.id, error);
    }
  }
  const refunds = await db.refund.findMany({
    where: {
      status: 'SUCCEEDED',
      taxReversalId: null,
      order: { taxMode: 'STRIPE_TAX', taxTransactionId: { not: null } },
    },
    orderBy: { succeededAt: 'asc' },
    take: limit,
    select: {
      id: true,
      amount: true,
      order: { select: { taxTransactionId: true } },
    },
  });
  for (const refund of refunds) {
    try {
      const id = await gateway.reverse(
        refund.order.taxTransactionId!,
        `refund-${refund.id}`,
        toCents(refund.amount),
        `caldera-tax-reversal:${refund.id}`,
      );
      await db.refund.updateMany({
        where: { id: refund.id, taxReversalId: null },
        data: { taxReversalId: id },
      });
      synced++;
    } catch (error) {
      failed++;
      log('reversal_retry_needed', refund.id, error);
    }
  }
  return { synced, failed };
}

/** Whether there is anything for the job to do, without calling Stripe. */
export async function taxWorkPending() {
  const db = getPrisma();
  const [orders, refunds] = await Promise.all([
    db.order.count({
      where: { taxMode: 'STRIPE_TAX', status: 'PAID', taxTransactionId: null },
    }),
    db.refund.count({
      where: {
        status: 'SUCCEEDED',
        taxReversalId: null,
        order: { taxMode: 'STRIPE_TAX', taxTransactionId: { not: null } },
      },
    }),
  ]);
  return orders + refunds > 0;
}
