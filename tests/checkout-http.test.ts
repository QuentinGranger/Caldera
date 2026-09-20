import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { getPrisma } from '../src/lib/db/prisma';
import { cartTokenHash } from '../src/lib/cart/identity';
import { emptyAddress } from '../src/lib/checkout/types';
if (process.env.NODE_ENV === 'production')
  throw new Error('Fixtures réservées au développement.');
const base = process.env.TEST_BASE_URL ?? 'http://localhost:3001';
const manifest = JSON.parse(
  await readFile(
    process.env.TEST_ACTION_MANIFEST ??
      '.next/server/server-reference-manifest.json',
    'utf8',
  ),
) as { node: Record<string, { exportedName?: string }> };
const db = getPrisma();
test('checkout HTTP : parcours invité et actions autorisées', async (t) => {
  const key = randomUUID(),
    tokens = new Set<string>();
  const category = await db.category.create({
    data: { name: 'Test HTTP checkout', slug: `test-checkout-http-${key}` },
  });
  const product = await db.product.create({
    data: {
      name: 'Test HTTP checkout',
      slug: `test-checkout-http-${key}`,
      categoryId: category.id,
      status: 'ACTIVE',
      productType: 'ETB',
      variants: {
        create: {
          sku: `TEST-CHECKOUT-HTTP-${key}`,
          price: '59.90',
          stockQuantity: 5,
        },
      },
    },
    include: { variants: true },
  });
  const standard = await db.shippingMethod.findUniqueOrThrow({
    where: { code: 'DEV-STANDARD' },
  });
  const variantId = product.variants[0]!.id;
  let cookie = '',
    sessionId = '';
  const contact = {
    email: 'expedition@example.com',
    phone: '+33 6 12 34 56 78',
    billingSame: true,
    shipping: {
      ...emptyAddress(),
      firstName: 'Éléonore',
      lastName: 'D’Angelo-Le Roy',
      addressLine1: '12 rue des Terres',
      postalCode: '75001',
      city: 'Paris',
    },
    billing: null,
  };
  async function action(
    name: string,
    args: unknown[],
    path = '/checkout?step=contact',
    selectedCookie = cookie,
    origin = new URL(base).origin,
  ) {
    const id = Object.entries(manifest.node).find(
      ([, value]) => value.exportedName === name,
    )?.[0];
    assert.ok(id);
    const response = await fetch(base + path, {
      method: 'POST',
      headers: {
        'Next-Action': id,
        'Content-Type': 'text/plain;charset=UTF-8',
        Accept: 'text/x-component',
        Origin: origin,
        Cookie: selectedCookie,
      },
      body: JSON.stringify(args),
    });
    const setCookie = response.headers.get('set-cookie'),
      token = /caldera_cart=([a-f0-9]{64})/.exec(setCookie ?? '')?.[1];
    if (token) tokens.add(token);
    return {
      status: response.status,
      cookie: setCookie?.split(';')[0],
      body: await response.text(),
    };
  }
  async function page(path: string, selectedCookie = cookie) {
    const response = await fetch(base + path, {
      headers: { Cookie: selectedCookie },
      redirect: 'manual',
    });
    const body = await response.text();
    return {
      response,
      body,
      html: body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, ''),
    };
  }
  function assertRedirect(
    result: Awaited<ReturnType<typeof page>>,
    path: string,
  ) {
    assert.ok(
      result.response.headers.get('location')?.includes(path) ||
        result.body.includes(`url=${path}`) ||
        result.body.includes(`NEXT_REDIRECT;replace;${path}`),
      `Redirection attendue vers ${path}`,
    );
  }
  try {
    await t.test(
      'panier absent et cookie invalide redirigent vers /panier',
      async () => {
        assertRedirect(await page('/checkout', ''), '/panier');
        assertRedirect(
          await page('/checkout', 'caldera_cart=invalid'),
          '/panier',
        );
      },
    );
    await t.test(
      'CTA panier crée une session, protège review et simplifie le header',
      async () => {
        const added = await action(
          'addToCartAction',
          [variantId, 1],
          '/panier',
        );
        cookie = added.cookie!;
        const started = await action('startCheckoutAction', [], '/panier');
        assert.match(started.body, /"success":true/);
        const cart = await db.cart.findUniqueOrThrow({
          where: { tokenHash: cartTokenHash(cookie.split('=')[1])! },
        });
        sessionId = (
          await db.checkoutSession.findFirstOrThrow({
            where: { cartId: cart.id },
          })
        ).id;
        assertRedirect(
          await page('/checkout?step=review'),
          '/checkout?step=contact',
        );
        const result = await page('/checkout?step=contact');
        assert.equal(result.response.status, 200);
        assert.match(result.html, /noindex, nofollow/);
        assert.match(result.html, /Vos coordonnées/);
        assert.match(result.html, /autocomplete="shipping given-name"/i);
        assert.doesNotMatch(result.html, /aria-label="Navigation principale"/);
        assert.match(result.html, /Retour au panier/);
      },
    );
    await t.test(
      'erreurs champ par champ et coordonnées persistantes',
      async () => {
        const invalid = await action('saveContactAction', [
          sessionId,
          {
            ...contact,
            email: 'invalide',
            shipping: { ...contact.shipping, city: '' },
          },
        ]);
        assert.match(invalid.body, /"success":false/);
        assert.match(invalid.body, /shipping.city/);
        const saved = await action('saveContactAction', [sessionId, contact]);
        assert.match(saved.body, /"success":true/);
        assert.match(saved.body, /"next":"shipping"/);
        assert.match(
          (await page('/checkout?step=contact')).html,
          /value="expedition@example.com"/,
        );
        assertRedirect(
          await page('/checkout?step=review'),
          '/checkout?step=shipping',
        );
      },
    );
    await t.test(
      'deux adresses conservées et liens retour accessibles',
      async () => {
        const different = {
          ...contact,
          billingSame: false,
          billing: {
            ...contact.shipping,
            addressLine1: '25 rue de Facturation',
          },
        };
        await action('saveContactAction', [sessionId, different]);
        const result = await page('/checkout?step=contact');
        assert.match(result.html, /25 rue de Facturation/);
        assert.match(result.html, /billing.addressLine1/);
        assert.equal(
          await db.checkoutAddress.count({ where: { checkoutId: sessionId } }),
          2,
        );
      },
    );
    await t.test(
      'livraison : vraies radios, frais actuels et récapitulatif READY',
      async () => {
        const before = await page('/checkout?step=shipping');
        assert.match(before.html, /type="radio"/);
        assert.match(before.html, /\[Démo\] Livraison standard/);
        const selected = await action(
          'setShippingMethodAction',
          [sessionId, standard.id],
          '/checkout?step=shipping',
        );
        assert.match(selected.body, /"success":true/);
        assert.match((await page('/checkout?step=shipping')).html, /65,80/);
        const ready = await action(
          'prepareCheckoutAction',
          [sessionId],
          '/checkout?step=shipping',
        );
        assert.match(ready.body, /"success":true/);
        assert.equal(
          (
            await db.checkoutSession.findUniqueOrThrow({
              where: { id: sessionId },
            })
          ).status,
          'READY_FOR_PAYMENT',
        );
        const result = await page('/checkout?step=review');
        assert.match(result.html, /25 rue de Facturation/);
        assert.match(result.html, /Total provisoire/);
        assert.match(result.html, /réservée pendant 20 minutes/);
        assert.match(
          result.html,
          /<button(?:(?!disabled)[^>])*>Continuer vers le paiement<\/button>/,
        );
        assert.doesNotMatch(result.html, /name="(?:card|cvv|cardNumber)"/);
      },
    );
    await t.test(
      'autorisation et CSRF : aucune modification par un autre visiteur',
      async () => {
        const other = await action(
          'addToCartAction',
          [variantId, 1],
          '/panier',
          '',
        );
        await action('startCheckoutAction', [], '/panier', other.cookie!);
        const denied = await action(
          'saveContactAction',
          [sessionId, contact],
          '/checkout',
          other.cookie!,
        );
        assert.match(denied.body, /"success":false/);
        const csrf = await action(
          'saveContactAction',
          [sessionId, contact],
          '/checkout',
          cookie,
          'https://foreign.example',
        );
        assert.ok(csrf.status >= 400);
        assert.equal(
          (
            await db.checkoutSession.findUniqueOrThrow({
              where: { id: sessionId },
            })
          ).billingSame,
          false,
        );
      },
    );
    await t.test(
      'prix et stock changés : résumé actuel et progression bloquée',
      async () => {
        await db.productVariant.update({
          where: { id: variantId },
          data: { price: '54.90' },
        });
        const refreshed = await page('/checkout?step=review');
        assert.match(refreshed.html, /60,80/);
        assert.match(refreshed.html, /Valider mon récapitulatif/);
        await action('synchronizeCheckoutAction', [], '/checkout?step=review');
        assert.equal(
          (
            await db.checkoutSession.findUniqueOrThrow({
              where: { id: sessionId },
            })
          ).status,
          'IN_PROGRESS',
        );
        await db.productVariant.update({
          where: { id: variantId },
          data: { stockQuantity: 0 },
        });
        assert.match(
          (await page('/checkout?step=review')).html,
          /Vérifier mon panier/,
        );
        assert.match(
          (
            await action(
              'prepareCheckoutAction',
              [sessionId],
              '/checkout?step=review',
            )
          ).body,
          /"success":false/,
        );
        await db.productVariant.update({
          where: { id: variantId },
          data: { stockQuantity: 5 },
        });
      },
    );
    await t.test(
      'expiration et reprise explicite, aucune nouvelle session au GET',
      async () => {
        await db.checkoutSession.update({
          where: { id: sessionId },
          data: { expiresAt: new Date(0) },
        });
        const count = await db.checkoutSession.count();
        const result = await page('/checkout?step=contact');
        assert.match(result.html, /Démarrer une nouvelle session/);
        assert.equal(await db.checkoutSession.count(), count);
        await action('synchronizeCheckoutAction', []);
        assert.equal(
          (
            await db.checkoutSession.findUniqueOrThrow({
              where: { id: sessionId },
            })
          ).status,
          'EXPIRED',
        );
        await action('startCheckoutAction', []);
        assert.equal(await db.checkoutSession.count(), count + 1);
        assert.doesNotMatch(
          (await page('/checkout?step=contact')).html,
          /value="expedition@example.com"/,
        );
      },
    );
  } finally {
    await db.cart.deleteMany({
      where: {
        tokenHash: { in: [...tokens].map((token) => cartTokenHash(token)!) },
      },
    });
    await db.productVariant.deleteMany({ where: { productId: product.id } });
    await db.product.delete({ where: { id: product.id } });
    await db.category.delete({ where: { id: category.id } });
    await db.$disconnect();
  }
});
