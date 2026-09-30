import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PDFDocument } from 'pdf-lib';
import {
  buildCreditNote,
  buildInvoice,
  documentNumber,
  FRANCHISE_MENTION,
  includedTax,
  missingMentions,
  parisYear,
  parseInvoiceSnapshot,
  sellerLines,
  type OrderForInvoice,
  type Seller,
} from '../src/lib/invoices/document';
import { renderInvoicePdf } from '../src/lib/invoices/pdf';

const seller: Seller = {
  legalName: 'CALDERA',
  tradeName: 'Les Terres de Caldera',
  legalForm: 'SASU',
  shareCapital: '1 000 €',
  street: '74 rue Pierre Valdo',
  postalCode: '69005',
  city: 'Lyon',
  country: 'France',
  siren: '123456789',
  siret: '12345678900012',
  rcsCity: 'Lyon',
  vatNumber: null,
  email: 'contact@lesterresdecaldera.fr',
  vatRegime: 'FRANCHISE',
  defaultVatRate: '20.00',
  footer: null,
};
const order: OrderForInvoice = {
  orderNumber: 'CAL-2026-ABC',
  email: 'client@example.com',
  createdAt: new Date('2026-10-01T08:00:00Z'),
  paidAt: new Date('2026-10-01T08:02:00Z'),
  subtotalAmount: '149.70',
  discountAmount: '14.97',
  shippingAmount: '5.90',
  shippingDiscountAmount: '0.00',
  totalAmount: '140.63',
  shippingMethodName: 'Colissimo',
  promotionCode: 'DIX',
  items: [
    {
      productName: 'Coffret 🔥 Braise',
      sku: 'ETB-1',
      language: 'FR',
      quantity: 2,
      unitPrice: '59.90',
      lineTotal: '119.80',
      discountAmount: '11.98',
    },
    {
      productName: 'Protège-cartes',
      sku: 'ACC-1',
      language: 'FR',
      quantity: 1,
      unitPrice: '29.90',
      lineTotal: '29.90',
      discountAmount: '2.99',
    },
  ],
  billing: {
    firstName: 'Camille',
    lastName: 'Martin',
    company: 'Atelier <Martin>',
    addressLine1: '12 rue des Terres',
    addressLine2: null,
    postalCode: '69003',
    city: 'Lyon',
    countryCode: 'FR',
  },
};
const cents = (value: string) => Math.round(Number(value) * 100);

test('factures : numérotation annuelle continue, année de Paris', () => {
  assert.equal(documentNumber('INVOICE', 2026, 42), 'F-2026-000042');
  assert.equal(documentNumber('CREDIT_NOTE', 2026, 1), 'AV-2026-000001');
  assert.throws(() => documentNumber('INVOICE', 2026, 0), RangeError);
  assert.throws(() => documentNumber('INVOICE', 2026, 1_000_000), RangeError);
  // 23 h 30 UTC le 31 décembre : déjà le 1er janvier à Paris.
  assert.equal(parisYear(new Date('2026-12-31T23:30:00Z')), 2027);
  assert.equal(parisYear(new Date('2026-12-31T22:30:00Z')), 2026);
});

test('factures : TVA extraite des prix TTC, au centime', () => {
  assert.equal(includedTax(12000, 20), 2000);
  assert.equal(includedTax(10782, 20), 1797);
  assert.equal(includedTax(1000, 5.5), 52);
  assert.equal(includedTax(0, 20), 0);
});

test('factures : franchise en base, sans TVA, mention 293 B', () => {
  const invoice = buildInvoice({
    number: 'F-2026-000001',
    issuedAt: new Date('2026-10-01T08:02:00Z'),
    seller,
    order,
  });
  assert.equal(invoice.vatMention, FRANCHISE_MENTION);
  assert.deepEqual(invoice.taxBreakdown, []);
  assert.equal(invoice.totals.tax, '0.00');
  assert.equal(invoice.totals.net, '140.63');
  assert.equal(invoice.totals.discount, '14.97');
  assert.equal(invoice.lines.length, 3);
  assert.equal(invoice.lines[0]!.total, '107.82');
  assert.equal(invoice.lines[2]!.description, 'Livraison — Colissimo');
  // Les lignes retombent exactement sur le total payé.
  assert.equal(
    invoice.lines.reduce((sum, line) => sum + cents(line.total), 0),
    cents(invoice.totals.total),
  );
  assert.deepEqual(invoice.buyer.lines, [
    'Atelier <Martin>',
    '12 rue des Terres',
    '69003 Lyon',
    'FR',
  ]);
  assert.match(invoice.payment, /1 octobre 2026/);
  assert.deepEqual(sellerLines(seller).slice(0, 1), [
    'SASU au capital de 1 000 €',
  ]);
  assert.ok(sellerLines(seller).includes('RCS Lyon 123456789'));
});

