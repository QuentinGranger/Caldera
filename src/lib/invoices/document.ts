// Invoices and credit notes as printed: built once, when issued, from plain
// data, then stored as JSON (Invoice.snapshot). Pure module: shared by the
// service, the PDF renderer and the unit tests.
import { fromCents, toCents } from '@/lib/refunds/amounts';

export type VatRegimeCode = 'FRANCHISE' | 'STANDARD';

export type Seller = {
  legalName: string;
  tradeName: string;
  legalForm: string;
  shareCapital: string | null;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  siren: string | null;
  siret: string | null;
  rcsCity: string | null;
  vatNumber: string | null;
  email: string;
  vatRegime: VatRegimeCode;
  /** Percent, e.g. « 20.00 ». */
  defaultVatRate: string;
  footer: string | null;
};

export type InvoiceLine = {
  description: string;
  detail: string | null;
  quantity: number;
  /** VAT included, before discount; null when meaningless (credit note). */
  unitPrice: string | null;
  discount: string;
  /** VAT included, after discount. */
  total: string;
  /** Percent, or null under the VAT franchise. */
  taxRate: string | null;
  taxAmount: string;
};

export type InvoiceSnapshot = {
  version: 1;
  kind: 'INVOICE' | 'CREDIT_NOTE';
  number: string;
  issuedAt: string;
  seller: { name: string; tradeName: string; lines: string[]; email: string };
  buyer: { name: string; lines: string[]; email: string };
  order: { number: string; createdAt: string; paidAt: string | null };
  /** Credit note: the invoice it corrects. */
  reference: string | null;
  lines: InvoiceLine[];
  totals: {
    /** Items before discount. */
    items: string;
    discount: string;
    total: string;
    tax: string;
    /** Excluding VAT. */
    net: string;
  };
  vatMention: string | null;
  taxBreakdown: { rate: string; base: string; tax: string }[];
  payment: string;
  footer: string | null;
};

export const FRANCHISE_MENTION =
  'TVA non applicable, article 293 B du Code général des impôts.';

const PREFIX = { INVOICE: 'F', CREDIT_NOTE: 'AV' } as const;

/** « F-2026-000042 »: one gap-free series per kind and calendar year. */
export function documentNumber(
  kind: 'INVOICE' | 'CREDIT_NOTE',
  year: number,
  sequence: number,
) {
  if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > 999999)
    throw new RangeError('Numéro de facture hors limites.');
  return `${PREFIX[kind]}-${year}-${String(sequence).padStart(6, '0')}`;
}

/** Calendar year in Paris: a sale at 00:30 on 1 January belongs to the new year. */
export function parisYear(date: Date) {
  return Number(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Paris',
      year: 'numeric',
    }).format(date),
  );
}

export function sellerLines(seller: Seller) {
  return [
    `${seller.legalForm}${seller.shareCapital ? ` au capital de ${seller.shareCapital}` : ''}`,
    seller.street,
    `${seller.postalCode} ${seller.city}`,
    seller.country,
    seller.siren
      ? `SIREN ${seller.siren}${seller.siret ? ` · SIRET ${seller.siret}` : ''}`
      : 'SIREN : immatriculation en cours',
    ...(seller.siren && seller.rcsCity
      ? [`RCS ${seller.rcsCity} ${seller.siren}`]
      : []),
    ...(seller.vatRegime === 'STANDARD' && seller.vatNumber
      ? [`TVA intracommunautaire ${seller.vatNumber}`]
      : []),
  ];
}

/** Legal mentions still missing: shown to the administrator, never guessed. */
export function missingMentions(seller: Seller) {
  return [
    ...(!seller.siren ? ['SIREN'] : []),
    ...(!seller.rcsCity ? ['ville du RCS'] : []),
    ...(!seller.shareCapital && /SAS|SARL|SA\b|EURL/i.test(seller.legalForm)
      ? ['capital social']
      : []),
    ...(seller.vatRegime === 'STANDARD' && !seller.vatNumber
      ? ['numéro de TVA intracommunautaire']
      : []),
  ];
}

/** VAT included in `totalCents` at `rate` percent, rounded to the cent. */
export function includedTax(totalCents: number, rate: number) {
  return totalCents - Math.round((totalCents * 100) / (100 + rate));
}

