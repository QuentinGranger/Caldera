import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ErrorEvent, Event } from '@sentry/nextjs';
import {
  scrubBreadcrumb,
  scrubEvent,
  stripQuery,
} from '../src/lib/monitoring/scrub';
import { isIndexableHost, siteOrigin } from '../src/lib/site';
const order =
  'https://lesterresdecaldera.fr/commande/0f7c2f4e?access=1790000000.abcdef';
const stripe =
  'https://lesterresdecaldera.fr/commande/0f7c2f4e?payment_intent=pi_1&payment_intent_client_secret=pi_1_secret_x&redirect_status=succeeded';
test('URL : jeton de commande et secret Stripe retirés', () => {
  assert.equal(
    stripQuery(order),
    'https://lesterresdecaldera.fr/commande/0f7c2f4e',
  );
  assert.equal(
    stripQuery(stripe),
    'https://lesterresdecaldera.fr/commande/0f7c2f4e',
  );
  assert.equal(
    stripQuery(`GET ${order}`),
    'GET https://lesterresdecaldera.fr/commande/0f7c2f4e',
  );
  assert.equal(stripQuery('/catalogue#filtres'), '/catalogue');
  assert.equal(stripQuery('/catalogue'), '/catalogue');
});
test('événement Sentry : aucune query string, cookie ni referer transmis', () => {
  const event = scrubEvent({
    type: undefined,
    request: {
      url: order,
      query_string: 'access=1790000000.abcdef',
      cookies: { caldera_cart: 'x' },
      headers: {
        cookie: 'caldera_cart=x',
        referer: stripe,
        'user-agent': 'UA',
      },
    },
    breadcrumbs: [
      { category: 'navigation', data: { from: stripe, to: order } },
      { category: 'fetch', data: { url: `${order}&x=1` } },
    ],
  } as ErrorEvent);
  const sent = JSON.stringify(event);
  for (const secret of ['access=', 'client_secret', 'caldera_cart'])
    assert.doesNotMatch(sent, new RegExp(secret));
  assert.equal(event.request?.headers?.['user-agent'], 'UA');
});
test('transaction Sentry : spans et contexte de trace nettoyés', () => {
  const event = scrubEvent({
    type: 'transaction',
    transaction: '/commande/0f7c2f4e?access=1.a',
    spans: [
      {
        description: `GET ${order}`,
        data: { 'http.url': order, 'url.full': stripe, 'url.query': '?a=1' },
      },
    ],
    contexts: { trace: { data: { url: order } } },
  } as unknown as Event);
  assert.doesNotMatch(
    JSON.stringify(event),
    /access=|client_secret|url\.query/,
  );
});
test('breadcrumb : message et URL nettoyés', () => {
  const crumb = scrubBreadcrumb({
    message: `Navigating to ${order}`,
    data: { url: stripe },
  });
  assert.doesNotMatch(JSON.stringify(crumb), /access=|client_secret/);
});
test('SEO : seul le domaine de la boutique est indexable', () => {
  assert.equal(isIndexableHost('lesterresdecaldera.fr'), true);
  assert.equal(isIndexableHost('www.lesterresdecaldera.fr'), true);
  assert.equal(isIndexableHost('les-terres-de-caldera.vercel.app'), false);
  assert.equal(isIndexableHost('localhost:3000'), false);
  assert.equal(isIndexableHost(null), false);
});
test('SEO : origine publique issue de SITE_URL, repli production', () => {
  const saved = process.env.SITE_URL;
  try {
    process.env.SITE_URL = 'http://localhost:3000/chemin';
    assert.equal(siteOrigin(), 'http://localhost:3000');
    process.env.SITE_URL = 'ftp://exemple.fr';
    assert.equal(siteOrigin(), 'https://lesterresdecaldera.fr');
    process.env.SITE_URL = 'pas une url';
    assert.equal(siteOrigin(), 'https://lesterresdecaldera.fr');
  } finally {
    if (saved === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = saved;
  }
});
test('SEO : www redirigé en 308 vers l’apex, chemin et query conservés', async () => {
  const { NextRequest } = await import('next/server');
  const { proxy } = await import('../src/proxy');
  const request = (url: string, host = new URL(url).host) =>
    new NextRequest(url, { headers: { host } });
  const redirected = await proxy(
    request('https://www.lesterresdecaldera.fr/pokemon/etb?page=2&tri=1'),
  );
  assert.equal(redirected.status, 308);
  assert.equal(
    redirected.headers.get('location'),
    'https://lesterresdecaldera.fr/pokemon/etb?page=2&tri=1',
  );
  assert.equal(
    (await proxy(request('https://www.lesterresdecaldera.fr/'))).headers.get(
      'location',
    ),
    'https://lesterresdecaldera.fr/',
  );
  assert.equal(
    (
      await proxy(
        request(
          'https://www.lesterresdecaldera.fr/robots.txt',
          'WWW.LesTerresDeCaldera.fr:443',
        ),
      )
    ).headers.get('location'),
    'https://lesterresdecaldera.fr/robots.txt',
  );
  // A path starting with // never changes the redirect host.
  const tricky = await proxy(
    request('https://www.lesterresdecaldera.fr//exemple.com/x'),
  );
  assert.equal(
    new URL(tricky.headers.get('location')!).host,
    'lesterresdecaldera.fr',
  );
  for (const url of [
    'https://lesterresdecaldera.fr/pokemon',
    'https://les-terres-de-caldera.vercel.app/pokemon',
  ]) {
    const response = await proxy(request(url));
    assert.equal(response.headers.get('location'), null, url);
    assert.match(
      response.headers.get('content-security-policy') ?? '',
      /default-src 'self'/,
    );
  }
});
test('410 : produit retiré définitivement, liste lue sur l’origine configurée', async () => {
  const { NextRequest } = await import('next/server');
  const { proxy } = await import('../src/proxy');
  const saved = { fetch: globalThis.fetch, site: process.env.SITE_URL };
  const called: string[] = [];
  process.env.SITE_URL = 'https://lesterresdecaldera.fr';
  globalThis.fetch = (async (input: string | URL | Request) => {
    called.push(String(input));
    return Response.json({ products: ['ancien-coffret'] });
  }) as typeof fetch;
  try {
    const forged = new NextRequest(
      'https://lesterresdecaldera.fr/produit/ancien-coffret',
      { headers: { host: 'attaquant.example' } },
    );
    const gone = await proxy(forged);
    assert.equal(gone.status, 410);
    assert.equal(gone.headers.get('x-robots-tag'), 'noindex');
    assert.match(await gone.text(), /n’est plus proposé/);
    assert.deepEqual(called, ['https://lesterresdecaldera.fr/api/seo/gone']);
    const live = await proxy(
      new NextRequest('https://lesterresdecaldera.fr/produit/etb-actuel'),
    );
    assert.notEqual(live.status, 410);
    // The list is cached: no second read within five minutes.
    assert.equal(called.length, 1);
  } finally {
    globalThis.fetch = saved.fetch;
    if (saved.site === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = saved.site;
  }
});
