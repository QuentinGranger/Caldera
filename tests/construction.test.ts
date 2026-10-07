import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NextRequest } from 'next/server';
import { proxy } from '../src/proxy';

test('launch curtain opens only the account and keeps storefront closed even with the former preview cookie', async () => {
  delete process.env.STORE_OPEN;
  for (const path of [
    '/compte',
    '/compte/connexion',
    '/compte/inscription',
    '/compte/profil',
    '/compte/commandes',
  ]) {
    const response = await proxy(
      new NextRequest(`https://lesterresdecaldera.fr${path}`),
    );
    assert.equal(response.headers.get('x-middleware-rewrite'), null, path);
  }
  for (const host of ['lesterresdecaldera.fr', 'caldera-test.vercel.app']) {
    for (const path of [
      '/',
      '/catalogue',
      '/pokemon',
      '/panier',
      '/checkout',
      '/commande/test',
      '/compte-fake',
    ]) {
      const response = await proxy(
        new NextRequest(`https://${host}${path}`, {
          headers: { cookie: 'caldera_preview=1' },
        }),
      );
      assert.equal(
        new URL(response.headers.get('x-middleware-rewrite')!).pathname,
        '/en-construction',
        `${host}${path}`,
      );
    }
  }
});

// Opening is controlled by the server environment; credentials stay protected.
test('opening the store removes the curtain while private pages retain noindex', async () => {
  const previous = process.env.STORE_OPEN;
  process.env.STORE_OPEN = '1';
  try {
    for (const path of [
      '/',
      '/catalogue',
      '/pokemon',
      '/panier',
      '/checkout',
    ]) {
      const response = await proxy(
        new NextRequest(`https://lesterresdecaldera.fr${path}`),
      );
      assert.equal(response.headers.get('x-middleware-rewrite'), null, path);
      assert.ok(response.headers.get('content-security-policy'));
    }
    for (const path of ['/admin', '/compte/profil']) {
      const response = await proxy(
        new NextRequest(`https://lesterresdecaldera.fr${path}`),
      );
      assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
      assert.match(response.headers.get('cache-control')!, /no-store/);
    }
  } finally {
    if (previous === undefined) delete process.env.STORE_OPEN;
    else process.env.STORE_OPEN = previous;
  }
});