function withTax(
  line: Omit<InvoiceLine, 'taxRate' | 'taxAmount'>,
  seller: Seller,
  override?: { rate: string; cents: number },
): InvoiceLine {
  if (seller.vatRegime === 'FRANCHISE')
    return { ...line, taxRate: null, taxAmount: '0.00' };
  const rate = override?.rate ?? seller.defaultVatRate;
  return {
    ...line,
    taxRate: rate,
    taxAmount: fromCents(
      override?.cents ?? includedTax(toCents(line.total), Number(rate)),
    ),
  };
}

function summarize(lines: InvoiceLine[], seller: Seller, totalCents: number) {
  const tax = lines.reduce((sum, line) => sum + toCents(line.taxAmount), 0);
  const byRate = new Map<string, { base: number; tax: number }>();
  if (seller.vatRegime === 'STANDARD')
    for (const line of lines) {
      const entry = byRate.get(line.taxRate!) ?? { base: 0, tax: 0 };
      entry.tax += toCents(line.taxAmount);
      entry.base += toCents(line.total) - toCents(line.taxAmount);
      byRate.set(line.taxRate!, entry);
    }
  return {
    tax,
    vatMention: seller.vatRegime === 'FRANCHISE' ? FRANCHISE_MENTION : null,
    taxBreakdown: [...byRate].map(([rate, entry]) => ({
      rate,
      base: fromCents(entry.base),
      tax: fromCents(entry.tax),
    })),
    net: totalCents - tax,
  };
}

type Party = {
  firstName: string;
  lastName: string;
  company: string | null;
  addressLine1: string;
  addressLine2: string | null;
  postalCode: string;
  city: string;
  countryCode: string;
};

function buyer(address: Party | undefined, email: string) {
  return {
    name: address ? `${address.firstName} ${address.lastName}` : email,
    lines: address
      ? [
          address.company,
          address.addressLine1,
          address.addressLine2,
          `${address.postalCode} ${address.city}`,
          address.countryCode,
        ].filter((line): line is string => Boolean(line))
      : [],
    email,
  };
}

const day = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'long',
  timeZone: 'Europe/Paris',
});

export type OrderForInvoice = {
  orderNumber: string;
  email: string;
  createdAt: Date;
  paidAt: Date | null;
  subtotalAmount: string;
  discountAmount: string;
  shippingAmount: string;
  shippingDiscountAmount: string;
  totalAmount: string;
  shippingMethodName: string;
  promotionCode: string | null;
  items: {
    productName: string;
    sku: string;
    language: string;
    quantity: number;
    unitPrice: string;
    lineTotal: string;
    discountAmount: string;
    /** Stripe Tax result for this line, when VAT was calculated at checkout. */
    tax?: { rate: string; cents: number } | null;
  }[];
  shippingTax?: { rate: string; cents: number } | null;
  billing: Party | undefined;
};

export function buildInvoice({
  number,
  issuedAt,
  seller,
  order,
}: {
  number: string;
  issuedAt: Date;
  seller: Seller;
  order: OrderForInvoice;
}): InvoiceSnapshot {
  const lines = order.items.map((item) =>
    withTax(
      {
        description: item.productName,
        detail: `${item.sku} · ${item.language}`,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discountAmount,
        total: fromCents(
          toCents(item.lineTotal) - toCents(item.discountAmount),
        ),
      },
      seller,
      item.tax ?? undefined,
    ),
  );
  const shippingPrice =
    toCents(order.shippingAmount) + toCents(order.shippingDiscountAmount);
  lines.push(
    withTax(
      {
        description: `Livraison — ${order.shippingMethodName}`,
        detail:
          toCents(order.shippingDiscountAmount) > 0 && order.promotionCode
            ? `Offerte avec le code ${order.promotionCode}`
            : null,
        quantity: 1,
        unitPrice: fromCents(shippingPrice),
        discount: order.shippingDiscountAmount,
        total: order.shippingAmount,
      },
      seller,
      order.shippingTax ?? undefined,
    ),
  );
  const total = toCents(order.totalAmount);
  const summary = summarize(lines, seller, total);
  return {
    version: 1,
    kind: 'INVOICE',
    number,
    issuedAt: issuedAt.toISOString(),
    seller: {
      name: seller.legalName,
      tradeName: seller.tradeName,
      lines: sellerLines(seller),
      email: seller.email,
    },
    buyer: buyer(order.billing, order.email),
    order: {
      number: order.orderNumber,
      createdAt: order.createdAt.toISOString(),
      paidAt: order.paidAt?.toISOString() ?? null,
    },
    reference: null,
    lines,
    totals: {
      items: order.subtotalAmount,
      discount: fromCents(
        toCents(order.discountAmount) + toCents(order.shippingDiscountAmount),
      ),
      total: order.totalAmount,
      tax: fromCents(summary.tax),
      net: fromCents(summary.net),
    },
    vatMention: summary.vatMention,
    taxBreakdown: summary.taxBreakdown,
    payment: order.paidAt
      ? `Payée par carte bancaire le ${day.format(order.paidAt)}.`
      : 'Paiement par carte bancaire.',
    footer: seller.footer,
  };
}

