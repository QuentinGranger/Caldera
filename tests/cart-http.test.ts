import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { getPrisma } from '../src/lib/db/prisma';
import { cartTokenHash } from '../src/lib/cart/identity';

if (process.env.NODE_ENV === 'production')
  throw new Error('Fixtures réservées à la base de développement.');
const base = process.env.TEST_BASE_URL ?? 'http://localhost:3001';
const origin = new URL(base).origin;
const manifestPath =
  process.env.TEST_ACTION_MANIFEST ??
  '.next/server/server-reference-manifest.json';
const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
  node: Record<string, { exportedName?: string }>;
};
const db = getPrisma();
test('Server Actions panier : HTTP, cookie et rendu personnalisé', async (t) => {
  const key = randomUUID(),
    tokens = new Set<string>();
  const category = await db.category.create({
    data: { name: 'Test HTTP panier', slug: `test-cart-http-${key}` },
  });
  const product = await db.product.create({
    data: {
      name: 'Panier HTTP de test',
      slug: `test-cart-http-${key}`,
      categoryId: category.id,
      status: 'ACTIVE',
      productType: 'ETB',
      variants: {
        create: {
          sku: `TEST-CART-HTTP-${key}`,
          price: '59.90',
          stockQuantity: 5,
        },
      },
    },
    include: { variants: true },
  });
  const variantId = product.variants[0]!.id;
  let cookie = '';
  async function action(
    name: string,
    args: unknown[],
    selectedCookie = cookie,
    requestOrigin = origin,
  ) {
    const id = Object.entries(manifest.node).find(
      ([, value]) => value.exportedName === name,
    )?.[0];
    assert.ok(id, `Action absente du manifest : ${name}`);
    const response = await fetch(`${base}/panier`, {
      method: 'POST',
      headers: {
        'Next-Action': id,
        'Content-Type': 'text/plain;charset=UTF-8',
        Accept: 'text/x-component',
        Origin: requestOrigin,
        Cookie: selectedCookie,
      },
      body: JSON.stringify(args),
    });
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      const token = /caldera_cart=([a-f0-9]{64})/.exec(setCookie)?.[1];
      if (token) tokens.add(token);
    }
    return { response, setCookie, body: await response.text() };
  }
  async function page(selectedCookie = cookie) {
    const response = await fetch(`${base}/panier`, {
      headers: { Cookie: selectedCookie },
    });
    assert.equal(response.status, 200);
    assert.match(
      response.headers.get('cache-control') ?? '',
      /private|no-store/,
    );
    return response.text();
  }
  try {
    await t.test(
      'sans cookie / invalide : vide, noindex, aucun cookie ni panier créé',
      async () => {
        const count = await db.cart.count();
        for (const value of ['', 'caldera_cart=invalid']) {
          const html = await page(value);
          assert.match(html, /Votre panier est vide/);
          assert.match(html, /noindex, nofollow/);
        }
        assert.equal(await db.cart.count(), count);
      },
    );
    await t.test(
      'ajout : cookie HttpOnly SameSite Lax 30 jours et rendu RSC actualisé',
      async () => {
        const result = await action('addToCartAction', [variantId, 1]);
        assert.equal(result.response.status, 200);
        assert.match(result.body, /"success":true/);
        assert.ok(result.setCookie);
        assert.match(result.setCookie, /HttpOnly/i);
        assert.match(result.setCookie, /SameSite=lax/i);
        assert.match(result.setCookie, /Max-Age=2592000/i);
        if (!process.env.TEST_ACTION_MANIFEST)
          assert.match(result.setCookie, /Secure/i);
        cookie = result.setCookie.split(';')[0]!;
        assert.match(result.body, /"itemCount":1/);
        assert.match(await page(), /Ouvrir le panier · 1 article/);
        assert.match(await page(), /59,90/);
      },
    );
    await t.test(
      'cumul, update et stock : badge et quantité servis immédiatement',
      async () => {
        const result = await action('addToCartAction', [variantId, 2]);
        assert.match(result.body, /"itemCount":3/);
        const html = await page();
        assert.match(html, /Ouvrir le panier · 3 articles/);
        const item = await db.cartItem.findFirstOrThrow({
          where: {
            variantId,
            cart: { tokenHash: cartTokenHash(cookie.split('=')[1])! },
          },
        });
        const updated = await action('updateCartItemAction', [item.id, 5]);
        assert.match(updated.body, /"itemCount":5/);
        const rejected = await action('addToCartAction', [variantId, 1]);
        assert.match(rejected.body, /"success":false/);
        assert.match(await page(), /Ouvrir le panier · 5 articles/);
      },
    );
    await t.test(
      'validation des entrées et isolation entre deux cookies',
      async () => {
        for (const quantity of [-1, 0, 1.5, 'bonjour', 999999]) {
          const result = await action('addToCartAction', [variantId, quantity]);
          assert.match(result.body, /"success":false/);
          assert.doesNotMatch(result.body, /PrismaClientKnownRequestError/);
        }
        const other = await action('addToCartAction', [variantId, 1], '');
        const otherCookie = other.setCookie!.split(';')[0]!;
        const item = await db.cartItem.findFirstOrThrow({
          where: {
            variantId,
            cart: { tokenHash: cartTokenHash(cookie.split('=')[1])! },
          },
        });
        const result = await action(
          'removeCartItemAction',
          [item.id],
          otherCookie,
        );
        assert.match(result.body, /"success":false/);
        assert.match(await page(), /Ouvrir le panier · 5 articles/);
      },
    );
    await t.test(
      'protection native Origin : mutation étrangère refusée',
      async () => {
        const result = await action(
          'clearCartAction',
          [],
          cookie,
          'https://foreign.example',
        );
        assert.ok(result.response.status >= 400);
        assert.doesNotMatch(result.body, /"success":true/);
        assert.match(await page(), /Ouvrir le panier · 5 articles/);
      },
    );
    await t.test(
      'refresh : nouveau prix, rupture conservée, suppression possible',
      async () => {
        await db.productVariant.update({
          where: { id: variantId },
          data: { stockQuantity: 0, price: '54.90' },
        });
        const html = await page();
        assert.match(html, /54,90/);
        assert.match(html, /Rupture de stock/);
        assert.match(html, /Ouvrir le panier · 5 articles/);
        const item = await db.cartItem.findFirstOrThrow({
          where: {
            variantId,
            cart: { tokenHash: cartTokenHash(cookie.split('=')[1])! },
          },
        });
        const removed = await action('removeCartItemAction', [item.id]);
        assert.match(removed.body, /"itemCount":0/);
        assert.match(await page(), /Votre panier est vide/);
        await db.productVariant.update({
          where: { id: variantId },
          data: { stockQuantity: 5 },
        });
      },
    );
    await t.test(
      'clear : panier vide persistant et aucun jeton dans les props',
      async () => {
        await action('addToCartAction', [variantId, 1]);
        const result = await action('clearCartAction', []);
        assert.match(result.body, /"success":true/);
        assert.match(result.body, /"itemCount":0/);
        const html = await page();
        assert.match(html, /Votre panier est vide/);
        assert.ok(!html.includes(cookie.split('=')[1]!));
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
