import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  PRODUCTS_PER_SITEMAP,
  SITEMAP_CACHE_CONTROL,
  buildSitemapIndex,
  buildUrlset,
  escapeXml,
  formatLastmod,
  latestDate,
  parseSitemapName,
  productSitemapCount,
  productSitemapRange,
  sitemapNotFound,
  sitemapPath,
  xmlResponse,
} from '../src/app/sitemaps/_lib/xml';
import { parseSitemap } from '../src/lib/seo/audit/sitemap';

const SITE = 'https://lesterresdecaldera.fr';

test('échappement XML : entités et caractères interdits', () => {
  assert.equal(escapeXml(`a&b<c>d"e'f`), 'a&amp;b&lt;c&gt;d&quot;e&apos;f');
  assert.equal(escapeXml('x\u0000y\u0008z\u001f'), 'xyz');
  assert.equal(escapeXml('ligne\ttab\nfin'), 'ligne\ttab\nfin');
  assert.equal(escapeXml('Pokémon – ETB'), 'Pokémon – ETB');
});

test('lastmod : ISO 8601 UTC, jamais inventé', () => {
  assert.equal(
    formatLastmod(new Date('2026-09-26T08:30:15.123Z')),
    '2026-09-26T08:30:15Z',
  );
  assert.equal(
    formatLastmod(new Date('2026-09-20T00:00:00Z')),
    '2026-09-20T00:00:00Z',
  );
  assert.equal(formatLastmod(null), null);
  assert.equal(formatLastmod(undefined), null);
  assert.equal(formatLastmod(new Date('invalide')), null);
  assert.deepEqual(
    latestDate([
      null,
      new Date('2026-01-01T00:00:00Z'),
      new Date('invalide'),
      new Date('2026-03-01T00:00:00Z'),
      undefined,
    ]),
    new Date('2026-03-01T00:00:00Z'),
  );
  assert.equal(latestDate([]), null);
  assert.equal(latestDate([null, undefined]), null);
});

test('urlset : loc échappée, lastmod seulement si connu, doublons retirés', () => {
  const xml = buildUrlset([
    {
      loc: `${SITE}/catalogue?page=2&sort=prix`,
      lastModified: new Date('2026-09-01T10:00:00Z'),
    },
    { loc: `${SITE}/contact` },
    { loc: `${SITE}/contact`, lastModified: new Date('2026-09-02T00:00:00Z') },
  ]);
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n'));
  assert.match(
    xml,
    /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/,
  );
  assert.doesNotMatch(xml, /xmlns:image/);
  assert.match(
    xml,
    /<loc>https:\/\/lesterresdecaldera\.fr\/catalogue\?page=2&amp;sort=prix<\/loc>/,
  );
  assert.equal(xml.match(/<url>/g)?.length, 2);
  assert.equal(xml.match(/<lastmod>/g)?.length, 1);
  assert.match(xml, /<lastmod>2026-09-01T10:00:00Z<\/lastmod>/);
  const parsed = parseSitemap(xml);
  assert.equal(parsed.kind, 'urlset');
  assert.deepEqual(parsed.entries, [
    {
      loc: `${SITE}/catalogue?page=2&sort=prix`,
      lastmod: '2026-09-01T10:00:00Z',
    },
    { loc: `${SITE}/contact`, lastmod: null },
  ]);
});

test('urlset : extension image déclarée et images dédoublonnées', () => {
  const xml = buildUrlset([
    {
      loc: `${SITE}/produit/etb-flammes`,
      lastModified: new Date('2026-09-10T00:00:00Z'),
      images: [
        `${SITE}/media/a.webp`,
        `${SITE}/media/a.webp`,
        'https://blob.example/b.webp?x=1&y=2',
      ],
    },
    { loc: `${SITE}/produit/sans-image`, images: [] },
  ]);
  assert.match(
    xml,
    / xmlns:image="http:\/\/www\.google\.com\/schemas\/sitemap-image\/1\.1"/,
  );
  assert.equal(xml.match(/<image:image>/g)?.length, 2);
  assert.match(
    xml,
    /<image:loc>https:\/\/blob\.example\/b\.webp\?x=1&amp;y=2<\/image:loc>/,
  );
  const parsed = parseSitemap(xml);
  assert.deepEqual(
    parsed.entries.map((entry) => entry.loc),
    [`${SITE}/produit/etb-flammes`, `${SITE}/produit/sans-image`],
  );
});

