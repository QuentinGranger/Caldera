import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { getPrisma } from '../src/lib/db/prisma';
import { cartTokenHash } from '../src/lib/cart/identity';

if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1'].includes(
    new URL(process.env.DATABASE_URL ?? 'invalid:').hostname,
  )
)
  throw new Error('Fixtures réservées à la base de développement.');
// Server started with EMAILS_ENABLED=false: account e-mails are only logged.
const base = process.env.TEST_BASE_URL ?? 'http://localhost:3001';
const origin = new URL(base).origin;
const manifest = JSON.parse(
  await readFile('.next/server/server-reference-manifest.json', 'utf8'),
) as { node: Record<string, { exportedName?: string }> };
const db = getPrisma();

function actionId(name: string) {
  const id = Object.entries(manifest.node).find(
    ([, value]) => value.exportedName === name,
  )?.[0];
  assert.ok(id, `Action absente du manifest : ${name}`);
  return id;
}

test('compte client HTTP : pages privées, connexion, historique, adresse, suppression', async (t) => {
  const key = randomUUID().slice(0, 8);
  const email = `http-${key}@example.com`;
  const password = `phrase http ${key}`;
  let cookie = '';

  /** useActionState form action: (previous state, FormData). */
  async function formAction(
    name: string,
    values: Record<string, string>,
    selectedCookie = cookie,
    path = '/compte/connexion',
  ) {
    const data = new FormData();
    for (const [field, value] of Object.entries(values))
      data.set(`_1_${field}`, value);
    data.set('0', JSON.stringify([{ success: false, message: '' }, '$K1']));
    const response = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: {
        'Next-Action': actionId(name),
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
      redirect: response.headers.get('x-action-redirect') ?? '',
    };
  }
  async function page(path: string, selectedCookie = cookie) {
    const response = await fetch(`${base}${path}`, {
      headers: { Cookie: selectedCookie },
      redirect: 'manual',
    });
    return { response, html: await response.text() };
  }

  const cart = await db.cart.create({
    data: {
      tokenHash: cartTokenHash(randomUUID().replaceAll('-', '').repeat(2))!,
      expiresAt: new Date(Date.now() + 86400000),
    },
  });
  const checkout = await db.checkoutSession.create({
    data: { cartId: cart.id, expiresAt: new Date(Date.now() + 86400000) },
  });
  // A guest order placed earlier with the same address.
  const guestOrder = await db.order.create({
    data: {
      checkoutSessionId: checkout.id,
      publicId: randomUUID().replaceAll('-', '').repeat(2),
      orderNumber: `ACC-HTTP-${key}`,
      status: 'PAID',
      email: email.toUpperCase(),
      currency: 'EUR',
      subtotalAmount: '24.90',
      shippingAmount: '0',
      totalAmount: '24.90',
      shippingMethodCode: 'TEST',
      shippingMethodName: 'Livraison test',
      paidAt: new Date(),
      payment: {
        create: {
          status: 'SUCCEEDED',
          amount: '24.90',
          currency: 'EUR',
          paidAt: new Date(),
        },
      },
    },
  });
  try {
    await t.test(
      'espace privé : redirection, noindex, jamais en cache partagé',
      async () => {
        const { response } = await page('/compte', '');
        assert.equal(response.status, 307);
        assert.equal(
          response.headers.get('location'),
          '/compte/connexion?retour=%2Fcompte',
        );
        for (const path of [
          '/compte/connexion',
          '/compte/inscription',
          '/compte/mot-de-passe-oublie',
          '/compte/verification?token=x',
          '/compte/nouveau-mot-de-passe?token=x',
        ]) {
          const result = await page(path, '');
          assert.equal(result.response.status, 200, path);
          assert.match(
            result.response.headers.get('cache-control') ?? '',
            /private, no-store/,
            path,
          );
          assert.match(
            result.response.headers.get('x-robots-tag') ?? '',
            /noindex/,
            path,
          );
          assert.match(
            result.html,
            /<meta name="robots" content="noindex, nofollow"/,
          );
        }
      },
    );

    await t.test(
      'inscription : message générique, aucune session avant confirmation',
      async () => {
        const result = await formAction(
          'signUpAction',
          { name: 'Client HTTP', email, password },
          '',
          '/compte/inscription',
        );
        assert.match(result.body, /Presque terminé/);
        assert.ok(
          !result.cookies.some((value) => /caldera_client/.test(value)),
        );
        const customer = await db.customer.findUniqueOrThrow({
          where: { email },
        });
        assert.equal(customer.emailVerified, false);
        // Same answer for a taken address.
        const again = await formAction(
          'signUpAction',
          { name: 'Autre', email, password: 'un autre mot de passe' },
          '',
          '/compte/inscription',
        );
        assert.match(again.body, /Presque terminé/);
        const refused = await formAction(
          'signInAction',
          { email, password },
          '',
        );
        assert.match(refused.body, /Confirmez d’abord votre adresse/);
        assert.equal(refused.redirect, '');
      },
    );

    await t.test(
      'connexion : cookie HttpOnly distinct de l’admin, retour sûr',
      async () => {
        await db.customer.update({
          where: { email },
          data: { emailVerified: true },
        });
        const wrong = await formAction(
          'signInAction',
          {
            email,
            password: 'mauvais mot de passe',
          },
          '',
        );
        assert.match(wrong.body, /Adresse e-mail ou mot de passe incorrect/);
        const result = await formAction(
          'signInAction',
          {
            email,
            password,
            retour: '//exemple.com/piege',
          },
          '',
        );
        assert.ok(result.redirect.startsWith('/compte'), result.redirect);
        const header = result.cookies.find((value) =>
          /caldera_client\.session_token=/.test(value),
        );
        assert.ok(header, 'Cookie de session absent');
        assert.match(header, /HttpOnly/i);
        assert.match(header, /SameSite=Lax/i);
        cookie = header.split(';')[0]!;
        // The customer cookie never opens the administration.
        const admin = await page('/admin', cookie);
        assert.equal(admin.response.status, 307);
        assert.match(
          admin.response.headers.get('location') ?? '',
          /\/admin\/login/,
        );
      },
    );

    await t.test(
      'tableau de bord : commande passée sans compte retrouvée et consultable',
      async () => {
        const { response, html } = await page('/compte');
        assert.equal(response.status, 200);
        assert.match(
          response.headers.get('cache-control') ?? '',
          /private, no-store/,
        );
        assert.ok(html.includes(email));
        assert.ok(html.includes(guestOrder.orderNumber));
        const href = /href="(\/commande\/[a-f0-9]{64}\?access=[^"]+)"/
          .exec(html)?.[1]
          ?.replaceAll('&amp;', '&');
        assert.ok(href, 'lien de commande absent');
        const detail = await page(href, '');
        assert.equal(detail.response.status, 200);
        assert.ok(detail.html.includes(guestOrder.orderNumber));
        // Signed-in visitors reach sign-in pages only to be sent back.
        const signIn = await page('/compte/connexion');
        assert.equal(signIn.response.status, 307);
      },
    );

    await t.test('adresse et nom : validés et enregistrés', async () => {
      const invalid = await fetch(`${base}/compte`, {
        method: 'POST',
        headers: {
          'Next-Action': actionId('saveAddressAction'),
          'Content-Type': 'text/plain;charset=UTF-8',
          Accept: 'text/x-component',
          Origin: origin,
          Cookie: cookie,
        },
        body: JSON.stringify([{ firstName: 'A', countryCode: 'FR' }]),
      });
      assert.match(await invalid.text(), /Vérifiez les champs indiqués/);
      const saved = await fetch(`${base}/compte`, {
        method: 'POST',
        headers: {
          'Next-Action': actionId('saveAddressAction'),
          'Content-Type': 'text/plain;charset=UTF-8',
          Accept: 'text/x-component',
          Origin: origin,
          Cookie: cookie,
        },
        body: JSON.stringify([
          {
            firstName: 'Jeanne',
            lastName: 'Client',
            company: '',
            addressLine1: '74 rue du Test',
            addressLine2: '',
            postalCode: '69005',
            city: 'Lyon',
            region: '',
            countryCode: 'FR',
            phone: '',
          },
        ]),
      });
      assert.match(await saved.text(), /Adresse enregistrée/);
      const customer = await db.customer.findUniqueOrThrow({
        where: { email },
        include: { address: true },
      });
      assert.equal(customer.address?.city, 'Lyon');
      const renamed = await formAction(
        'updateNameAction',
        { name: '  Jeanne   Client ' },
        cookie,
        '/compte',
      );
      assert.match(renamed.body, /Votre nom est enregistré/);
      assert.equal(
        (await db.customer.findUniqueOrThrow({ where: { email } })).name,
        'Jeanne Client',
      );
      // Without a session the action sends to sign-in and writes nothing.
      const anonymous = await formAction(
        'updateNameAction',
        { name: 'Intrus' },
        '',
        '/compte',
      );
      assert.match(anonymous.redirect, /^\/compte\/connexion/);
    });

    await t.test('mot de passe : l’actuel est exigé', async () => {
      const result = await formAction(
        'changePasswordAction',
        {
          currentPassword: 'pas le bon',
          password: 'nouvelle phrase http',
          confirmation: 'nouvelle phrase http',
        },
        cookie,
        '/compte',
      );
      assert.match(result.body, /Mot de passe actuel incorrect/);
    });

    await t.test(
      'suppression : compte effacé, commande conservée',
      async () => {
        const refused = await formAction(
          'deleteAccountAction',
          { password: 'pas le bon' },
          cookie,
          '/compte',
        );
        assert.match(refused.body, /Mot de passe incorrect/);
        const deleted = await formAction(
          'deleteAccountAction',
          { password },
          cookie,
          '/compte',
        );
        assert.equal(deleted.redirect.split(';')[0], '/?compte=supprime');
        assert.equal(await db.customer.count({ where: { email } }), 0);
        assert.equal(await db.order.count({ where: { id: guestOrder.id } }), 1);
        const { response } = await page('/compte');
        assert.equal(response.status, 307);
      },
    );
  } finally {
    await db.payment.deleteMany({ where: { orderId: guestOrder.id } });
    await db.order.deleteMany({ where: { id: guestOrder.id } });
    await db.cart.deleteMany({ where: { id: cart.id } });
    await db.customer.deleteMany({ where: { email } });
    await db.customerAuthAttempt.deleteMany({
      where: { key: { not: 'global' } },
    });
    await db.$disconnect();
  }
});
