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
