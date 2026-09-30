import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { hashPassword } from 'better-auth/crypto';
import { getPrisma } from '../src/lib/db/prisma';
import { orderAccessUrl } from '../src/lib/orders/access';
import { cartTokenHash } from '../src/lib/cart/identity';
if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1'].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  )
)
  throw new Error('Fixtures réservées à PostgreSQL local de développement.');
const base = process.env.TEST_BASE_URL ?? 'http://localhost:3001';
const origin = new URL(base).origin;
const manifest = JSON.parse(
  await readFile(
    process.env.TEST_ACTION_MANIFEST ??
      '.next/server/server-reference-manifest.json',
    'utf8',
  ),
) as { node: Record<string, { exportedName?: string }> };
const db = getPrisma();

test('remboursements : page commande, Server Action et vue client', async (t) => {
  const key = randomUUID();
  const email = `http-refund-${key}@example.com`;
  const password = `test-${randomUUID()}`;
  const adminId = randomUUID();
  const admin = await db.adminUser.create({
    data: {
      id: adminId,
      name: 'Admin remboursement',
      email,
      accounts: {
        create: {
          accountId: adminId,
          providerId: 'credential',
          password: await hashPassword(password),
        },
      },
    },
  });
  const category = await db.category.create({
    data: { name: 'Catégorie remboursement HTTP', slug: `refund-http-${key}` },
  });
  const product = await db.product.create({
    data: {
      name: `Produit remboursement HTTP ${key}`,
      slug: `refund-http-${key}`,
      categoryId: category.id,
      productType: 'ETB',
      status: 'ACTIVE',
      variants: {
        create: {
          sku: `REFUND-HTTP-${key}`,
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
      orderNumber: `REFUND-HTTP-${key}`,
      status: 'PAID',
      email: `customer-${key}@example.com`,
      currency: 'EUR',
      subtotalAmount: '119.80',
      shippingAmount: '4.90',
      totalAmount: '124.70',
      shippingMethodCode: 'TEST',
      shippingMethodName: 'Livraison test',
      paidAt: new Date(),
      items: {
        create: {
          productId: product.id,
          variantId: variant.id,
          productName: 'Article remboursable HTTP',
          productSlug: product.slug,
          sku: variant.sku,
          language: 'FR',
          unitPrice: '59.90',
          quantity: 2,
          lineTotal: '119.80',
          imageUrl: '/assets/products/placeholder-sealed.png',
        },
      },
      payment: {
        create: {
          status: 'SUCCEEDED',
          amount: '124.70',
          currency: 'EUR',
          providerPaymentIntentId: `pi_http_${key.replaceAll('-', '')}`,
          paidAt: new Date(),
        },
      },
      addresses: {
        create: {
          role: 'SHIPPING',
          firstName: 'Test',
          lastName: 'Remboursement',
          addressLine1: '1 rue du Test',
          postalCode: '75001',
          city: 'Paris',
          countryCode: 'FR',
        },
      },
      reservations: {
        create: {
          variantId: variant.id,
          quantity: 2,
          status: 'CONSUMED',
          expiresAt: new Date(),
        },
      },
    },
    include: { items: true, payment: true },
  });
  const item = order.items[0]!;
  let cookie = '';
  async function action(
    name: string,
    values: Record<string, string> = {},
    selectedCookie = cookie,
  ) {
    const actionId = Object.entries(manifest.node).find(
      ([, value]) => value.exportedName === name,
    )?.[0];
    assert.ok(actionId, `Action absente : ${name}`);
    const data = new FormData();
    for (const [field, value] of Object.entries(values))
      data.set(`_1_${field}`, value);
    data.set('0', JSON.stringify([{ success: false, message: '' }, '$K1']));
    const response = await fetch(`${base}/admin/login`, {
      method: 'POST',
      headers: {
        'Next-Action': actionId,
        Accept: 'text/x-component',
        Origin: origin,
        Cookie: selectedCookie,
      },
      body: data,
      redirect: 'manual',
    });
    return {
      response,
      body: await response.text(),
      cookies: response.headers.getSetCookie(),
    };
  }
  async function page(path: string, selectedCookie = cookie) {
    const response = await fetch(`${base}${path}`, {
      headers: { Cookie: selectedCookie },
      redirect: 'manual',
    });
    return { response, html: await response.text() };
  }
  const refundFields = (extra: Record<string, string> = {}) => ({
    id: order.id,
    key: randomUUID(),
    reason: 'RETURN_RECEIVED',
    note: '',
    amount: '',
    [`qty:${item.id}`]: '1',
    ...extra,
  });
  const refundCount = () => db.refund.count({ where: { orderId: order.id } });

  try {
    await t.test('sans session : page et action refusées', async () => {
      const detail = await page(`/admin/commandes/${order.id}`, '');
      assert.ok(
        (detail.response.headers.get('location') ?? detail.html).includes(
          '/admin/login',
        ),
      );
      assert.ok(!detail.html.includes(order.email));
      const forged = await action('refundOrderAction', refundFields(), '');
      assert.ok(
        (
          forged.response.headers.get('x-action-redirect') ?? forged.body
        ).includes('/admin/login'),
      );
      assert.equal(await refundCount(), 0);
    });

    await t.test('connexion administrateur', async () => {
      const result = await action('loginAction', { email, password }, '');
      const header = result.cookies.find((value) =>
        /caldera_admin\.session_token=/.test(value),
      );
      assert.ok(header, 'Cookie de session absent');
      cookie = header.split(';')[0]!;
    });

    await t.test('section remboursements, privée et non indexée', async () => {
      const detail = await page(`/admin/commandes/${order.id}`);
      assert.equal(detail.response.status, 200);
      assert.ok(
        /private|no-store/.test(
          detail.response.headers.get('cache-control') ?? '',
        ),
      );
      for (const text of [
        'id="remboursements"',
        'reste remboursable',
        '124,70',
        `qty:${item.id}`,
        'Rembourser les frais de livraison',
        'Demande du client',
      ])
        assert.ok(detail.html.includes(text), `Absent : ${text}`);
      assert.ok(!detail.html.includes('implémenté ultérieurement'));
    });

    await t.test(
      'demandes invalides refusées avant tout appel à Stripe',
      async () => {
        const forged = await action(
          'refundOrderAction',
          refundFields({ orderId: order.id }),
        );
        assert.ok(forged.body.includes('Champ non autorisé'));
        const tooMuch = await action(
          'refundOrderAction',
          refundFields({ [`qty:${item.id}`]: '3' }),
        );
        assert.ok(tooMuch.body.includes('2 au plus'));
        const above = await action(
          'refundOrderAction',
          refundFields({ amount: '60,00' }),
        );
        assert.ok(above.body.includes('ne peut pas dépasser'));
        const reason = await action(
          'refundOrderAction',
          refundFields({ reason: 'GIFT' }),
        );
        assert.ok(!reason.body.includes('Remboursement de'));
        assert.equal(await refundCount(), 0);
      },
    );

    await t.test(
      'demande valide : Stripe refuse ce paiement de test, rien n’est remboursé',
      async () => {
        const fields = refundFields({ restock: 'on', note: 'Retour HTTP' });
        const result = await action('refundOrderAction', fields);
        assert.ok(result.body.includes('Stripe'), result.body.slice(-400));
        const [refund] = await db.refund.findMany({
          where: { orderId: order.id },
          include: { items: true },
        });
        assert.ok(refund);
        assert.equal(refund.status, 'FAILED');
        assert.equal(refund.createdById, admin.id);
        assert.equal(refund.amount.toFixed(2), '59.90');
        assert.equal(refund.note, 'Retour HTTP');
        assert.equal(refund.items[0]!.quantity, 1);
        // Un refus ne remet rien en stock.
        assert.equal(
          (
            await db.productVariant.findUniqueOrThrow({
              where: { id: variant.id },
            })
          ).stockQuantity,
          5,
        );
        // Même formulaire renvoyé : aucun second remboursement.
        await action('refundOrderAction', fields);
        assert.equal(await refundCount(), 1);
        const detail = await page(`/admin/commandes/${order.id}`);
        assert.ok(detail.html.includes('Historique des remboursements'));
        assert.ok(detail.html.includes('Retour HTTP'));
        assert.ok(detail.html.includes('Stripe non configuré'));
        assert.ok(detail.html.includes('Non transmis à Stripe'));
      },
    );

    await t.test(
      'remboursement confirmé : visible côté client, jamais les échecs',
      async () => {
        // Comme après le webhook Stripe « refund.updated ».
        await db.refund.create({
          data: {
            orderId: order.id,
            paymentId: order.payment!.id,
            amount: '64.80',
            shippingAmount: '4.90',
            currency: 'EUR',
            reason: 'DAMAGED',
            status: 'SUCCEEDED',
            providerRefundId: `re_http_${key.replaceAll('-', '')}`,
            idempotencyKey: randomUUID(),
            createdById: admin.id,
            succeededAt: new Date(),
            settledAt: new Date(),
            items: {
              create: { orderItemId: item.id, quantity: 1, amount: '59.90' },
            },
          },
        });
        const url = new URL(orderAccessUrl(order.publicId));
        const customer = await page(`${url.pathname}${url.search}`, '');
        assert.equal(customer.response.status, 200);
        assert.ok(customer.html.includes('Remboursements'));
        assert.ok(customer.html.includes('remboursés le'));
        assert.ok(/64,80\s€/.test(customer.html));
        assert.ok(!/59,90\s€ en cours/.test(customer.html));
        assert.ok(!customer.html.includes('Retour HTTP'));
        assert.ok(!customer.html.includes('STRIPE'));
        const list = await page(
          `/admin/commandes?search=${encodeURIComponent(order.orderNumber)}`,
        );
        assert.ok(list.html.includes('Remboursement partiel'));
        const detail = await page(`/admin/commandes/${order.id}`);
        assert.ok(detail.html.includes('59,90'));
        assert.ok(detail.html.includes('Article endommagé'));
        // 124,70 − 64,80 : il reste un article, sans les frais de port.
        assert.ok(detail.html.includes('reste remboursable'));
        assert.ok(!detail.html.includes('Rembourser les frais de livraison'));
      },
    );
  } finally {
    await db.refund.deleteMany({ where: { orderId: order.id } });
    await db.emailDelivery.deleteMany({ where: { orderId: order.id } });
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
