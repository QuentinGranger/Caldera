import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { getPrisma } from '../src/lib/db/prisma';
import { purgeTestInvoices } from './helpers/invoices';
import { cartTokenHash } from '../src/lib/cart/identity';
import { transaction } from '../src/lib/orders/common';
import { parseInvoiceSnapshot } from '../src/lib/invoices/document';
import { issueInvoice, SETTINGS_ID } from '../src/lib/invoices/service';
import type { RefundGateway } from '../src/lib/refunds/gateway';
import { requestRefund } from '../src/lib/refunds/service';
import { saveTaxSettings, turnover } from '../src/lib/tax/admin';
import {
  TaxProviderError,
  type TaxCalculation,
  type TaxGateway,
} from '../src/lib/tax/gateway';
import {
  currentTaxMode,
  ensureTaxCalculation,
  syncTax,
  taxWorkPending,
  tryTaxCalculation,
} from '../src/lib/tax/service';
if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1'].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  )
)
  throw new Error('Tests réservés à PostgreSQL local.');
const db = getPrisma();

/** Stripe Tax stand-in: French VAT at 20 %, extracted from VAT-inclusive amounts. */
function fakeTax() {
  const calls = {
    calculate: 0,
    record: [] as string[],
    reverse: [] as [string, number][],
  };
  const state = { down: false };
  const vat = (cents: number) => cents - Math.round((cents * 100) / 120);
  const gateway: TaxGateway = {
    async calculate({ lines, shipping }): Promise<TaxCalculation> {
      calls.calculate++;
      if (state.down) throw new TaxProviderError('STRIPE_INJOIGNABLE');
      const taxed = lines.map((line) => ({
        reference: line.reference,
        taxCents: vat(line.amountCents),
        rate: '20.00',
      }));
      const shippingTax = vat(shipping.amountCents);
      return {
        id: `taxcalc_${randomUUID().replaceAll('-', '')}`,
        lines: taxed,
        shipping: { taxCents: shippingTax, rate: '20.00' },
        taxCents:
          taxed.reduce((sum, line) => sum + line.taxCents, 0) + shippingTax,
      };
    },
    async record(_calculation, _reference, key) {
      calls.record.push(key);
      return `tax_txn_${key.replaceAll(':', '_')}`;
    },
    async reverse(_transaction, _reference, amount, key) {
      calls.reverse.push([key, amount]);
      return `tax_rev_${key.replaceAll(':', '_')}`;
    },
    async status() {
      return { status: 'active', missing: [] };
    },
  };
  return { gateway, calls, state };
}