test('urlset vide : document valide sans entrée', () => {
  const xml = buildUrlset([]);
  assert.match(xml, /<urlset [^>]+>\n<\/urlset>\n$/);
  assert.deepEqual(parseSitemap(xml), { kind: 'urlset', entries: [] });
});

test('index : sitemaps enfants, lastmod facultatif', () => {
  const xml = buildSitemapIndex([
    {
      loc: `${SITE}/sitemaps/pages.xml`,
      lastModified: new Date('2026-09-20T00:00:00Z'),
    },
    { loc: `${SITE}/sitemaps/products-1.xml`, lastModified: null },
  ]);
  const parsed = parseSitemap(xml);
  assert.equal(parsed.kind, 'index');
  assert.deepEqual(parsed.entries, [
    { loc: `${SITE}/sitemaps/pages.xml`, lastmod: '2026-09-20T00:00:00Z' },
    { loc: `${SITE}/sitemaps/products-1.xml`, lastmod: null },
  ]);
});

test('noms : fichiers connus, tranches produits numérotées dès 1', () => {
  assert.deepEqual(parseSitemapName('pages.xml'), { kind: 'pages' });
  assert.deepEqual(parseSitemapName('landings.xml'), { kind: 'landings' });
  assert.deepEqual(parseSitemapName('content.xml'), { kind: 'content' });
  assert.deepEqual(parseSitemapName('products-1.xml'), {
    kind: 'products',
    page: 1,
  });
  assert.deepEqual(parseSitemapName('products-12.xml'), {
    kind: 'products',
    page: 12,
  });
  for (const name of [
    'products-0.xml',
    'products-01.xml',
    'products-1',
    'products-.xml',
    'products-1.xml.gz',
    'Pages.xml',
    'toString',
    'constructor',
    '__proto__',
    '../pages.xml',
    '',
  ])
    assert.equal(parseSitemapName(name), null, name);
  for (const name of [
    'pages.xml',
    'landings.xml',
    'content.xml',
    'products-3.xml',
  ]) {
    const parsed = parseSitemapName(name);
    assert.ok(parsed);
    assert.equal(sitemapPath(parsed), `/sitemaps/${name}`);
  }
});

test('découpage : 10 000 produits par fichier, tranches contiguës', () => {
  assert.equal(PRODUCTS_PER_SITEMAP, 10_000);
  assert.equal(productSitemapCount(0), 0);
  assert.equal(productSitemapCount(-3), 0);
  assert.equal(productSitemapCount(Number.NaN), 0);
  assert.equal(productSitemapCount(1), 1);
  assert.equal(productSitemapCount(10_000), 1);
  assert.equal(productSitemapCount(10_001), 2);
  assert.equal(productSitemapCount(50_000), 5);
  assert.deepEqual(productSitemapRange(1), { skip: 0, take: 10_000 });
  assert.deepEqual(productSitemapRange(3), { skip: 20_000, take: 10_000 });
  assert.throws(() => productSitemapRange(0), RangeError);
  assert.throws(() => productSitemapRange(1.5), RangeError);

  // Every product lands in exactly one file, in order.
  const products = Array.from({ length: 25 }, (_, index) => index);
  const size = 10;
  const files = Array.from(
    { length: productSitemapCount(products.length, size) },
    (_, index) => {
      const { skip, take } = productSitemapRange(index + 1, size);
      return products.slice(skip, skip + take);
    },
  );
  assert.deepEqual(
    files.map((file) => file.length),
    [10, 10, 5],
  );
  assert.deepEqual(files.flat(), products);
});

test('réponses HTTP : XML mis en cache par le CDN, 404 texte', async () => {
  const response = xmlResponse('<urlset/>');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/xml');
  assert.equal(response.headers.get('cache-control'), SITEMAP_CACHE_CONTROL);
  assert.equal(
    SITEMAP_CACHE_CONTROL,
    'public, s-maxage=3600, stale-while-revalidate=86400',
  );
  assert.equal(await response.text(), '<urlset/>');
  const missing = sitemapNotFound();
  assert.equal(missing.status, 404);
  assert.equal(missing.headers.get('cache-control'), null);
});
