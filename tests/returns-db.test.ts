import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { getPrisma } from '../src/lib/db/prisma';
import { cartTokenHash } from '../src/lib/cart/identity';
import { parseEmailSnapshot } from '../src/emails/templates';
import type { ProviderRefund, RefundGateway } from '../src/lib/refunds/gateway';
import { RefundProviderError } from '../src/lib/refunds/gateway';
import {
  approveReturn,
  cancelReturn,
  createAdminReturn,
  receiveReturn,
  refundReturn,
  rejectReturn,
  requestReturn,
  requestWithdrawal,
  returnableLines,
} from '../src/lib/returns/service';
if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1'].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  )
)
  throw new Error('Tests réservés à PostgreSQL local.');
const db = getPrisma();

function stripe() {
  const state = { refuse: false };
  const gateway: RefundGateway = {
    async create(input): Promise<ProviderRefund> {
      if (state.refuse) throw new RefundProviderError('charge_disputed', true);
      return {
        id: `re_return_${randomUUID().replaceAll('-', '')}`,
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
  return { gateway, state };
}

test('retours et rétractations, PostgreSQL', async (t) => {
  const key = randomUUID();
  const orderNumber = `CAL-2026-${randomBytes(10).toString('hex').toUpperCase()}`;
  const admin = await db.adminUser.create({
    data: { name: 'Admin retours', email: `returns-${key}@example.com` },
  });
  const category = await db.category.create({
    data: { name: 'Catégorie retours', slug: `returns-${key}` },
  });
  const product = await db.product.create({
    data: {
      name: `Produit retours ${key}`,
      slug: `returns-${key}`,
      categoryId: category.id,
      productType: 'ETB',
      status: 'ACTIVE',
      variants: {
        create: [
          {
            sku: `RET-A-${key}`,
            price: '29.95',
            stockQuantity: 4,
            isDefault: true,
          },
          { sku: `RET-B-${key}`, price: '19.90', stockQuantity: 4 },
        ],
      },
    },
    include: { variants: { orderBy: { price: 'desc' } } },
  });
  const [variantA, variantB] = product.variants as [
    (typeof product.variants)[0],
    (typeof product.variants)[0],
  ];
  const cart = await db.cart.create({
    data: {
      tokenHash: cartTokenHash(randomUUID().replaceAll('-', '').repeat(2))!,
      expiresAt: new Date(Date.now() + 86400000),
    },
  });
  const checkout = await db.checkoutSession.create({
    data: { cartId: cart.id, expiresAt: new Date(Date.now() + 86400000) },
  });
  const line = (variant: typeof variantA, quantity: number) => ({
    productId: product.id,
    variantId: variant.id,
    productName: `Article ${variant.sku}`,
    productSlug: product.slug,
    sku: variant.sku,
    language: 'FR' as const,
    unitPrice: variant.price,
    quantity,
    lineTotal: variant.price.mul(quantity),
    imageUrl: '/assets/products/placeholder-sealed.png',
  });
  const order = await db.order.create({
    data: {
      checkoutSessionId: checkout.id,
      publicId: randomUUID().replaceAll('-', '').repeat(2),
      orderNumber,
      status: 'PAID',
      email: `Client-${key}@Example.com`,
      currency: 'EUR',
      subtotalAmount: '79.80',
      shippingAmount: '6.90',
      totalAmount: '86.70',
      shippingMethodCode: 'TEST',
      shippingMethodName: 'Livraison test',
      paidAt: new Date(Date.now() - 5 * 86400000),
      deliveredAt: new Date(Date.now() - 3 * 86400000),
      fulfillmentStatus: 'DELIVERED',
      items: { create: [line(variantA, 2), line(variantB, 1)] },
      payment: {
        create: {
          status: 'SUCCEEDED',
          amount: '86.70',
          currency: 'EUR',
          providerPaymentIntentId: `pi_returns_${key.replaceAll('-', '')}`,
          paidAt: new Date(),
        },
      },
      addresses: {
        create: {
          role: 'SHIPPING',
          firstName: 'Test',
          lastName: 'Retour',
          addressLine1: '1 rue du Test',
          postalCode: '75001',
          city: 'Paris',
          countryCode: 'FR',
        },
      },
      reservations: {
        create: [
          { variantId: variantA.id, quantity: 2 },
          { variantId: variantB.id, quantity: 1 },
        ].map((row) => ({
          ...row,
          status: 'CONSUMED' as const,
          expiresAt: new Date(),
        })),
      },
    },
    include: { items: true },
  });
  const itemA = order.items.find((item) => item.variantId === variantA.id)!;
  const itemB = order.items.find((item) => item.variantId === variantB.id)!;
  const { gateway, state } = stripe();
  const emails = (type: string) =>
    db.emailDelivery.findMany({
      where: { orderId: order.id, type: type as never },
      orderBy: { createdAt: 'asc' },
    });
  const left = async () =>
    Object.fromEntries(
      (await returnableLines(db, order.id)).lines.map((row) => [
        row.id === itemA.id ? 'A' : 'B',
        row.left,
      ]),
    );
  let firstId = '';

  try {
    await t.test(
      'rétractation en ligne : accusé de réception immédiat',
      async () => {
        const request = await requestReturn({
          orderId: order.id,
          reason: 'WITHDRAWAL',
          items: [{ orderItemId: itemA.id, quantity: 1 }],
          message: 'Finalement non',
        });
        firstId = request.id;
        assert.match(request.number, /^RET-\d{4}-[0-9A-F]{8}$/);
        assert.equal(request.source, 'CUSTOMER');
        assert.equal(request.status, 'REQUESTED');
        const [ack] = await emails('RETURN_REQUESTED');
        assert.equal(
          ack!.dedupeKey,
          `${order.id}:RETURN_REQUESTED:${request.id}`,
        );
        assert.equal(ack!.recipient, order.email);
        const snapshot = parseEmailSnapshot(ack!.snapshot);
        assert.equal(snapshot.returnRequest?.withdrawal, true);
        assert.deepEqual(snapshot.returnRequest?.items, [
          { name: itemA.productName, quantity: 1 },
        ]);
        assert.deepEqual(await left(), { A: 1, B: 1 });
        await assert.rejects(
          requestReturn({
            orderId: order.id,
            reason: 'WITHDRAWAL',
            items: [{ orderItemId: itemA.id, quantity: 2 }],
            message: '',
          }),
          /1 au plus/,
        );
        await assert.rejects(
          requestReturn({
            orderId: order.id,
            reason: 'WITHDRAWAL',
            items: [],
            message: '',
          }),
          /au moins un article/,
        );
      },
    );

    await t.test(
      'délai dépassé : rétractation refusée, garantie ouverte',
      async () => {
        await db.order.update({
          where: { id: order.id },
          data: { deliveredAt: new Date(Date.now() - 20 * 86400000) },
        });
        await assert.rejects(
          requestReturn({
            orderId: order.id,
            reason: 'WITHDRAWAL',
            items: [{ orderItemId: itemB.id, quantity: 1 }],
            message: '',
          }),
          /délai de rétractation a pris fin/,
        );
        await assert.rejects(
          requestWithdrawal(orderNumber, order.email, ''),
          /délai de rétractation/,
        );
        // La boutique peut enregistrer une demande acceptée hors délai.
        const admin_ = await createAdminReturn(
          admin.id,
          {
            orderId: order.id,
            reason: 'WITHDRAWAL',
            items: [{ orderItemId: itemB.id, quantity: 1 }],
            message: 'Accord par téléphone',
          },
          false,
        );
        assert.equal(admin_.source, 'ADMIN');
        assert.equal((await emails('RETURN_REQUESTED')).length, 1);
        await cancelReturn(admin.id, admin_.id);
        await db.order.update({
          where: { id: order.id },
          data: { deliveredAt: new Date(Date.now() - 3 * 86400000) },
        });
      },
    );

    await t.test('formulaire public : toute la commande restante', async () => {
      await assert.rejects(
        requestWithdrawal(orderNumber, 'autre@example.com', ''),
        /Aucune commande payée/,
      );
      const whole = await requestWithdrawal(
        orderNumber,
        order.email.toUpperCase(),
        '',
      );
      const items = await db.returnItem.findMany({
        where: { returnId: whole.id },
      });
      assert.deepEqual(
        items.map((item) => [item.orderItemId, item.quantity]).sort(),
        [
          [itemA.id, 1],
          [itemB.id, 1],
        ].sort(),
      );
      assert.deepEqual(await left(), { A: 0, B: 0 });
      await assert.rejects(
        requestWithdrawal(orderNumber, order.email, ''),
        /déjà retournés ou remboursés/,
      );
      await cancelReturn(admin.id, whole.id);
      assert.deepEqual(await left(), { A: 1, B: 1 });
    });

    await t.test(
      'traitement admin : accepter, refus motivé, transitions',
      async () => {
        await assert.rejects(rejectReturn(admin.id, firstId, ''), /Expliquez/);
        const approved = await approveReturn(
          admin.id,
          firstId,
          'Merci de joindre la facture.',
        );
        assert.equal(approved.status, 'APPROVED');
        assert.ok(approved.approvedAt);
        const [mail] = await emails('RETURN_APPROVED');
        assert.equal(
          parseEmailSnapshot(mail!.snapshot).returnRequest?.resolution,
          'Merci de joindre la facture.',
        );
        await assert.rejects(
          approveReturn(admin.id, firstId, ''),
          /changé d’état/,
        );
        await assert.rejects(
          rejectReturn(admin.id, firstId, 'Non'),
          /changé d’état/,
        );
        const outsider = await db.adminUser.create({
          data: {
            name: 'Inactif',
            email: `returns-off-${key}@example.com`,
            isActive: false,
          },
        });
        try {
          await assert.rejects(
            receiveReturn(outsider.id, firstId),
            /Session administrateur/,
          );
        } finally {
          await db.adminUser.delete({ where: { id: outsider.id } });
        }
        assert.equal(
          (await receiveReturn(admin.id, firstId)).status,
          'RECEIVED',
        );
      },
    );

    await t.test(
      'remboursement : refus Stripe, nouvelle tentative, clôture',
      async () => {
        state.refuse = true;
        const refused = await refundReturn(
          admin.id,
          {
            returnId: firstId,
            idempotencyKey: randomUUID(),
            includeShipping: false,
            amountCents: null,
            restock: true,
            note: '',
          },
          gateway,
        );
        assert.equal(refused.status, 'FAILED');
        let request = await db.returnRequest.findUniqueOrThrow({
          where: { id: firstId },
        });
        assert.equal(request.status, 'RECEIVED');
        assert.equal(request.refundId, refused.id);

        state.refuse = false;
        const stockBefore = (
          await db.productVariant.findUniqueOrThrow({
            where: { id: variantA.id },
          })
        ).stockQuantity;
        const outcome = await refundReturn(
          admin.id,
          {
            returnId: firstId,
            idempotencyKey: randomUUID(),
            includeShipping: false,
            amountCents: null,
            restock: true,
            note: '',
          },
          gateway,
        );
        assert.equal(outcome.status, 'SUCCEEDED');
        assert.equal(outcome.amount, '29.95');
        request = await db.returnRequest.findUniqueOrThrow({
          where: { id: firstId },
        });
        assert.equal(request.status, 'REFUNDED');
        assert.equal(request.refundId, outcome.id);
        assert.ok(request.refundedAt && request.closedAt);
        const refund = await db.refund.findUniqueOrThrow({
          where: { id: outcome.id },
        });
        assert.equal(refund.reason, 'RETURN_RECEIVED');
        assert.match(refund.note ?? '', new RegExp(request.number));
        assert.equal(
          (
            await db.productVariant.findUniqueOrThrow({
              where: { id: variantA.id },
            })
          ).stockQuantity,
          stockBefore + 1,
        );
        assert.equal((await emails('ORDER_REFUNDED')).length, 1);
        await assert.rejects(
          refundReturn(
            admin.id,
            {
              returnId: firstId,
              idempotencyKey: randomUUID(),
              includeShipping: false,
              amountCents: null,
              restock: false,
              note: '',
            },
            gateway,
          ),
          /déjà clos/,
        );
        // L’unité remboursée ne peut plus être retournée ; les autres oui.
        assert.deepEqual(await left(), { A: 1, B: 1 });
      },
    );
  } finally {
    await db.returnRequest.deleteMany({ where: { orderId: order.id } });
    await db.refund.deleteMany({ where: { orderId: order.id } });
    await db.emailDelivery.deleteMany({ where: { orderId: order.id } });
    await db.stockReservation.deleteMany({ where: { orderId: order.id } });
    await db.inventoryAdjustment.deleteMany({
      where: { variantId: { in: [variantA.id, variantB.id] } },
    });
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
