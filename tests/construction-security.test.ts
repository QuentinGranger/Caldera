import assert from 'node:assert/strict';
import { test } from 'node:test';

test('préouverture : un cookie arbitraire ne contourne pas le rideau', async () => {
  const { NextRequest } = await import('next/server');
  const { proxy } = await import('../src/proxy');
  const request = new NextRequest(
    'https://lesterresdecaldera.fr/catalogue',
    {
      headers: {
        host: 'lesterresdecaldera.fr',
        cookie: 'caldera_preview=1',
      },
    },
  );

  const response = await proxy(request);
  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get('x-middleware-rewrite'),
    'https://lesterresdecaldera.fr/en-construction',
  );
  assert.match(response.headers.get('cache-control') ?? '', /s-maxage=60/);
});

test('préouverture : les domaines publics Vercel montrent aussi le rideau', async () => {
  const { NextRequest } = await import('next/server');
  const { proxy } = await import('../src/proxy');

  for (const host of [
    'les-terres-de-caldera.vercel.app',
    'les-terres-de-caldera-git-main.vercel.app',
  ]) {
    const response = await proxy(
      new NextRequest(`https://${host}/catalogue`, {
        headers: { host, cookie: 'caldera_preview=1' },
      }),
    );
    assert.equal(
      response.headers.get('x-middleware-rewrite'),
      `https://${host}/en-construction`,
    );
  }
});

test('préouverture : les exceptions locales et admin restent utilisables', async () => {
  const { NextRequest } = await import('next/server');
  const { proxy } = await import('../src/proxy');

  for (const url of [
    'http://localhost:3000/catalogue',
    'https://les-terres-de-caldera.vercel.app/admin/login',
  ]) {
    const request = new NextRequest(url, {
      headers: { host: new URL(url).host },
    });
    const response = await proxy(request);
    assert.equal(response.headers.get('x-middleware-rewrite'), null);
  }
});