const refunds: RefundGateway = {
  async create(input) {
    return {
      id: `re_tax_${randomUUID().replaceAll('-', '')}`,
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

test('TVA et Stripe Tax, PostgreSQL', async (t) => {
  const key = randomUUID();
  const admin = await db.adminUser.create({
    data: { name: 'Admin fiscalité', email: `tax-${key}@example.com` },
  });
  const previousSettings = await db.invoiceSettings.findUnique({
    where: { id: SETTINGS_ID },
  });
  await db.invoiceSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID },
    update: { vatRegime: 'FRANCHISE', stripeTaxEnabled: false },
  });
  const category = await db.category.create({
    data: { name: 'Catégorie TVA', slug: `tax-${key}` },
  });
  const product = await db.product.create({
    data: {
      name: `Produit TVA ${key}`,
      slug: `tax-${key}`,
      categoryId: category.id,
      productType: 'ETB',
      status: 'ACTIVE',
      variants: {
        create: { sku: `TAX-${key}`, price: '60.00', stockQuantity: 10 },
      },
    },
    include: { variants: true },
  });
  const variant = product.variants[0]!;
  const year = new Date().getFullYear();
  const before = await turnover(year);
  const cart = await db.cart.create({
    data: {
      tokenHash: cartTokenHash(randomUUID().replaceAll('-', '').repeat(2))!,
      expiresAt: new Date(Date.now() + 86400000),
    },
  });
  const checkout = await db.checkoutSession.create({
    data: { cartId: cart.id, expiresAt: new Date(Date.now() + 86400000) },
  });
  const order = await db.order.create({
    data: {
      checkoutSessionId: checkout.id,
      publicId: randomUUID().replaceAll('-', '').repeat(2),
      orderNumber: `TAX-${key}`,
      status: 'PAID',
      taxMode: 'STRIPE_TAX',
      email: `client-${key}@example.com`,
      currency: 'EUR',
      subtotalAmount: '120.00',
      shippingAmount: '6.00',
      totalAmount: '126.00',
      shippingMethodCode: 'TEST',
      shippingMethodName: 'Livraison test',
      paidAt: new Date(),
      items: {
        create: {
          productId: product.id,
          variantId: variant.id,
          productName: 'Coffret taxé',
          productSlug: product.slug,
          sku: variant.sku,
          language: 'FR',
          unitPrice: '60.00',
          quantity: 2,
          lineTotal: '120.00',
          imageUrl: '/assets/products/placeholder-sealed.png',
        },
      },
      payment: {
        create: {
          status: 'SUCCEEDED',
          amount: '126.00',
          currency: 'EUR',
          providerPaymentIntentId: `pi_tax_${key.replaceAll('-', '')}`,
          paidAt: new Date(),
        },
      },
      addresses: {
        create: ['SHIPPING', 'BILLING'].map((role) => ({
          role: role as 'SHIPPING' | 'BILLING',
          firstName: 'Camille',
          lastName: 'Taxe',
          addressLine1: '1 rue du Test',
          postalCode: '75001',
          city: 'Paris',
          countryCode: 'FR',
        })),
      },
    },
    include: { items: true },
  });
  const { gateway, calls, state } = fakeTax();

  try {
    await t.test(
      'Stripe Tax interdit en franchise, réglages contrôlés',
      async () => {
        const base = {
          productTaxCode: 'txcd_99999999',
          shippingTaxCode: 'txcd_92010001',
          franchiseThreshold: '85 000',
          franchiseMajoredThreshold: '93500',
        };
        await assert.rejects(
          saveTaxSettings(admin.id, form({ ...base, stripeTaxEnabled: 'on' })),
          /régime assujetti/,
        );
        await assert.rejects(
          saveTaxSettings(admin.id, form({ ...base, productTaxCode: 'tva20' })),
          /Code fiscal/,
        );
        await assert.rejects(
          saveTaxSettings(
            admin.id,
            form({ ...base, franchiseMajoredThreshold: '80000' }),
          ),
          /seuil majoré/,
        );
        const saved = await saveTaxSettings(admin.id, form(base));
        assert.equal(saved.franchiseThreshold.toFixed(2), '85000.00');
        assert.equal(await currentTaxMode(db), 'NONE');
        await db.invoiceSettings.update({
          where: { id: SETTINGS_ID },
          data: { vatRegime: 'STANDARD', vatNumber: 'FR12123456789' },
        });
        assert.equal(await currentTaxMode(db), 'LOCAL');
        await saveTaxSettings(
          admin.id,
          form({ ...base, stripeTaxEnabled: 'on' }),
        );
        assert.equal(await currentTaxMode(db), 'STRIPE_TAX');
      },
    );

    await t.test(
      'calcul avant paiement : TVA incluse, une seule fois',
      async () => {
        state.down = true;
        await tryTaxCalculation(order.id, gateway);
        assert.equal(
          (await db.order.findUniqueOrThrow({ where: { id: order.id } }))
            .taxCalculationId,
          null,
        );
        state.down = false;
        const calculated = await ensureTaxCalculation(order.id, gateway);
        assert.ok(calculated.taxCalculationId);
        // 120 € TTC → 20 € de TVA ; 6 € de port → 1 €.
        assert.equal(calculated.taxAmount.toFixed(2), '21.00');
        assert.equal(calculated.shippingTaxAmount.toFixed(2), '1.00');
        const item = await db.orderItem.findUniqueOrThrow({
          where: { id: order.items[0]!.id },
        });
        assert.equal(item.taxAmount.toFixed(2), '20.00');
        assert.equal(item.taxRate?.toFixed(2), '20.00');
        await ensureTaxCalculation(order.id, gateway);
        assert.equal(calls.calculate, 2);
      },
    );

    await t.test('facture : la TVA de Stripe, ligne par ligne', async () => {
      const invoice = await transaction((tx) => issueInvoice(tx, order.id));
      const snapshot = parseInvoiceSnapshot(invoice.snapshot);
      assert.equal(snapshot.vatMention, null);
      assert.deepEqual(
        snapshot.lines.map((line) => [
          line.total,
          line.taxRate,
          line.taxAmount,
        ]),
        [
          ['120.00', '20.00', '20.00'],
          ['6.00', '20.00', '1.00'],
        ],
      );
      assert.equal(invoice.taxAmount.toFixed(2), '21.00');
      assert.equal(snapshot.totals.net, '105.00');
    });

    await t.test('vente déclarée, remboursement annulé côté TVA', async () => {
      assert.equal(await taxWorkPending(), true);
      assert.deepEqual(await syncTax({ gateway }), { synced: 1, failed: 0 });
      assert.deepEqual(calls.record, [`caldera-tax:${order.id}`]);
      const recorded = await db.order.findUniqueOrThrow({
        where: { id: order.id },
      });
      assert.ok(recorded.taxTransactionId);
      const refund = await requestRefund(
        admin.id,
        {
          orderId: order.id,
          idempotencyKey: randomUUID(),
          lines: [{ orderItemId: order.items[0]!.id, quantity: 1 }],
          includeShipping: false,
          amountCents: null,
          reason: 'CUSTOMER_REQUEST',
          note: '',
          restock: false,
        },
        refunds,
      );
      assert.equal(refund.status, 'SUCCEEDED');
      assert.deepEqual(await syncTax({ gateway }), { synced: 1, failed: 0 });
      assert.deepEqual(calls.reverse, [
        [`caldera-tax-reversal:${refund.id}`, 6000],
      ]);
      assert.ok(
        (await db.refund.findUniqueOrThrow({ where: { id: refund.id } }))
          .taxReversalId,
      );
      // Rien d’autre à faire : aucun nouvel appel.
      assert.deepEqual(await syncTax({ gateway }), { synced: 0, failed: 0 });
      assert.equal(await taxWorkPending(), false);
    });

    await t.test(
      'chiffre d’affaires : ventes payées moins remboursements',
      async () => {
        const after = await turnover(year);
        // 126 € encaissés, 60 € remboursés.
        assert.equal(after.totalCents - before.totalCents, 6600);
        const month = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Europe/Paris',
          year: 'numeric',
          month: '2-digit',
        }).format(new Date());
        const row = after.months.find((entry) => entry.month === month)!;
        const was = before.months.find((entry) => entry.month === month)!;
        assert.equal(row.orders - was.orders, 1);
        assert.equal(row.refundCents - was.refundCents, 6000);
      },
    );
  } finally {
    await purgeTestInvoices(db, [order.id]);
    if (previousSettings)
      await db.invoiceSettings.update({
        where: { id: SETTINGS_ID },
        data: previousSettings,
      });
    else await db.invoiceSettings.deleteMany({ where: { id: SETTINGS_ID } });
    await db.refund.deleteMany({ where: { orderId: order.id } });
    await db.emailDelivery.deleteMany({ where: { orderId: order.id } });
    await db.orderItem.deleteMany({ where: { orderId: order.id } });
    await db.orderAddress.deleteMany({ where: { orderId: order.id } });
    await db.payment.deleteMany({ where: { orderId: order.id } });
    await db.order.delete({ where: { id: order.id } });
    await db.checkoutSession.delete({ where: { id: checkout.id } });
    await db.cart.delete({ where: { id: cart.id } });
    await db.adminAuditLog.deleteMany({ where: { adminUserId: admin.id } });
    await db.productVariant.deleteMany({ where: { productId: product.id } });
    await db.product.delete({ where: { id: product.id } });
    await db.category.delete({ where: { id: category.id } });
    await db.adminUser.delete({ where: { id: admin.id } });
    await db.$disconnect();
  }
});
