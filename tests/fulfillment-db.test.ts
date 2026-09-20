import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { parisDate } from '../src/lib/admin/dates';
import { getPrisma } from '../src/lib/db/prisma';
import { cartTokenHash } from '../src/lib/cart/identity';
import {
  transitionFulfillment,
  saveShipment,
} from '../src/lib/fulfillment/service';
import { enqueueOrderEmail } from '../src/lib/email/outbox';
import {
  processPendingEmails,
  retryEmail,
  renderDelivery,
} from '../src/lib/email/processor';
import {
  EmailProviderError,
  type EmailProvider,
  type EmailEnvelope,
} from '../src/lib/email/provider';
import { orderAccessUrl, verifyOrderAccess } from '../src/lib/orders/access';
import { getCustomerOrder, getOwnedOrder } from '../src/lib/orders/queries';
import { parseEmailSnapshot, renderEmail } from '../src/emails/templates';
import { validTrackingUrl } from '../src/lib/fulfillment/carriers';
if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1'].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  )
)
  throw new Error('Tests réservés à PostgreSQL local.');
const db = getPrisma();
function form(values: Record<string, string | boolean>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values))
    if (value !== false) data.set(key, value === true ? 'on' : value);
  return data;
}
const settings = {
  from: 'Caldera <test@example.com>',
  testRecipient: 'recipient@example.com',
  replyTo: undefined,
};
test('préparation, expédition et outbox PostgreSQL', async (t) => {
  const key = randomUUID();
  const admin = await db.adminUser.create({
    data: { name: 'Test fulfillment', email: `fulfillment-${key}@example.com` },
  });
  const category = await db.category.create({
    data: { name: 'Catégorie HTTP', slug: `admin-http-${key}` },
  });
  const product = await db.product.create({
    data: {
      name: `Produit HTTP ${key}`,
      slug: `admin-http-${key}`,
      categoryId: category.id,
      productType: 'ETB',
      status: 'ACTIVE',
      variants: {
        create: {
          sku: `HTTP-${key}`,
          price: '59.90',
          stockQuantity: 5,
          isDefault: true,
        },
      },
    },
    include: { variants: true },
  });
  const variant = product.variants[0]!;
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
      orderNumber: `FULFILLMENT-${key}`,
      status: 'PAID',
      email: `customer-${key}@example.com`,
      currency: 'EUR',
      subtotalAmount: '59.90',
      shippingAmount: '0',
      totalAmount: '59.90',
      shippingMethodCode: 'TEST',
      shippingMethodName: 'Livraison test',
      paidAt: new Date(),
      internalNote: 'Note confidentielle HTTP',
      items: {
        create: {
          productId: product.id,
          variantId: variant.id,
          productName: 'Nom snapshot HTTP',
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
          amount: '59.90',
          currency: 'EUR',
          paidAt: new Date(),
        },
      },
      addresses: {
        create: {
          role: 'SHIPPING',
          firstName: 'Test',
          lastName: 'Snapshot',
          addressLine1: '1 rue du Test',
          postalCode: '75001',
          city: 'Paris',
          countryCode: 'FR',
        },
      },
      reservations: {
        create: {
          variantId: variant.id,
          quantity: 1,
          status: 'CONSUMED',
          expiresAt: new Date(),
        },
      },
    },
  });

  const transition = (next: string) =>
    transitionFulfillment(admin.id, form({ orderId: order.id, next }));
  const current = () =>
    db.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { payment: true, shipments: true, emails: true },
    });
  const email = (id: string) =>
    db.emailDelivery.findUniqueOrThrow({ where: { id } });
  const received = new Map<string, EmailEnvelope>();
  let calls = 0;
  const provider: EmailProvider = {
    name: 'fake-resend',
    async send(envelope, key) {
      calls++;
      const existing = received.get(key);
      if (existing) assert.deepEqual(envelope, existing);
      received.set(key, envelope);
      return { id: `message-${key}` };
    },
  };
  let confirmationId = '';
  let shippedId = '';
  const run = (emailId: string, selected = provider) =>
    processPendingEmails({ emailId, provider: selected, settings });
  const shipmentForm = (extra: Record<string, string | boolean> = {}) =>
    form({
      orderId: order.id,
      carrierCode: 'COLISSIMO',
      trackingNumber: ' 001ABC ',
      trackingUrl: 'https://example.com/tracking/001ABC',
      ...extra,
    });
  try {
    await t.test('email réservé à une commande réellement payée', async () => {
      await db.order.update({
        where: { id: order.id },
        data: { status: 'PAYMENT_FAILED' },
      });
      await assert.rejects(transition('PREPARING'));
      await assert.rejects(
        db.$transaction((tx) =>
          enqueueOrderEmail(tx, order.id, 'ORDER_CONFIRMATION'),
        ),
      );
      await db.order.update({
        where: { id: order.id },
        data: { status: 'PAID' },
      });
      await assert.rejects(transition('DELIVERED'));
      const first = await db.$transaction((tx) =>
        enqueueOrderEmail(tx, order.id, 'ORDER_CONFIRMATION'),
      );
      const again = await db.$transaction((tx) =>
        enqueueOrderEmail(tx, order.id, 'ORDER_CONFIRMATION'),
      );
      assert.equal(first.id, again.id);
      confirmationId = first.id;
    });
    await t.test(
      'désactivé par défaut : aucune tentative ni envoi réel',
      async () => {
        assert.notEqual(
          process.env.EMAILS_ENABLED,
          'true',
          'Désactiver les envois avant les tests',
        );
        assert.equal(
          (await processPendingEmails({ emailId: confirmationId })).disabled,
          true,
        );
        assert.equal((await email(confirmationId)).attemptCount, 0);
      },
    );
    await t.test(
      'snapshots échappés et liens absolus signés, sans données internes',
      async () => {
        const delivery = await email(confirmationId);
        const snapshot = parseEmailSnapshot(delivery.snapshot);
        snapshot.items[0]!.name = '<script>alert("x")</script>';
        snapshot.address[0] = 'Client <img onerror="x">';
        snapshot.orderNumber += '\r\nInjected';
        const url = orderAccessUrl(order.publicId);
        const rendered = renderEmail('ORDER_CONFIRMATION', snapshot, {
          order: url,
          logo: 'https://example.com/logo.png',
        });
        assert.ok(rendered.html.includes('&lt;script&gt;'));
        assert.ok(!rendered.html.includes('<script>'));
        assert.ok(!rendered.subject.includes('\n'));
        assert.ok(!rendered.html.includes(order.internalNote!));
        assert.ok(!rendered.html.includes('costPrice'));
        assert.ok(rendered.text.includes(snapshot.items[0]!.name));
        const token = new URL(url).searchParams.get('access');
        assert.ok(verifyOrderAccess(order.publicId, token));
        assert.equal(verifyOrderAccess('0'.repeat(64), token), false);
        assert.equal(verifyOrderAccess(order.publicId, `${token}x`), false);
        assert.equal(
          verifyOrderAccess(
            order.publicId,
            token,
            new Date(Date.now() + 181 * 86400000),
          ),
          false,
        );
        assert.equal(
          (await getCustomerOrder(order.publicId, undefined, token))?.id,
          order.id,
        );
        assert.equal(await getOwnedOrder(order.publicId, undefined), null);
        assert.equal(
          await getCustomerOrder(order.publicId, undefined, 'invalid'),
          null,
        );
        for (const url of [
          'javascript:alert(1)',
          'https://user:pass@example.com',
          'not a URL',
        ])
          assert.throws(() => validTrackingUrl(url));
      },
    );
    await t.test(
      'échec fournisseur : PAID conservée, erreur contrôlée et retry admin',
      async () => {
        const failing: EmailProvider = {
          name: 'fake-resend',
          async send() {
            throw new EmailProviderError('FOURNISSEUR_HTTP_503');
          },
        };
        assert.equal((await run(confirmationId, failing)).failed, 1);
        assert.equal((await email(confirmationId)).status, 'FAILED');
        await run(confirmationId, failing);
        assert.equal(
          (await email(confirmationId)).attemptCount,
          1,
          'Le backoff doit différer la reprise automatique',
        );
        assert.equal((await current()).status, 'PAID');
        await retryEmail(admin.id, confirmationId);
        const before = calls;
        await Promise.all([run(confirmationId), run(confirmationId)]);
        assert.equal(calls - before, 1);
        assert.equal((await email(confirmationId)).status, 'SENT');
        assert.equal((await email(confirmationId)).attemptCount, 2);
        await assert.rejects(retryEmail(admin.id, confirmationId));
        assert.equal((await run(confirmationId)).sent, 0);
      },
    );
    await t.test(
      'préparation puis prête, sans changement financier ou stock',
      async () => {
        const stock = await db.productVariant.findUniqueOrThrow({
          where: { id: variant.id },
        });
        await transition('PREPARING');
        assert.equal((await current()).fulfillmentStatus, 'PREPARING');
        await transition('READY_TO_SHIP');
        assert.equal((await current()).fulfillmentStatus, 'READY_TO_SHIP');
        assert.ok((await current()).preparationStartedAt);
        assert.ok((await current()).readyToShipAt);
        assert.equal((await current()).payment!.status, 'SUCCEEDED');
        assert.equal(
          (
            await db.productVariant.findUniqueOrThrow({
              where: { id: variant.id },
            })
          ).stockQuantity,
          stock.stockQuantity,
        );
        await assert.rejects(transition('SHIPPED'));
      },
    );
    await t.test(
      'brouillon suivi valide, double création et version concurrente',
      async () => {
        await assert.rejects(
          saveShipment(admin.id, shipmentForm({ trackingNumber: '' })),
        );
        await assert.rejects(
          saveShipment(
            admin.id,
            shipmentForm({ trackingUrl: 'javascript:alert(1)' }),
          ),
        );
        const [a, b] = await Promise.all([
          saveShipment(admin.id, shipmentForm()),
          saveShipment(admin.id, shipmentForm()),
        ]);
        assert.equal(a.id, b.id);
        assert.equal(a.status, 'DRAFT');
        assert.equal(a.trackingNumber, '001ABC');
        assert.equal(
          await db.emailDelivery.count({
            where: { orderId: order.id, type: 'ORDER_SHIPPED' },
          }),
          0,
        );
        await assert.rejects(
          saveShipment(
            admin.id,
            shipmentForm({
              shipmentId: a.id,
              version: new Date(0).toISOString(),
            }),
          ),
        );
      },
    );
    await t.test(
      'double expédition : un colis, un email, un audit',
      async () => {
        await Promise.all([transition('SHIPPED'), transition('SHIPPED')]);
        const row = await current();
        assert.equal(row.fulfillmentStatus, 'SHIPPED');
        assert.equal(row.status, 'PAID');
        assert.equal(row.shipments.length, 1);
        assert.equal(row.shipments[0]!.status, 'SHIPPED');
        assert.ok(row.shippedAt);
        assert.equal(
          row.shippedAt.toISOString(),
          row.shipments[0]!.shippedAt!.toISOString(),
        );
        const emails = row.emails.filter((e) => e.type === 'ORDER_SHIPPED');
        assert.equal(emails.length, 1);
        shippedId = emails[0]!.id;
        assert.equal(
          await db.adminAuditLog.count({
            where: { entityId: order.id, action: 'ORDER_SHIPPED' },
          }),
          1,
        );
        await assert.rejects(transition('PREPARING'));
        await assert.rejects(saveShipment(admin.id, shipmentForm()));
      },
    );
    await t.test(
      'correction de suivi auditée, dates et email initial conservés',
      async () => {
        const row = await current();
        const shipment = row.shipments[0]!;
        const updated = await saveShipment(
          admin.id,
          shipmentForm({
            shipmentId: shipment.id,
            version: shipment.updatedAt.toISOString(),
            trackingNumber: '002ABC',
            trackingUrl: 'https://example.com/tracking/002ABC',
            reason: 'Erreur de saisie',
          }),
          true,
        );
        assert.equal(
          updated.shippedAt!.toISOString(),
          shipment.shippedAt!.toISOString(),
        );
        assert.equal(
          await db.adminAuditLog.count({
            where: { entityId: order.id, action: 'SHIPMENT_TRACKING_UPDATED' },
          }),
          1,
        );
        assert.equal(
          parseEmailSnapshot((await email(shippedId)).snapshot).shipment!
            .trackingNumber,
          '001ABC',
        );
        const preview = renderDelivery(await email(shippedId));
        assert.ok(preview.html.includes('Suivre mon colis'));
        assert.ok(preview.html.includes('001ABC'));
        assert.equal(
          await db.emailDelivery.count({
            where: { orderId: order.id, type: 'ORDER_SHIPPED' },
          }),
          1,
        );
      },
    );
    await t.test(
      'réponse fournisseur perdue : reprise avec clé et enveloppe identiques',
      async () => {
        const unreliable: EmailProvider = {
          name: provider.name,
          async send(envelope, key) {
            await provider.send(envelope, key);
            throw new EmailProviderError('RESEAU_OU_TIMEOUT');
          },
        };
        await run(shippedId, unreliable);
        assert.equal((await current()).fulfillmentStatus, 'SHIPPED');
        const frozen = (await email(shippedId)).envelope;
        await db.emailDelivery.update({
          where: { id: shippedId },
          data: {
            status: 'SENDING',
            leaseUntil: new Date(Date.now() - 1000),
            leaseToken: randomUUID(),
          },
        });
        await run(shippedId);
        assert.equal((await email(shippedId)).status, 'SENT');
        assert.deepEqual((await email(shippedId)).envelope, frozen);
        assert.equal(received.size, 2); // one confirmation, one shipment, despite repeated network calls
      },
    );
    await t.test(
      'limite et fenêtre Resend expirée : pas de renvoi risquant un doublon',
      async () => {
        await db.emailDelivery.update({
          where: { id: shippedId },
          data: {
            status: 'PENDING',
            firstAttemptAt: new Date(Date.now() - 24 * 3600000),
            nextAttemptAt: new Date(0),
          },
        });
        const before = calls;
        await run(shippedId);
        assert.equal(calls, before);
        assert.equal((await email(shippedId)).retryBlocked, true);
        await assert.rejects(retryEmail(admin.id, shippedId));
        await db.emailDelivery.update({
          where: { id: shippedId },
          data: {
            status: 'FAILED',
            attemptCount: 5,
            firstAttemptAt: new Date(),
            retryBlocked: false,
          },
        });
        await assert.rejects(retryEmail(admin.id, shippedId));
        await run(shippedId);
        assert.equal(calls, before);
      },
    );
    await t.test(
      'destinataire test modifié : aucune enveloppe figée envoyée au mauvais destinataire',
      async () => {
        await db.emailDelivery.update({
          where: { id: confirmationId },
          data: { status: 'FAILED', nextAttemptAt: new Date(0) },
        });
        const before = calls;
        await processPendingEmails({
          emailId: confirmationId,
          provider,
          settings: { ...settings, testRecipient: 'different@example.com' },
        });
        assert.equal(calls, before);
        assert.equal(
          (await email(confirmationId)).lastError,
          'DESTINATAIRE_FIGE_DIFFERENT_DU_TEST',
        );
      },
    );
    await t.test(
      'sans suivi : pas de faux lien ; livraison exclusivement manuelle',
      async () => {
        const shipment = (await current()).shipments[0]!;
        await saveShipment(
          admin.id,
          shipmentForm({
            shipmentId: shipment.id,
            version: shipment.updatedAt.toISOString(),
            carrierCode: 'OTHER',
            carrierName: 'Remise sans suivi',
            hasTracking: false,
            trackingNumber: '',
            trackingUrl: '',
            reason: 'Mode sans suivi confirmé',
          }),
          true,
        );
        const snapshot = parseEmailSnapshot((await email(shippedId)).snapshot);
        snapshot.shipment = {
          carrier: 'Sans suivi',
          trackingNumber: null,
          trackingUrl: null,
        };
        const rendered = renderEmail('ORDER_SHIPPED', snapshot, {
          order: orderAccessUrl(order.publicId),
          logo: 'https://example.com/logo.png',
        });
        assert.ok(!rendered.html.includes('Suivre mon colis'));
        assert.ok(!rendered.text.includes('Suivre mon colis'));
        await transition('DELIVERED');
        const row = await current();
        assert.equal(row.fulfillmentStatus, 'DELIVERED');
        assert.equal(row.shipments[0]!.status, 'DELIVERED');
        assert.ok(row.deliveredAt);
        assert.equal(row.emails.length, 2);
      },
    );
    await t.test(
      'journées de Paris : frontières exactes aux changements d’heure',
      () => {
        assert.equal(
          parisDate('2026-03-29')!.toISOString(),
          '2026-03-28T23:00:00.000Z',
        );
        assert.equal(
          parisDate('2026-03-29', true)!.toISOString(),
          '2026-03-29T22:00:00.000Z',
        );
        assert.equal(
          parisDate('2026-10-25')!.toISOString(),
          '2026-10-24T22:00:00.000Z',
        );
        assert.equal(
          parisDate('2026-10-25', true)!.toISOString(),
          '2026-10-25T23:00:00.000Z',
        );
      },
    );
    await t.test(
      'admin révoqué et champs forgés refusés côté service',
      async () => {
        await assert.rejects(
          transitionFulfillment(
            admin.id,
            form({ orderId: order.id, next: 'DELIVERED', status: 'PAID' }),
          ),
        );
        await db.adminUser.update({
          where: { id: admin.id },
          data: { isActive: false },
        });
        await assert.rejects(transition('DELIVERED'));
      },
    );
  } finally {
    await db.emailDelivery.deleteMany({ where: { orderId: order.id } });
    await db.shipment.deleteMany({ where: { orderId: order.id } });
    await db.stockReservation.deleteMany({ where: { orderId: order.id } });
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