export function buildCreditNote({
  number,
  issuedAt,
  seller,
  invoice,
  refund,
}: {
  number: string;
  issuedAt: Date;
  seller: Seller;
  /** The invoice being corrected, as issued. */
  invoice: InvoiceSnapshot;
  refund: {
    amount: string;
    shippingAmount: string;
    succeededAt: Date | null;
    items: { productName: string; quantity: number; amount: string }[];
  };
}): InvoiceSnapshot {
  const rateOf = (description: string) =>
    invoice.lines.find((line) => line.description === description)?.taxRate;
  const lines: InvoiceLine[] = refund.items.map((item) =>
    withTax(
      {
        description: item.productName,
        detail: 'Article remboursé',
        quantity: item.quantity,
        unitPrice: null,
        discount: '0.00',
        total: item.amount,
      },
      seller,
      rateOf(item.productName)
        ? {
            rate: rateOf(item.productName)!,
            cents: includedTax(
              toCents(item.amount),
              Number(rateOf(item.productName)),
            ),
          }
        : undefined,
    ),
  );
  if (toCents(refund.shippingAmount) > 0)
    lines.push(
      withTax(
        {
          description: 'Frais de livraison',
          detail: null,
          quantity: 1,
          unitPrice: null,
          discount: '0.00',
          total: refund.shippingAmount,
        },
        seller,
      ),
    );
  const goodwill =
    toCents(refund.amount) -
    lines.reduce((sum, line) => sum + toCents(line.total), 0);
  if (goodwill > 0)
    lines.push(
      withTax(
        {
          description: 'Geste commercial',
          detail: null,
          quantity: 1,
          unitPrice: null,
          discount: '0.00',
          total: fromCents(goodwill),
        },
        seller,
      ),
    );
  const total = toCents(refund.amount);
  const summary = summarize(lines, seller, total);
  return {
    version: 1,
    kind: 'CREDIT_NOTE',
    number,
    issuedAt: issuedAt.toISOString(),
    seller: {
      name: seller.legalName,
      tradeName: seller.tradeName,
      lines: sellerLines(seller),
      email: seller.email,
    },
    buyer: invoice.buyer,
    order: invoice.order,
    reference: `Avoir sur la facture ${invoice.number}`,
    lines,
    totals: {
      items: refund.amount,
      discount: '0.00',
      total: refund.amount,
      tax: fromCents(summary.tax),
      net: fromCents(summary.net),
    },
    vatMention: summary.vatMention,
    taxBreakdown: summary.taxBreakdown,
    payment: `Remboursé sur le moyen de paiement d’origine${
      refund.succeededAt ? ` le ${day.format(refund.succeededAt)}` : ''
    }.`,
    footer: seller.footer,
  };
}

/** Structural check of a stored snapshot before rendering it. */
export function parseInvoiceSnapshot(value: unknown): InvoiceSnapshot {
  const row = value as InvoiceSnapshot | null;
  if (
    !row ||
    row.version !== 1 ||
    !['INVOICE', 'CREDIT_NOTE'].includes(row.kind) ||
    typeof row.number !== 'string' ||
    !Array.isArray(row.lines) ||
    !row.totals ||
    typeof row.totals.total !== 'string' ||
    !Array.isArray(row.seller?.lines) ||
    !Array.isArray(row.buyer?.lines)
  )
    throw new Error('Facture illisible.');
  return row;
}
