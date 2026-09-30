import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { getPrisma } from '../src/lib/db/prisma';
import { purgeTestInvoices } from './helpers/invoices';
import { cartTokenHash } from '../src/lib/cart/identity';
import { transaction } from '../src/lib/orders/common';
import {
  issueMissingInvoice,
  saveInvoiceSettings,
} from '../src/lib/invoices/admin';
import { parseInvoiceSnapshot } from '../src/lib/invoices/document';
import { invoicePdfResponse } from '../src/lib/invoices/response';
import { issueInvoice, SETTINGS_ID } from '../src/lib/invoices/service';
import type { RefundGateway } from '../src/lib/refunds/gateway';
import { requestRefund } from '../src/lib/refunds/service';
if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1'].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  )
)
  throw new Error('Tests réservés à PostgreSQL local.');
const db = getPrisma();

const gateway: RefundGateway = {
  async create(input) {
    return {
      id: `re_invoice_${randomUUID().replaceAll('-', '')}`,
      amount: input.amount,
      currency: 'eur',
      status: 'succeeded',
      paymentIntentId: input.paymentIntent,
      metadata: input.metadata,
      failureReason: null,
    };
  },
  async retrieve() {
    throw new Error('unused');
  },
};

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(values)) data.set(name, value);
  return data;
}

const sequence = (number: string) => Number(number.split('-').at(-1));