test('factures : régime assujetti, TVA par ligne et par taux', () => {
  const invoice = buildInvoice({
    number: 'F-2027-000001',
    issuedAt: new Date('2027-01-05T10:00:00Z'),
    seller: { ...seller, vatRegime: 'STANDARD', vatNumber: 'FR12123456789' },
    order,
  });
  assert.equal(invoice.vatMention, null);
  const tax = invoice.lines.reduce(
    (sum, line) => sum + cents(line.taxAmount),
    0,
  );
  assert.equal(cents(invoice.totals.tax), tax);
  assert.equal(
    cents(invoice.totals.net) + cents(invoice.totals.tax),
    cents(invoice.totals.total),
  );
  assert.equal(invoice.taxBreakdown.length, 1);
  assert.equal(invoice.taxBreakdown[0]!.rate, '20.00');
  // Un taux calculé par Stripe Tax l’emporte sur le taux par défaut.
  const stripe = buildInvoice({
    number: 'F-2027-000002',
    issuedAt: new Date('2027-01-05T10:00:00Z'),
    seller: { ...seller, vatRegime: 'STANDARD', vatNumber: 'FR12123456789' },
    order: {
      ...order,
      items: order.items.map((item) => ({
        ...item,
        tax: { rate: '5.50', cents: 100 },
      })),
    },
  });
  assert.equal(stripe.lines[0]!.taxRate, '5.50');
  assert.equal(stripe.lines[0]!.taxAmount, '1.00');
  assert.deepEqual(stripe.taxBreakdown.map((row) => row.rate).sort(), [
    '20.00',
    '5.50',
  ]);
});

test('avoirs : lignes remboursées, frais de port, geste commercial', () => {
  const invoice = buildInvoice({
    number: 'F-2026-000001',
    issuedAt: new Date('2026-10-01T08:02:00Z'),
    seller,
    order,
  });
  const credit = buildCreditNote({
    number: 'AV-2026-000001',
    issuedAt: new Date('2026-10-10T08:00:00Z'),
    seller,
    invoice,
    refund: {
      amount: '64.81',
      shippingAmount: '5.90',
      succeededAt: new Date('2026-10-10T08:00:00Z'),
      items: [
        { productName: 'Coffret 🔥 Braise', quantity: 1, amount: '53.91' },
      ],
    },
  });
  assert.equal(credit.kind, 'CREDIT_NOTE');
  assert.equal(credit.reference, 'Avoir sur la facture F-2026-000001');
  assert.deepEqual(
    credit.lines.map((line) => [line.description, line.total]),
    [
      ['Coffret 🔥 Braise', '53.91'],
      ['Frais de livraison', '5.90'],
      ['Geste commercial', '5.00'],
    ],
  );
  assert.equal(credit.totals.total, '64.81');
  assert.equal(credit.buyer, invoice.buyer);
});

test('factures : mentions manquantes et PDF lisible', async () => {
  assert.deepEqual(
    missingMentions({
      ...seller,
      siren: null,
      rcsCity: null,
      shareCapital: null,
    }),
    ['SIREN', 'ville du RCS', 'capital social'],
  );
  assert.deepEqual(missingMentions({ ...seller, vatRegime: 'STANDARD' }), [
    'numéro de TVA intracommunautaire',
  ]);
  const invoice = buildInvoice({
    number: 'F-2026-000001',
    issuedAt: new Date('2026-10-01T08:02:00Z'),
    seller,
    order: {
      ...order,
      items: Array.from({ length: 40 }, (_, index) => ({
        ...order.items[0]!,
        productName: `Article ${index} — nom assez long pour passer à la ligne dans le tableau`,
      })),
    },
  });
  const pdf = await renderInvoicePdf(invoice);
  const head = Buffer.from(pdf.slice(0, 8)).toString('latin1');
  assert.match(head, /^%PDF-1\./);
  // 40 lignes : plusieurs pages, sans erreur d’encodage (émoji, espace fine).
  assert.ok((await PDFDocument.load(pdf)).getPageCount() > 1);
  assert.equal(
    parseInvoiceSnapshot(JSON.parse(JSON.stringify(invoice))).number,
    invoice.number,
  );
  for (const junk of [
    null,
    {},
    { ...invoice, version: 2 },
    { ...invoice, lines: 'x' },
  ])
    assert.throws(() => parseInvoiceSnapshot(junk));
});
