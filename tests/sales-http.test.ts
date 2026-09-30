import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { hashPassword } from 'better-auth/crypto';
import { getPrisma } from '../src/lib/db/prisma';
import { orderAccessUrl } from '../src/lib/orders/access';
import { cartTokenHash } from '../src/lib/cart/identity';
import { transaction } from '../src/lib/orders/common';
import { issueInvoice } from '../src/lib/invoices/service';
import { purgeTestInvoices } from './helpers/invoices';
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

test('ventes : codes promo, retours, factures et fiscalité en HTTP', async (t) => {
  const key = randomUUID();
  const email = `http-sales-${key}@example.com`;
  const password = `test-${randomUUID()}`;
  const adminId = randomUUID();
  const admin = await db.adminUser.create({
    data: {
      id: adminId,
      name: 'Admin ventes',
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
    data: { name: 'Catégorie ventes HTTP', slug: `sales-http-${key}` },
  });
  const product = await db.product.create({
    data: {
      name: `Produit ventes HTTP ${key}`,
      slug: `sales-http-${key}`,
      categoryId: category.id,
      productType: 'ETB',
      status: 'ACTIVE',
      variants: {
        create: { sku: `SALES-${key}`, price: '39.90', stockQuantity: 5 },
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
  const orderNumber = `CAL-2026-${randomBytes(10).toString('hex').toUpperCase()}`;
  const order = await db.order.create({
    data: {
      checkoutSessionId: checkout.id,
      publicId: randomUUID().replaceAll('-', '').repeat(2),
      orderNumber,
      status: 'PAID',
      email: `client-${key}@example.com`,
      currency: 'EUR',
      subtotalAmount: '79.80',
      shippingAmount: '4.90',
      totalAmount: '84.70',
      shippingMethodCode: 'TEST',
      shippingMethodName: 'Livraison test',
      paidAt: new Date(Date.now() - 4 * 86400000),
      deliveredAt: new Date(Date.now() - 2 * 86400000),
      fulfillmentStatus: 'DELIVERED',
      items: {
        create: {
          productId: product.id,
          variantId: variant.id,
          productName: 'Coffret retourné HTTP',
          productSlug: product.slug,
          sku: variant.sku,
          language: 'FR',
          unitPrice: '39.90',
          quantity: 2,
          lineTotal: '79.80',
          imageUrl: '/assets/products/placeholder-sealed.png',
        },
      },
      payment: {
        create: {
          status: 'SUCCEEDED',
          amount: '84.70',
          currency: 'EUR',
          providerPaymentIntentId: `pi_sales_${key.replaceAll('-', '')}`,
          paidAt: new Date(),
        },
      },
      addresses: {
        create: {
          role: 'SHIPPING',
          firstName: 'Camille',
          lastName: 'Ventes',
          addressLine1: '1 rue du Test',
          postalCode: '75001',
          city: 'Paris',
          countryCode: 'FR',
        },
      },
    },
    include: { items: true },
  });
  const invoice = await transaction((tx) => issueInvoice(tx, order.id));
  const signed = new URL(orderAccessUrl(order.publicId));
  const access = signed.searchParams.get('access')!;
  const code = `HTTP-${key.slice(0, 8).toUpperCase()}`;
  let cookie = '';

  async function page(path: string, selectedCookie = cookie) {
    const response = await fetch(`${base}${path}`, {
      headers: { Cookie: selectedCookie },
      redirect: 'manual',
    });
    return { response, html: await response.text() };
  }
  async function action(
    name: string,
    values: Record<string, string>,
    path = '/admin/login',
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
    const response = await fetch(`${base}${path}`, {
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
  const adminPages = [
    '/admin/promotions',
    '/admin/promotions/nouvelle',
    '/admin/retours',
    '/admin/factures',
    '/admin/factures/reglages',
    '/admin/fiscalite',
  ];

  try {
    await t.test('sans session : pages et PDF réservés', async () => {
      for (const path of [...adminPages, `/admin/factures/${invoice.id}/pdf`]) {
        const result = await page(path, '');
        assert.ok(
          (result.response.headers.get('location') ?? result.html).includes(
            '/admin/login',
          ),
          `Accès sans session : ${path}`,
        );
        assert.ok(!result.html.includes(order.email));
      }
      const forged = await action(
        'savePromotionAction',
        { code, label: 'x', type: 'FREE_SHIPPING', isActive: 'on' },
        '/admin/login',
        '',
      );
      assert.ok(
        (
          forged.response.headers.get('x-action-redirect') ?? forged.body
        ).includes('/admin/login'),
      );
      assert.equal(await db.promotion.count({ where: { code } }), 0);
    });

    await t.test('connexion administrateur', async () => {
      const result = await action(
        'loginAction',
        { email, password },
        '/admin/login',
        '',
      );
      const header = result.cookies.find((value) =>
        /caldera_admin\.session_token=/.test(value),
      );
      assert.ok(header, 'Cookie de session absent');
      cookie = header.split(';')[0]!;
    });

    await t.test('pages admin privées, sans erreur', async () => {
      for (const path of adminPages) {
        const result = await page(path);
        assert.equal(result.response.status, 200, path);
        assert.ok(
          /private|no-store/.test(
            result.response.headers.get('cache-control') ?? '',
          ),
          path,
        );
        assert.ok(!result.html.includes('Administration indisponible'), path);
      }
      assert.ok((await page('/admin/factures')).html.includes(invoice.number));
      assert.ok((await page('/admin/fiscalite')).html.includes('Stripe Tax'));
      assert.ok(
        (await page(`/admin/commandes/${order.id}`)).html.includes(
          invoice.number,
        ),
      );
    });

    await t.test('code promo créé depuis l’administration', async () => {
      const created = await action('savePromotionAction', {
        code: code.toLowerCase(),
        label: 'Code HTTP',
        type: 'PERCENTAGE',
        percentOff: '15',
        isActive: 'on',
      });
      assert.ok(
        created.body.includes(`Code ${code} enregistré`),
        created.body.slice(-300),
      );
      const promotion = await db.promotion.findUniqueOrThrow({
        where: { code },
      });
      assert.equal(promotion.createdById, admin.id);
      const list = await page(`/admin/promotions?search=${code}`);
      assert.ok(list.html.includes(code));
      assert.ok(list.html.includes('−15 %'));
      assert.equal(
        (await page(`/admin/promotions/${promotion.id}`)).response.status,
        200,
      );
    });

    await t.test(
      'factures PDF : admin, client avec lien signé, sinon 404',
      async () => {
        const adminPdf = await fetch(
          `${base}/admin/factures/${invoice.id}/pdf`,
          {
            headers: { Cookie: cookie },
          },
        );
        assert.equal(adminPdf.status, 200);
        assert.equal(adminPdf.headers.get('content-type'), 'application/pdf');
        assert.match(
          Buffer.from(await adminPdf.arrayBuffer())
            .subarray(0, 5)
            .toString(),
          /^%PDF-/,
        );
        const path = `/commande/${order.publicId}/documents/${invoice.id}`;
        const customer = await fetch(
          `${base}${path}?access=${encodeURIComponent(access)}`,
        );
        assert.equal(customer.status, 200);
        assert.match(customer.headers.get('cache-control') ?? '', /no-store/);
        assert.match(customer.headers.get('x-robots-tag') ?? '', /noindex/);
        assert.equal((await fetch(`${base}${path}`)).status, 404);
        assert.equal(
          (
            await fetch(
              `${base}/commande/${order.publicId}/documents/${randomUUID()}?access=${encodeURIComponent(access)}`,
            )
          ).status,
          404,
        );
      },
    );

    await t.test('rétractation depuis la commande', async () => {
      const detail = await page(`${signed.pathname}${signed.search}`, '');
      assert.equal(detail.response.status, 200);
      assert.ok(detail.html.includes('Se rétracter du contrat ici'));
      assert.ok(detail.html.includes(invoice.number));
      const form = await page(
        `/commande/${order.publicId}/retour?access=${encodeURIComponent(access)}`,
        '',
      );
      assert.equal(form.response.status, 200);
      assert.ok(form.html.includes('Confirmer ma rétractation'));
      assert.ok(form.html.includes('noindex'));
      const result = await action(
        'requestReturnAction',
        {
          publicId: order.publicId,
          access,
          reason: 'WITHDRAWAL',
          message: '',
          [`qty:${order.items[0]!.id}`]: '1',
        },
        `/commande/${order.publicId}/retour`,
        '',
      );
      assert.match(result.body, /rétractation n° RET-\d{4}-[0-9A-F]{8}/);
      const request = await db.returnRequest.findFirstOrThrow({
        where: { orderId: order.id },
      });
      assert.equal(request.source, 'CUSTOMER');
      const anonymous = await page(`/admin/retours/${request.id}`, '');
      assert.ok(!anonymous.html.includes(order.email));
      assert.ok(!anonymous.html.includes(request.number));
      const admin_ = await page(`/admin/retours/${request.id}`);
      assert.equal(admin_.response.status, 200);
      assert.ok(admin_.html.includes('Accepter le retour'));
      assert.ok((await page('/admin/retours')).html.includes(request.number));
      // Sans accès à la commande : refusé.
      const forged = await action(
        'requestReturnAction',
        {
          publicId: order.publicId,
          access: 'invalide',
          reason: 'WITHDRAWAL',
          message: '',
          [`qty:${order.items[0]!.id}`]: '1',
        },
        `/commande/${order.publicId}/retour`,
        '',
      );
      assert.ok(forged.body.includes('Commande introuvable'));
    });

    await t.test('formulaire public de rétractation', async () => {
      const public_ = await page('/retractation', '');
      assert.equal(public_.response.status, 200);
      assert.ok(public_.html.includes('Confirmer ma rétractation'));
      const wrong = await action(
        'withdrawalAction',
        { orderNumber, email: 'autre@example.com', message: '' },
        '/retractation',
        '',
      );
      assert.ok(wrong.body.includes('Aucune commande payée'));
      const done = await action(
        'withdrawalAction',
        {
          orderNumber: orderNumber.toLowerCase(),
          email: order.email,
          message: '',
        },
        '/retractation',
        '',
      );
      assert.ok(done.body.includes('toute la commande'), done.body.slice(-300));
      assert.equal(
        await db.returnRequest.count({ where: { orderId: order.id } }),
        2,
      );
      const cgv = await page('/cgv', '');
      assert.ok(cgv.html.includes('href="/retractation"'));
      assert.ok(!cgv.html.includes('URL À COMPLÉTER'));
    });
  } finally {
    await purgeTestInvoices(db, [order.id]);
    await db.returnRequest.deleteMany({ where: { orderId: order.id } });
    await db.emailDelivery.deleteMany({ where: { orderId: order.id } });
    await db.orderItem.deleteMany({ where: { orderId: order.id } });
    await db.orderAddress.deleteMany({ where: { orderId: order.id } });
    await db.payment.deleteMany({ where: { orderId: order.id } });
    await db.order.delete({ where: { id: order.id } });
    await db.checkoutSession.delete({ where: { id: checkout.id } });
    await db.cart.delete({ where: { id: cart.id } });
    await db.promotion.deleteMany({ where: { code } });
    await db.adminAuditLog.deleteMany({ where: { adminUserId: admin.id } });
    await db.productVariant.deleteMany({ where: { productId: product.id } });
    await db.product.delete({ where: { id: product.id } });
    await db.category.delete({ where: { id: category.id } });
    await db.adminUser.delete({ where: { id: admin.id } });
    await db.$disconnect();
  }
});
