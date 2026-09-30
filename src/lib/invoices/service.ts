import 'server-only';
import type {
  InvoiceKind,
  InvoiceSettings,
  Prisma,
} from '@/generated/prisma/client';
import { getPrisma } from '@/lib/db/prisma';
import { toCents } from '@/lib/refunds/amounts';
import {
  buildCreditNote,
  buildInvoice,
  documentNumber,
  parisYear,
  parseInvoiceSnapshot,
  type Seller,
} from './document';

export const SETTINGS_ID = 'caldera';

export function sellerFrom(settings: InvoiceSettings): Seller {
  return {
    legalName: settings.legalName,
    tradeName: settings.tradeName,
    legalForm: settings.legalForm,
    shareCapital: settings.shareCapital,
    street: settings.street,
    postalCode: settings.postalCode,
    city: settings.city,
    country: settings.country,
    siren: settings.siren,
    siret: settings.siret,
    rcsCity: settings.rcsCity,
    vatNumber: settings.vatNumber,
    email: settings.email,
    vatRegime: settings.vatRegime,
    defaultVatRate: settings.defaultVatRate.toFixed(2),
    footer: settings.footer,
  };
}

/** The settings row, created with the database defaults the first time. */
export async function invoiceSettings(tx: Prisma.TransactionClient) {
  return (
    (await tx.invoiceSettings.findUnique({ where: { id: SETTINGS_ID } })) ??
    (await tx.invoiceSettings.upsert({
      where: { id: SETTINGS_ID },
      create: { id: SETTINGS_ID },
      update: {},
    }))
  );
}

/**
 * Next number of a series, taken in the caller's transaction: a rolled back
 * issue gives its number back, so the series never has a gap.
 */
async function nextNumber(
  tx: Prisma.TransactionClient,
  kind: InvoiceKind,
  date: Date,
) {
  const year = parisYear(date);
  const key = `${kind}:${year}`;
  await tx.$executeRaw`INSERT INTO "InvoiceSequence" (id, next) VALUES (${key}, 1) ON CONFLICT (id) DO NOTHING`;
  const [row] = await tx.$queryRaw<{ value: number }[]>`
    UPDATE "InvoiceSequence" SET next = next + 1 WHERE id = ${key}
    RETURNING next - 1 AS value`;
  return documentNumber(kind, year, Number(row!.value));
}

/** Invoice of a paid order, issued once (called when the payment succeeds). */
export async function issueInvoice(
  tx: Prisma.TransactionClient,
  orderId: string,
) {
  const dedupeKey = `INVOICE:${orderId}`;
  const existing = await tx.invoice.findUnique({ where: { dedupeKey } });
  if (existing) return existing;
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: { orderBy: { id: 'asc' } }, addresses: true },
  });
  if (order.status !== 'PAID')
    throw new Error('Facture réservée aux commandes payées.');
  // The regime the order was placed under, whatever the settings say today.
  const seller = {
    ...sellerFrom(await invoiceSettings(tx)),
    vatRegime:
      order.taxMode === 'NONE' ? ('FRANCHISE' as const) : ('STANDARD' as const),
  };
  const stripeTax = order.taxMode === 'STRIPE_TAX' && order.taxCalculationId;
  const issuedAt = new Date();
  const number = await nextNumber(tx, 'INVOICE', issuedAt);
  const billing =
    order.addresses.find((address) => address.role === 'BILLING') ??
    order.addresses.find((address) => address.role === 'SHIPPING');
  const snapshot = buildInvoice({
    number,
    issuedAt,
    seller,
    order: {
      orderNumber: order.orderNumber,
      email: order.email,
      createdAt: order.createdAt,
      paidAt: order.paidAt,
      subtotalAmount: order.subtotalAmount.toFixed(2),
      discountAmount: order.discountAmount.toFixed(2),
      shippingAmount: order.shippingAmount.toFixed(2),
      shippingDiscountAmount: order.shippingDiscountAmount.toFixed(2),
      totalAmount: order.totalAmount.toFixed(2),
      shippingMethodName: order.shippingMethodName,
      promotionCode: order.promotionCode,
      items: order.items.map((item) => ({
        productName: item.productName,
        sku: item.sku,
        language: item.language,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toFixed(2),
        lineTotal: item.lineTotal.toFixed(2),
        discountAmount: item.discountAmount.toFixed(2),
        tax:
          stripeTax && item.taxRate
            ? { rate: item.taxRate.toFixed(2), cents: toCents(item.taxAmount) }
            : null,
      })),
      shippingTax:
        stripeTax && order.shippingTaxRate
          ? {
              rate: order.shippingTaxRate.toFixed(2),
              cents: toCents(order.shippingTaxAmount),
            }
          : null,
      billing,
    },
  });
  return tx.invoice.create({
    data: {
      kind: 'INVOICE',
      number,
      dedupeKey,
      orderId,
      issuedAt,
      currency: order.currency,
      totalAmount: order.totalAmount,
      taxAmount: snapshot.totals.tax,
      snapshot,
    },
  });
}

/**
 * Credit note of a refund Stripe confirmed, issued once. An order paid before
 * invoices existed gets its invoice first. Null for an order that is not
 * (or no longer) paid: nothing was invoiced.
 */
export async function issueCreditNote(
  tx: Prisma.TransactionClient,
  refundId: string,
) {
  const dedupeKey = `CREDIT_NOTE:${refundId}`;
  const existing = await tx.invoice.findUnique({ where: { dedupeKey } });
  if (existing) return existing;
  const refund = await tx.refund.findUniqueOrThrow({
    where: { id: refundId },
    include: {
      order: { select: { status: true, currency: true } },
      items: {
        orderBy: { id: 'asc' },
        include: { orderItem: { select: { productName: true } } },
      },
    },
  });
  if (refund.order.status !== 'PAID' || refund.status !== 'SUCCEEDED')
    return null;
  const invoice = await issueInvoice(tx, refund.orderId);
  const seller = sellerFrom(await invoiceSettings(tx));
  const issuedAt = new Date();
  const number = await nextNumber(tx, 'CREDIT_NOTE', issuedAt);
  const snapshot = buildCreditNote({
    number,
    issuedAt,
    seller,
    invoice: parseInvoiceSnapshot(invoice.snapshot),
    refund: {
      amount: refund.amount.toFixed(2),
      shippingAmount: refund.shippingAmount.toFixed(2),
      succeededAt: refund.succeededAt,
      items: refund.items.map((item) => ({
        productName: item.orderItem.productName,
        quantity: item.quantity,
        amount: item.amount.toFixed(2),
      })),
    },
  });
  return tx.invoice.create({
    data: {
      kind: 'CREDIT_NOTE',
      number,
      dedupeKey,
      orderId: refund.orderId,
      refundId,
      invoiceId: invoice.id,
      issuedAt,
      currency: refund.order.currency,
      totalAmount: refund.amount,
      taxAmount: snapshot.totals.tax,
      snapshot,
    },
  });
}

/** Documents of an order, oldest first (invoice, then credit notes). */
export function orderDocuments(orderId: string) {
  return getPrisma().invoice.findMany({
    where: { orderId },
    orderBy: [{ issuedAt: 'asc' }, { number: 'asc' }],
    select: {
      id: true,
      kind: true,
      number: true,
      issuedAt: true,
      totalAmount: true,
    },
  });
}
