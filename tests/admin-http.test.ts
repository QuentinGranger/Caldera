import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { hashPassword } from 'better-auth/crypto';
import sharp from 'sharp';
import { imageStorage } from '../src/lib/storage/images';
import { getPrisma } from '../src/lib/db/prisma';
import { orderAccessUrl } from '../src/lib/orders/access';
import { enqueueOrderEmail } from '../src/lib/email/outbox';
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
test('administration : authentification et Server Actions HTTP', async (t) => {
  const key = randomUUID();
  const email = `http-admin-${key}@example.com`;
  const password = `test-${randomUUID()}`;
  const adminId = randomUUID();
  const admin = await db.adminUser.create({
    data: {
      id: adminId,
      name: 'Admin HTTP',
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
      orderNumber: `ADM-HTTP-${key}`,
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
  let cookie = '';
  const uploadedUrls: string[] = [];
  async function action(
    name: string,
    values: Record<string, string | File> = {},
    selectedCookie = cookie,
    requestOrigin = origin,
    noArgs = false,
  ) {
    const actionId = Object.entries(manifest.node).find(
      ([, value]) => value.exportedName === name,
    )?.[0];
    assert.ok(actionId, `Action absente : ${name}`);
    const data = new FormData();
    for (const [name, value] of Object.entries(values))
      data.set(`_1_${name}`, value);
    data.set(
      '0',
      JSON.stringify(noArgs ? [] : [{ success: false, message: '' }, '$K1']),
    );
    const response = await fetch(`${base}/admin/login`, {
      method: 'POST',
      headers: {
        'Next-Action': actionId,
        Accept: 'text/x-component',
        Origin: requestOrigin,
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
  function sessionCookie(cookies: string[]) {
    const value = cookies.find((header) =>
      /caldera_admin\.session_token=/.test(header),
    );
    assert.ok(value, 'Cookie de session absent');
    return value;
  }
  try {
    await t.test(
      'routes protégées, guest cookie inutilisable, aucune inscription publique',
      async () => {
        for (const path of [
          '/admin',
          '/admin/produits',
          '/admin/produits/nouveau',
          `/admin/produits/${product.id}`,
          '/admin/stocks',
          '/admin/commandes',
          `/admin/commandes/${order.id}`,
          '/admin/categories',
          '/admin/extensions',
          `/admin/commandes/${order.id}/bon-preparation`,
        ]) {
          const result = await page(path, 'caldera_cart=invalid');
          assert.ok(
            result.response.status === 307 ||
              result.html.includes('NEXT_REDIRECT'),
          );
          assert.ok(
            (result.response.headers.get('location') ?? result.html).includes(
              '/admin/login',
            ),
          );
          assert.ok(
            !result.html.includes(order.email),
            'Données client exposées sans session',
          );
        }
        const signup = await fetch(`${base}/api/auth/sign-up/email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: `intruder-${key}@example.com`,
            password,
            name: 'Intruder',
          }),
        });
        assert.equal(signup.status, 404);
      },
    );
    await t.test(
      'actions non authentifiées et origine étrangère refusées',
      async () => {
        const result = await action(
          'adjustStockAction',
          {
            variantId: variant.id,
            mode: 'delta',
            quantity: '10',
            type: 'RESTOCK',
            reason: 'Forgery',
          },
          '',
        );
        assert.ok(
          (
            result.response.headers.get('x-action-redirect') ?? result.body
          ).includes('/admin/login'),
        );
        const csrf = await action(
          'loginAction',
          { email, password },
          '',
          'https://attacker.example',
        );
        assert.ok(csrf.response.status >= 400);
        assert.equal(
          (
            await db.productVariant.findUniqueOrThrow({
              where: { id: variant.id },
            })
          ).stockQuantity,
          5,
        );
      },
    );
    await t.test('mauvais mot de passe et admin inactif refusés', async () => {
      const wrong = await action(
        'loginAction',
        { email, password: 'incorrect-password' },
        '',
      );
      assert.ok(wrong.body.includes('Identifiants incorrects'));
      await db.adminUser.update({
        where: { id: admin.id },
        data: { isActive: false },
      });
      const inactive = await action('loginAction', { email, password }, '');
      assert.ok(
        !inactive.cookies.some((value) =>
          /caldera_admin\.session_token=/.test(value),
        ),
      );
      assert.equal(
        await db.adminSession.count({ where: { userId: admin.id } }),
        0,
      );
      await db.adminUser.update({
        where: { id: admin.id },
        data: { isActive: true },
      });
    });
    await t.test(
      'connexion réelle : HttpOnly, SameSite, Secure, huit heures et lastLogin',
      async () => {
        const result = await action('loginAction', { email, password }, '');
        assert.ok(
          (result.response.headers.get('x-action-redirect') ?? '').startsWith(
            '/admin',
          ),
          `Connexion sans redirection, statut ${result.response.status}`,
        );
        const header = sessionCookie(result.cookies);
        assert.ok(/HttpOnly/i.test(header));
        assert.ok(/SameSite=Lax/i.test(header));
        assert.ok(/Secure/i.test(header));
        cookie = header.split(';')[0]!;
        const session = await db.adminSession.findFirstOrThrow({
          where: { userId: admin.id },
        });
        assert.ok(
          Math.abs(
            session.expiresAt.getTime() -
              session.createdAt.getTime() -
              8 * 3600000,
          ) < 10000,
        );
        assert.ok(
          (await db.adminUser.findUniqueOrThrow({ where: { id: admin.id } }))
            .lastLoginAt,
        );
      },
    );
    await t.test(
      'dashboard, listes et formulaires : données privées sans cache public',
      async () => {
        for (const path of [
          '/admin',
          '/admin/produits',
          '/admin/produits/nouveau',
          `/admin/produits/${product.id}`,
          '/admin/stocks',
          '/admin/categories',
          '/admin/extensions',
        ]) {
          const result = await page(path);
          assert.equal(result.response.status, 200);
          assert.ok(
            !result.html.includes('Administration indisponible'),
            `Erreur serveur sur ${path}`,
          );
          assert.ok(
            /private|no-store/.test(
              result.response.headers.get('cache-control') ?? '',
            ),
          );
          assert.ok(result.html.includes('noindex'));
        }
        for (const sort of ['name', 'created', 'updated', 'price', 'stock']) {
          const result = await page(
            `/admin/produits?search=${key}&sort=${sort}&status=ACTIVE&language=FR&categoryId=${category.id}&availability=in`,
          );
          assert.ok(
            result.html.includes(product.name),
            `Produit absent avec tri ${sort}`,
          );
        }
        const search = await page(`/admin/produits?search=${variant.sku}`);
        assert.ok(search.html.includes(product.name));
      },
    );
    await t.test(
      'recherche commandes numéro / email / SKU et snapshots détaillés',
      async () => {
        for (const search of [
          order.orderNumber,
          order.email,
          variant.sku,
          order.publicId,
        ]) {
          const result = await page(
            `/admin/commandes?search=${encodeURIComponent(search)}&status=PAID&payment=SUCCEEDED`,
          );
          assert.ok(result.html.includes(order.orderNumber));
        }
        const detail = await page(`/admin/commandes/${order.id}`);
        for (const text of [
          'Nom snapshot HTTP',
          '1 rue du Test',
          'Paris',
          'Réussi',
          'Consommée',
          '59,90',
          'Note confidentielle HTTP',
        ])
          assert.ok(
            detail.html.includes(text),
            `Information manquante : ${text}`,
          );
        assert.ok(!detail.html.includes('Annuler la commande impayée'));
        const publicProduct = await page(`/produit/${product.slug}`, '');
        assert.ok(!publicProduct.html.includes('Note confidentielle HTTP'));
        assert.ok(!publicProduct.html.includes('costPrice'));
      },
    );
    await t.test(
      'fulfillment HTTP : auth, transitions, aperçu, suivi signé et impression',
      async () => {
        const confirmation = await db.$transaction((tx) =>
          enqueueOrderEmail(tx, order.id, 'ORDER_CONFIRMATION'),
        );
        const access = new URL(orderAccessUrl(order.publicId)).searchParams.get(
          'access',
        )!;
        const customerPath = `/commande/${order.publicId}?access=${encodeURIComponent(access)}`;
        const unowned = await page(`/commande/${order.publicId}`, '');
        assert.ok(!unowned.html.includes(order.email));
        for (const path of [
          `/checkout/paiement/${order.publicId}?access=${access}`,
          `/api/commande/${order.publicId}?access=${access}`,
        ]) {
          const denied = await page(path, '');
          assert.equal(denied.response.status, 404);
        }
        const first = await page(customerPath, '');
        assert.ok(first.html.includes('Commande reçue'));
        assert.ok(first.html.includes('noindex'));
        assert.ok(!first.html.includes(order.internalNote!));
        assert.equal(
          first.response.headers.get('referrer-policy'),
          'no-referrer',
        );
        for (const name of [
          'fulfillmentAction',
          'shipmentAction',
          'correctTrackingAction',
          'retryEmailAction',
        ]) {
          const denied = await action(
            name,
            { orderId: order.id, next: 'PREPARING', emailId: confirmation.id },
            '',
          );
          assert.ok(
            (
              denied.response.headers.get('x-action-redirect') ?? denied.body
            ).includes('/admin/login'),
          );
        }
        const deniedPreview = await page(
          `/admin/emails/${confirmation.id}/preview`,
          '',
        );
        assert.equal(deniedPreview.response.status, 307);
        const invalid = await action('fulfillmentAction', {
          orderId: order.id,
          next: 'DELIVERED',
        });
        assert.ok(invalid.body.includes('non autorisée'));
        for (const next of ['PREPARING', 'READY_TO_SHIP']) {
          const result = await action('fulfillmentAction', {
            orderId: order.id,
            next,
          });
          assert.ok(result.body.includes('"success":true'));
        }
        const ready = await page(customerPath, '');
        assert.ok(ready.html.includes('Prête à être expédiée'));
        const shipment = await action('shipmentAction', {
          orderId: order.id,
          carrierCode: 'COLISSIMO',
          trackingNumber: `001${key}`,
          trackingUrl: 'https://example.com/colis',
        });
        assert.ok(shipment.body.includes('"success":true'));
        assert.equal(
          await db.emailDelivery.count({
            where: { orderId: order.id, type: 'ORDER_SHIPPED' },
          }),
          0,
        );
        const shipped = await action('fulfillmentAction', {
          orderId: order.id,
          next: 'SHIPPED',
        });
        assert.ok(shipped.body.includes('"success":true'));
        await action('fulfillmentAction', {
          orderId: order.id,
          next: 'SHIPPED',
        });
        assert.equal(
          await db.emailDelivery.count({
            where: { orderId: order.id, type: 'ORDER_SHIPPED' },
          }),
          1,
        );
        const tracking = await page(customerPath, '');
        assert.ok(tracking.html.includes(`001${key}`));
        assert.ok(tracking.html.includes('Suivre mon colis'));
        for (const sort of ['paid', 'shipped']) {
          const list = await page(
            `/admin/commandes?search=001${key}&fulfillment=SHIPPED&sort=${sort}`,
          );
          assert.ok(list.html.includes(order.orderNumber));
        }
        const incompatible = await page(
          `/admin/commandes?search=${key}&fulfillment=SHIPPED&status=PAYMENT_FAILED`,
        );
        assert.ok(!incompatible.html.includes(order.orderNumber));
        const preview = await page(`/admin/emails/${confirmation.id}/preview`);
        assert.equal(preview.response.status, 200);
        assert.ok(preview.html.includes('Merci pour votre commande'));
        assert.ok(preview.html.includes('Nom snapshot HTTP'));
        assert.ok(!preview.html.includes(order.internalNote!));
        assert.ok(
          (preview.response.headers.get('cache-control') ?? '').includes(
            'no-store',
          ),
        );
        const slip = await page(`/admin/commandes/${order.id}/bon-preparation`);
        assert.ok(slip.html.includes('Bon de préparation'));
        assert.ok(slip.html.includes(variant.sku));
        assert.ok(!slip.html.includes(order.internalNote!));
        await db.emailDelivery.update({
          where: { id: confirmation.id },
          data: {
            status: 'FAILED',
            attemptCount: 1,
            firstAttemptAt: new Date(),
          },
        });
        const retry = await action('retryEmailAction', {
          emailId: confirmation.id,
        });
        assert.ok(retry.body.includes('"success":true'));
        assert.equal(
          (
            await db.emailDelivery.findUniqueOrThrow({
              where: { id: confirmation.id },
            })
          ).status,
          'PENDING',
        );
        const delivered = await action('fulfillmentAction', {
          orderId: order.id,
          next: 'DELIVERED',
        });
        assert.ok(delivered.body.includes('"success":true'));
        const final = await page(customerPath, '');
        assert.ok(final.html.includes('Livrée (confirmation manuelle)'));
      },
    );
    await t.test(
      'stock forgé refusé puis ajustement authentifié appliqué et audité',
      async () => {
        const forged = await action('adjustStockAction', {
          variantId: variant.id,
          mode: 'delta',
          quantity: '10',
          type: 'RESTOCK',
          reason: 'Test',
          reservedQuantity: '0',
        });
        assert.ok(forged.body.includes('non autorisé'));
        const result = await action('adjustStockAction', {
          variantId: variant.id,
          mode: 'delta',
          quantity: '10',
          type: 'RESTOCK',
          reason: 'Réception HTTP',
        });
        assert.ok(result.body.includes('"success":true'));
        assert.equal(
          (
            await db.productVariant.findUniqueOrThrow({
              where: { id: variant.id },
            })
          ).stockQuantity,
          15,
        );
        assert.equal(
          await db.inventoryAdjustment.count({
            where: { variantId: variant.id, quantityDelta: 10 },
          }),
          1,
        );
        const noteForgery = await action('orderNoteAction', {
          id: order.id,
          status: 'PENDING_PAYMENT',
          totalAmount: '1',
          internalNote: 'forged',
        });
        assert.ok(noteForgery.body.includes('non autorisé'));
        assert.equal(
          (await db.order.findUniqueOrThrow({ where: { id: order.id } }))
            .status,
          'PAID',
        );
      },
    );
    await t.test(
      'upload HTTP, image publique réencodée, optimisation Next et suppression de galerie',
      async () => {
        const png = await sharp({
          create: { width: 32, height: 32, channels: 3, background: '#e8c261' },
        })
          .png()
          .toBuffer();
        const uploaded = await action('uploadImageAction', {
          productId: product.id,
          alt: 'Visuel HTTP',
          file: new File([new Uint8Array(png)], 'http.png', {
            type: 'image/png',
          }),
        });
        assert.ok(
          uploaded.body.includes('"success":true'),
          'Upload HTTP refusé',
        );
        const image = await db.productImage.findFirstOrThrow({
          where: { productId: product.id },
        });
        uploadedUrls.push(image.url);
        const publicImage = await fetch(`${base}${image.url}`);
        assert.equal(publicImage.status, 200);
        assert.equal(publicImage.headers.get('content-type'), 'image/webp');
        assert.equal(
          publicImage.headers.get('x-content-type-options'),
          'nosniff',
        );
        const optimized = await fetch(
          `${base}/_next/image?url=${encodeURIComponent(image.url)}&w=256&q=75`,
        );
        assert.equal(optimized.status, 200);
        const removed = await action('deleteImageAction', {
          id: image.id,
          productId: product.id,
        });
        assert.ok(removed.body.includes('"success":true'));
        assert.equal(
          (await fetch(`${base}${image.url}`)).status,
          200,
          'Le fichier historique doit être conservé',
        );
      },
    );
    await t.test(
      'révocation admin immédiate et expiration serveur',
      async () => {
        await db.adminUser.update({
          where: { id: admin.id },
          data: { isActive: false },
        });
        let result = await page('/admin');
        assert.ok(
          (result.response.headers.get('location') ?? result.html).includes(
            '/admin/login',
          ),
        );
        await db.adminUser.update({
          where: { id: admin.id },
          data: { isActive: true },
        });
        await db.adminSession.updateMany({
          where: { userId: admin.id },
          data: { expiresAt: new Date(Date.now() - 1000) },
        });
        result = await page('/admin');
        assert.ok(
          (result.response.headers.get('location') ?? result.html).includes(
            '/admin/login',
          ),
        );
      },
    );
    await t.test(
      'déconnexion révoque la session en base et le cookie',
      async () => {
        const login = await action('loginAction', { email, password }, '');
        cookie = sessionCookie(login.cookies).split(';')[0]!;
        const logout = await action('logoutAction', {}, cookie, origin, true);
        assert.ok(
          logout.cookies.some((value) =>
            /caldera_admin\.session_token=;/.test(value),
          ),
        );
        assert.equal(
          await db.adminSession.count({
            where: { userId: admin.id, expiresAt: { gt: new Date() } },
          }),
          0,
        );
        const result = await page('/admin');
        assert.ok(
          (result.response.headers.get('location') ?? result.html).includes(
            '/admin/login',
          ),
        );
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
    await db.inventoryAdjustment.deleteMany({
      where: { adminUserId: admin.id },
    });
    await db.adminAuditLog.deleteMany({ where: { adminUserId: admin.id } });
    await db.productVariant.deleteMany({ where: { productId: product.id } });
    await db.product.delete({ where: { id: product.id } });
    await db.category.delete({ where: { id: category.id } });
    await db.adminUser.delete({ where: { id: admin.id } });
    for (const url of uploadedUrls) await imageStorage.delete(url);
    await db.$disconnect();
  }
});
