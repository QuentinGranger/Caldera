import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isDemoIndexablePath } from '../src/lib/seo/demo';
import { NextRequest } from 'next/server';
import { proxy } from '../src/proxy';
import {
  getPageUrls,
  getLandingUrls,
  countIndexableProducts,
  getProductUrls,
} from '../src/app/sitemaps/_lib/data';

test('demo SEO: public brand/editorial pages remain discoverable, sample stock and private paths do not', async () => {
  const previous = {
    open: process.env.STORE_OPEN,
    demo: process.env.CATALOG_DEMO_MODE,
  };
  process.env.STORE_OPEN = '1';
  process.env.CATALOG_DEMO_MODE = '1';
  try {
    for (const path of [
      '/',
      '/liens',
      '/guides',
      '/guides/proteger-ses-cartes',
      '/glossaire/etb',
      '/univers',
      '/univers/aureval',
      '/univers/carnets/chapitre',
      '/contact',
      '/confidentialite',
    ]) {
      assert.equal(isDemoIndexablePath(path), true, path);
      const response = await proxy(
        new NextRequest('https://lesterresdecaldera.fr' + path),
      );
      assert.equal(response.headers.get('x-robots-tag'), null, path);
    }
    for (const path of [
      '/catalogue',
      '/pokemon/scelles',
      '/extensions',
      '/guides-fake',
      '/produit-fake',
      '/newsletter',
      '/newsletter/confirmation',
      '/compte/commandes',
      '/admin',
      '/univers/carnets/chapitre/prive',
    ]) {
      assert.equal(isDemoIndexablePath(path), false, path);
      const response = await proxy(
        new NextRequest('https://lesterresdecaldera.fr' + path),
      );
      assert.match(response.headers.get('x-robots-tag') ?? '', /noindex/, path);
    }
    assert.deepEqual(await getLandingUrls(), []);
    assert.deepEqual(await getProductUrls(1), []);
    assert.equal(await countIndexableProducts(), 0);
    const preview = await proxy(
      new NextRequest(
        'https://caldera-preview.vercel.app/guides/proteger-ses-cartes',
      ),
    );
    assert.match(preview.headers.get('x-robots-tag') ?? '', /noindex/);
    const pages = await getPageUrls();
    assert.ok(pages.some((page) => new URL(page.loc).pathname === '/'));
    for (const { loc } of pages)
      assert.ok(isDemoIndexablePath(new URL(loc).pathname), loc);
  } finally {
    if (previous.open === undefined) delete process.env.STORE_OPEN;
    else process.env.STORE_OPEN = previous.open;
    if (previous.demo === undefined) delete process.env.CATALOG_DEMO_MODE;
    else process.env.CATALOG_DEMO_MODE = previous.demo;
  }
});
