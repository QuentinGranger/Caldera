import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NextRequest } from 'next/server';
import { proxy } from '../src/proxy';

test('launch curtain opens only the account and keeps storefront closed even with the former preview cookie', async () => {
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