test('factures et avoirs, PostgreSQL', async (t) => {
  const key = randomUUID();
  const admin = await db.adminUser.create({
    data: { name: 'Admin factures', email: `invoices-${key}@example.com` },
  });
  const previousSettings = await db.invoiceSettings.findUnique({
    where: { id: SETTINGS_ID },
  });
  const category = await db.category.create({
    data: { name: 'Catégorie factures', slug: `invoices-${key}` },
  });
  const product = await db.product.create({
    data: {
      name: `Produit factures ${key}`,
      slug: `invoices-${key}`,
      categoryId: category.id,
      productType: 'ETB',
      status: 'ACTIVE',
      variants: {
        create: { sku: `INV-${key}`, price: '59.90', stockQuantity: 20 },
      },
    },
    include: { variants: true },
  });
  const variant = product.variants[0]!;
  const carts: string[] = [];
  async function paidOrder(status: 'PAID' | 'PAYMENT_REVIEW' = 'PAID') {
    const cart = await db.cart.create({
      data: {
        tokenHash: cartTokenHash(randomUUID().replaceAll('-', '').repeat(2))!,
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    carts.push(cart.id);
    const checkout = await db.checkoutSession.create({
      data: { cartId: cart.id, expiresAt: new Date(Date.now() + 86400000) },
    });
    return db.order.create({
      data: {
        checkoutSessionId: checkout.id,
        publicId: randomUUID().replaceAll('-', '').repeat(2),
        orderNumber: `INVOICE-${randomUUID()}`,
        status,
        email: `client-${key}@example.com`,
        currency: 'EUR',
        subtotalAmount: '59.90',
        shippingAmount: '4.90',
        totalAmount: '64.80',
        shippingMethodCode: 'TEST',
        shippingMethodName: 'Livraison test',
        paidAt: new Date(),
        items: {
          create: {
            productId: product.id,
            variantId: variant.id,
            productName: 'Coffret facturé',
            productSlug: product.slug,
            sku: variant.sku,
            language: 'FR',
            unitPrice: '59.90',
            quantity: 1,
            lineTotal: '59.90',
            imageUrl: '/assets/products/placeholder-sealed.png',
          },
        },
        payment: {
          create: {
            status: 'SUCCEEDED',
            amount: '64.80',
            currency: 'EUR',
            providerPaymentIntentId: `pi_invoice_${randomUUID().replaceAll('-', '')}`,
            paidAt: new Date(),
          },
        },
        addresses: {
          create: {
            role: 'BILLING',
            firstName: 'Camille',
            lastName: 'Facture',
            addressLine1: '1 rue du Test',
            postalCode: '75001',
            city: 'Paris',
            countryCode: 'FR',
          },
        },
      },
    });
  }
  const orders: string[] = [];

  try {
    await t.test('une facture par commande payée, numéro continu', async () => {
      const order = await paidOrder();
      orders.push(order.id);
      const invoice = await transaction((tx) => issueInvoice(tx, order.id));
      assert.match(invoice.number, /^F-\d{4}-\d{6}$/);
      const again = await transaction((tx) => issueInvoice(tx, order.id));
      assert.equal(again.id, invoice.id);
      const snapshot = parseInvoiceSnapshot(invoice.snapshot);
      assert.equal(snapshot.totals.total, '64.80');
      assert.equal(snapshot.buyer.name, 'Camille Facture');
      assert.match(snapshot.vatMention ?? '', /293 B/);
      assert.equal(invoice.taxAmount.toFixed(2), '0.00');

      // Une émission annulée rend son numéro : pas de trou.
      const rolledBack = await paidOrder();
      orders.push(rolledBack.id);
      let lost = '';
      await assert.rejects(
        transaction(async (tx) => {
          lost = (await issueInvoice(tx, rolledBack.id)).number;
          throw new Error('rollback');
        }),
        /rollback/,
      );
      const kept = await transaction((tx) => issueInvoice(tx, rolledBack.id));
      assert.equal(kept.number, lost);
      assert.equal(sequence(kept.number), sequence(invoice.number) + 1);
    });

    await t.test('émissions simultanées : ni doublon ni trou', async () => {
      const batch = await Promise.all(
        Array.from({ length: 5 }, () => paidOrder()),
      );
      orders.push(...batch.map((order) => order.id));
      const issued = await Promise.all(
        batch.map((order) => transaction((tx) => issueInvoice(tx, order.id))),
      );
      const numbers = issued
        .map((row) => sequence(row.number))
        .sort((a, b) => a - b);
      assert.equal(new Set(numbers).size, 5);
      assert.equal(numbers.at(-1)! - numbers[0]!, 4);
    });

    await t.test('document figé : ni modification ni suppression', async () => {
      const invoice = await db.invoice.findFirstOrThrow({
        where: { orderId: orders[0]! },
      });
      await assert.rejects(
        db.invoice.update({
          where: { id: invoice.id },
          data: { totalAmount: '1.00' },
        }),
        /ni modifié ni supprimé/,
      );
      await assert.rejects(
        db.invoice.delete({ where: { id: invoice.id } }),
        /ni modifié ni supprimé/,
      );
    });

    await t.test(
      'avoir émis quand Stripe confirme un remboursement',
      async () => {
        // Commande payée avant les factures : la facture est émise d’abord.
        const order = await paidOrder();
        orders.push(order.id);
        const refund = await requestRefund(
          admin.id,
          {
            orderId: order.id,
            idempotencyKey: randomUUID(),
            lines: [],
            includeShipping: true,
            amountCents: null,
            reason: 'CUSTOMER_REQUEST',
            note: '',
            restock: false,
          },
          gateway,
        );
        assert.equal(refund.status, 'SUCCEEDED');
        const documents = await db.invoice.findMany({
          where: { orderId: order.id },
          orderBy: { issuedAt: 'asc' },
        });
        assert.deepEqual(
          documents.map((row) => row.kind),
          ['INVOICE', 'CREDIT_NOTE'],
        );
        const credit = documents[1]!;
        assert.match(credit.number, /^AV-\d{4}-\d{6}$/);
        assert.equal(credit.refundId, refund.id);
        assert.equal(credit.invoiceId, documents[0]!.id);
        assert.equal(credit.totalAmount.toFixed(2), '4.90');
        const snapshot = parseInvoiceSnapshot(credit.snapshot);
        assert.equal(
          snapshot.reference,
          `Avoir sur la facture ${documents[0]!.number}`,
        );
        assert.deepEqual(
          snapshot.lines.map((line) => [line.description, line.total]),
          [['Frais de livraison', '4.90']],
        );
        const response = await invoicePdfResponse(credit);
        assert.equal(response.headers.get('content-type'), 'application/pdf');
        assert.match(response.headers.get('cache-control') ?? '', /no-store/);
        assert.match(
          Buffer.from(await response.arrayBuffer())
            .subarray(0, 5)
            .toString(),
          /^%PDF-/,
        );
      },
    );

    await t.test(
      'mentions légales : contrôles et effet sur les suivantes',
      async () => {
        const base = {
          legalName: 'CALDERA',
          tradeName: 'Les Terres de Caldera',
          legalForm: 'SASU',
          shareCapital: '1 000 €',
          street: '74 rue Pierre Valdo',
          postalCode: '69005',
          city: 'Lyon',
          country: 'France',
          siren: '123 456 789',
          siret: '12345678900012',
          rcsCity: 'Lyon',
          vatNumber: '',
          email: 'contact@lesterresdecaldera.fr',
          vatRegime: 'FRANCHISE',
          defaultVatRate: '20',
          footer: '',
        };
        await assert.rejects(
          saveInvoiceSettings(admin.id, form({ ...base, siren: '12345' })),
          /SIREN : 9 chiffres/,
        );
        await assert.rejects(
          saveInvoiceSettings(
            admin.id,
            form({ ...base, siret: '98765432100012' }),
          ),
          /commence par le SIREN/,
        );
        await assert.rejects(
          saveInvoiceSettings(
            admin.id,
            form({ ...base, vatRegime: 'STANDARD' }),
          ),
          /numéro de TVA/,
        );
        const saved = await saveInvoiceSettings(
          admin.id,
          form({
            ...base,
            vatRegime: 'STANDARD',
            vatNumber: 'fr 12 123456789',
          }),
        );
        assert.equal(saved.siren, '123456789');
        assert.equal(saved.vatNumber, 'FR12123456789');
        const order = await paidOrder();
        orders.push(order.id);
        const invoice = await issueMissingInvoice(
          admin.id,
          form({ id: order.id }),
        );
        // 64,80 € TTC à 20 % : 10,80 € de TVA.
        assert.equal(invoice.taxAmount.toFixed(2), '10.80');
        const first = await db.invoice.findFirstOrThrow({
          where: { orderId: orders[0]! },
        });
        assert.equal(first.taxAmount.toFixed(2), '0.00');
        const review = await paidOrder('PAYMENT_REVIEW');
        orders.push(review.id);
        await assert.rejects(
          issueMissingInvoice(admin.id, form({ id: review.id })),
          /Seule une commande payée/,
        );
      },
    );
  } finally {
    await purgeTestInvoices(db, orders);
    if (previousSettings)
      await db.invoiceSettings.update({
        where: { id: SETTINGS_ID },
        data: previousSettings,
      });
    else await db.invoiceSettings.deleteMany({ where: { id: SETTINGS_ID } });
    await db.refund.deleteMany({ where: { orderId: { in: orders } } });
    await db.emailDelivery.deleteMany({ where: { orderId: { in: orders } } });
    await db.orderItem.deleteMany({ where: { orderId: { in: orders } } });
    await db.orderAddress.deleteMany({ where: { orderId: { in: orders } } });
    await db.payment.deleteMany({ where: { orderId: { in: orders } } });
    await db.order.deleteMany({ where: { id: { in: orders } } });
    await db.cart.deleteMany({ where: { id: { in: carts } } });
    await db.adminAuditLog.deleteMany({ where: { adminUserId: admin.id } });
    await db.productVariant.deleteMany({ where: { productId: product.id } });
    await db.product.delete({ where: { id: product.id } });
    await db.category.delete({ where: { id: category.id } });
    await db.adminUser.delete({ where: { id: admin.id } });
    await db.$disconnect();
  }
});
