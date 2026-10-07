import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { getPrisma } from '../src/lib/db/prisma';
import { purgeTestInvoices } from './helpers/invoices';
import { cartTokenHash } from '../src/lib/cart/identity';
import { parseEmailSnapshot } from '../src/emails/templates';
import { parseShopSnapshot } from '../src/emails/shop';
import type { ProviderRefund, RefundGateway } from '../src/lib/refunds/gateway';
import { RefundProviderError } from '../src/lib/refunds/gateway';
import {
  addReturnPhotos,
  approveReturn,
  cancelReturn,
  createAdminReturn,
  receiveReturn,
  refundReturn,
  rejectReturn,
  replaceReturn,
  requestReturn,
  requestWithdrawal,
  returnableLines,
} from '../src/lib/returns/service';
import {
  purgeReturnPhotos,
  readReturnPhoto,
  storeReturnPhotos,
} from '../src/lib/returns/photos';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1'].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  )
)
  throw new Error('Tests réservés à PostgreSQL local.');
const db = getPrisma();
// The shop's notices go here, whatever the local configuration.
process.env.NOTIFICATION_EMAIL_TO = 'boutique@caldera.test';

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
        // The shop is told, with the customer's own words.
        const [notice, ...more] = await emails('SHOP_RETURN_REQUESTED');
        assert.equal(more.length, 0);
        assert.equal(notice!.recipient, 'boutique@caldera.test');
        const told = parseShopSnapshot(notice!.snapshot).returnRequest;
        assert.equal(told?.id, request.id);
        assert.equal(told?.withdrawal, true);
        assert.equal(told?.message, 'Finalement non');
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
        // Recorded by the shop itself: nothing to tell it.
        assert.equal((await emails('SHOP_RETURN_REQUESTED')).length, 1);
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

    await t.test(
      'réclamation : photo, colis reçu, remplacement expédié',
      async () => {
        // Local files only: never a real Blob store from a test.
        const saved = {
          token: process.env.BLOB_READ_WRITE_TOKEN,
          store: process.env.BLOB_STORE_ID,
          dir: process.env.UPLOAD_DIR,
        };
        const dir = await mkdtemp(path.join(tmpdir(), 'caldera-returns-'));
        delete process.env.BLOB_READ_WRITE_TOKEN;
        delete process.env.BLOB_STORE_ID;
        process.env.UPLOAD_DIR = dir;
        try {
          const png = await sharp({
            create: {
              width: 24,
              height: 24,
              channels: 3,
              background: '#c0392b',
            },
          })
            .png()
            .toBuffer();
          const [photo] = await storeReturnPhotos([
            new File([new Uint8Array(png)], 'coin.png', { type: 'image/png' }),
          ]);
          assert.ok(await readReturnPhoto(photo!));
          await assert.rejects(
            storeReturnPhotos([
              new File(['pas une image'], 'faux.png', { type: 'image/png' }),
            ]),
            /faux\.png/,
          );
          const request = await requestReturn({
            orderId: order.id,
            reason: 'DAMAGED',
            items: [{ orderItemId: itemB.id, quantity: 1 }],
            message: 'Coin enfoncé',
            photos: [photo!],
          });
          // The shop's notice counts the photo; the photo stays private.
          const notice = (await emails('SHOP_RETURN_REQUESTED')).find((row) =>
            row.dedupeKey.endsWith(request.id),
          )!;
          assert.equal(
            parseShopSnapshot(notice.snapshot).returnRequest?.photos,
            1,
          );
          await assert.rejects(
            addReturnPhotos(admin.id, request.id, Array(6).fill('x.webp')),
            /6 photos au plus/,
          );

          await receiveReturn(admin.id, request.id);
          const [received] = (await emails('RETURN_RECEIVED')).filter((row) =>
            row.dedupeKey.endsWith(request.id),
          );
          assert.ok(received, 'Client prévenu de la réception');

          const stockB = async () =>
            db.productVariant.findUniqueOrThrow({ where: { id: variantB.id } });
          const before = (await stockB()).stockQuantity;
          const shipment = {
            carrierCode: 'COLISSIMO',
            carrierName: 'Colissimo',
            hasTracking: true,
            trackingNumber: '8R00012345',
            trackingUrl: 'https://www.laposte.fr/outils/suivre-vos-envois',
          };
          const replaced = await replaceReturn(admin.id, request.id, {
            shipment,
            message: 'Voici un coffret neuf.',
          });
          assert.equal(replaced.status, 'REPLACED');
          assert.ok(replaced.closedAt);
          assert.equal((await stockB()).stockQuantity, before - 1);
          const adjustment = await db.inventoryAdjustment.findFirstOrThrow({
            where: { variantId: variantB.id, type: 'REPLACEMENT' },
          });
          assert.equal(adjustment.quantityDelta, -1);
          const parcel = await db.shipment.findUniqueOrThrow({
            where: { returnId: request.id },
          });
          assert.equal(parcel.isPrimary, false);
          assert.equal(parcel.status, 'SHIPPED');
          const [mail] = (await emails('RETURN_REPLACED')).filter((row) =>
            row.dedupeKey.endsWith(request.id),
          );
          const snapshot = parseEmailSnapshot(mail!.snapshot).returnRequest!;
          assert.equal(snapshot.replacement?.trackingNumber, '8R00012345');
          assert.equal(snapshot.resolution, 'Voici un coffret neuf.');
          // Settled once: no second parcel, no refund on top.
          await assert.rejects(
            replaceReturn(admin.id, request.id, { shipment, message: '' }),
            /changé d’état/,
          );
          // The new unit can itself be returned later.
          assert.deepEqual(await left(), { A: 1, B: 1 });

          // Not enough stock: refused, nothing moves.
          const other = await requestReturn({
            orderId: order.id,
            reason: 'DEFECTIVE',
            items: [{ orderItemId: itemA.id, quantity: 1 }],
            message: 'Ne fonctionne pas',
          });
          const variant = await db.productVariant.findUniqueOrThrow({
            where: { id: variantA.id },
          });
          await db.productVariant.update({
            where: { id: variantA.id },
            data: { stockQuantity: variant.reservedQuantity },
          });
          await assert.rejects(
            replaceReturn(admin.id, other.id, { shipment, message: '' }),
            /Stock insuffisant/,
          );
          assert.equal(
            (
              await db.returnRequest.findUniqueOrThrow({
                where: { id: other.id },
              })
            ).status,
            'REQUESTED',
          );
          await db.productVariant.update({
            where: { id: variantA.id },
            data: { stockQuantity: variant.stockQuantity },
          });
          await cancelReturn(admin.id, other.id);

          // A year after closing, the photos go: rows and files.
          await db.returnRequest.update({
            where: { id: request.id },
            data: { closedAt: new Date(Date.now() - 400 * 86400000) },
          });
          assert.ok((await purgeReturnPhotos()).photosPurged >= 1);
          assert.equal(await readReturnPhoto(photo!), null);
          assert.equal(
            await db.returnPhoto.count({ where: { returnId: request.id } }),
            0,
          );
        } finally {
          for (const [name, value] of [
            ['BLOB_READ_WRITE_TOKEN', saved.token],
            ['BLOB_STORE_ID', saved.store],
            ['UPLOAD_DIR', saved.dir],
          ] as const)
            if (value === undefined) delete process.env[name];
            else process.env[name] = value;
          await rm(dir, { recursive: true, force: true });
        }
      },
    );
  } finally {
    await db.shipment.deleteMany({ where: { orderId: order.id } });
    await purgeTestInvoices(db, [order.id]);
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
