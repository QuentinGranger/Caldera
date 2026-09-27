import assert from 'node:assert/strict';
import { test } from 'node:test';
const base = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
const strip = (html: string) =>
  html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/gu, ' ');
async function page(path: string, status = 200) {
  const response = await fetch(`${base}${path}`, { redirect: 'manual' });
  assert.equal(response.status, status, path);
  const html = await response.text();
  assert.ok(!html.includes('costPrice'));
  return { html, url: response.url };
}
/** 308 to `target` (path and query), without following it. */
async function redirects(path: string, target: string) {
  const response = await fetch(`${base}${path}`, { redirect: 'manual' });
  assert.equal(response.status, 308, path);
  const location = new URL(response.headers.get('location') ?? '', base);
  assert.equal(`${location.pathname}${location.search}`, target, path);
}
const h1Count = (html: string) => (html.match(/<h1[\s>]/g) ?? []).length;
const articles = (html: string) =>
  [...html.matchAll(/<article\b[^>]*>[\s\S]*?<\/article>/g)].map(([a]) => a);
const noindex = (html: string) =>
  /<meta name="robots" content="noindex, follow"/.test(html);
/** Canonical path and query, &amp; decoded. */
function canonical(html: string) {
  const href = /<link rel="canonical" href="([^"]+)"/.exec(html)?.[1];
  assert.ok(href, 'canonical');
  const url = new URL(href.replaceAll('&amp;', '&'));
  return `${url.pathname}${url.search}`;
}
function jsonLdTypes(html: string) {
  return [
    ...html.matchAll(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
    ),
  ].flatMap(([, json]) => {
    // Nested nodes count too: the ItemList is the CollectionPage mainEntity.
    const types: string[] = [];
    const visit = (value: unknown) => {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') {
        const type = (value as { '@type'?: unknown })['@type'];
        if (typeof type === 'string') types.push(type);
        Object.values(value).forEach(visit);
      }
    };
    visit(JSON.parse(json ?? '{}'));
    return types;
  });
}

test('HTTP : routes, hiérarchie, extensions et 404', async () => {
  for (const path of [
    '/catalogue',
    '/categorie/scelles',
    '/categorie/etb?language=FR&sort=price-asc',
    '/extensions',
    '/nouveautes',
    '/precommandes',
    '/en-stock',
  ])
    assert.equal(h1Count((await page(path)).html), 1, path);
  for (const path of ['/categorie/inexistante', '/extensions/inexistante'])
    await page(path, 404);
  // An extension lives under its game; the old URL is a permanent redirect.
  await redirects(
    '/extensions/dev-terres-de-braise',
    '/pokemon/dev-terres-de-braise',
  );
  assert.ok(
    (await page('/extensions')).html.includes(
      'href="/pokemon/dev-terres-de-braise"',
    ),
  );
});

test('HTTP : filtre FR cohérent, cases synchronisées, URL nettoyée et SEO', async () => {
  const { html } = await page('/catalogue?category=etb&language=FR');
  assert.ok(strip(html).includes('59,90 €'));
  assert.ok(!strip(html).includes('54,90 €'));
  assert.match(html, /type="checkbox"[^>]*checked=""/);
  // Refinement: noindex, follow with its own URL as canonical.
  assert.ok(noindex(html));
  assert.equal(canonical(html), '/catalogue?category=etb&language=FR');
  assert.ok(html.includes('Retirer le filtre Français'));
  assert.ok(html.includes('Tout effacer'));
  assert.ok(strip(html).includes('1 produit correspond à ces critères.'));
  const plain = (await page('/catalogue')).html;
  assert.ok(!noindex(plain));
  assert.equal(canonical(plain), '/catalogue');

  // Invalid values, unknown slugs and page 1: 308 to the canonical query.
  await redirects(
    '/catalogue?page=bonjour&language=INVALID&type=INVALID&sort=inconnu&search=',
    '/catalogue',
  );
  await redirects('/catalogue?category=inconnue', '/catalogue');
  await redirects(
    '/catalogue?category=etb,inconnue',
    '/catalogue?category=etb',
  );
  await redirects('/catalogue?page=1', '/catalogue');
  await redirects(
    '/catalogue?minPrice=80&maxPrice=20',
    '/catalogue?minPrice=20.00&maxPrice=80.00',
  );
  await redirects(
    '/catalogue?language=FR&category=etb&utm_source=lettre&sort=inconnu',
    '/catalogue?category=etb&language=FR&utm_source=lettre',
  );

  // Tracking parameters: same page, 200, canonical without them.
  for (const path of [
    '/catalogue?utm_source=lettre&utm_medium=email&utm_campaign=rentree',
    '/catalogue?gclid=abc&fbclid=def&msclkid=ghi&_gl=1',
    '/nouveautes?utm_source=lettre',
  ]) {
    const tracked = (await page(path)).html;
    assert.ok(!noindex(tracked), path);
    assert.equal(canonical(tracked), path.split('?')[0], path);
  }
});

test('HTTP : pagination crawlable, indexable et bornée', async () => {
  const first = await page('/catalogue?language=FR&sort=price-asc');
  assert.equal(articles(first.html).length, 12);
  assert.ok(
    first.html.includes(
      'language=FR&amp;sort=price-asc&amp;page=2#catalogue-resultats',
    ),
  );
  const second = await page('/catalogue?language=FR&sort=price-asc&page=2');
  assert.ok(articles(second.html).length > 0);
  assert.ok(noindex(second.html));

  const catalogue = await page('/catalogue');
  assert.match(
    catalogue.html,
    /<a[^>]+href="\/catalogue\?page=2#catalogue-resultats"/,
  );
  const paged = await page('/catalogue?page=2');
  assert.ok(!noindex(paged.html));
  assert.equal(canonical(paged.html), '/catalogue?page=2');
  assert.match(paged.html, /<title>[^<]*– page 2[^<]*<\/title>/);
  assert.match(paged.html, /"position":13\b/);
  await redirects('/catalogue?page=9999', '/catalogue?page=2');
});

test('HTTP : hubs transverses indexables, chiffres réels et maillage', async () => {
  for (const path of [
    '/catalogue',
    '/nouveautes',
    '/precommandes',
    '/en-stock',
  ]) {
    const { html } = await page(path);
    assert.equal(h1Count(html), 1, path);
    assert.ok(!noindex(html), path);
    assert.equal(canonical(html), path);
    const title = /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? '';
    assert.match(title, / \| Caldera$/, path);
    assert.doesNotMatch(title, /Les Terres de Caldera/, path);
    const types = jsonLdTypes(html);
    for (const type of ['CollectionPage', 'ItemList', 'BreadcrumbList'])
      assert.ok(types.includes(type), `${path} ${type}`);
    assert.ok(!/Découvrez|large sélection/.test(strip(html)), path);
  }

  const catalogue = (await page('/catalogue')).html;
  assert.match(strip(catalogue), /\d+ produits au catalogue, de [\d,]+ € à/);
  for (const href of ['/nouveautes', '/precommandes', '/en-stock', '/pokemon'])
    assert.ok(catalogue.includes(`href="${href}"`), href);
  assert.ok(strip(catalogue).includes('Produits scellés (17)'));

  const preorders = (await page('/precommandes')).html;
  assert.ok(preorders.includes('href="/pokemon/precommandes"'));
  assert.ok(preorders.includes('href="/catalogue"'));
  // Every preorder is shown as such, or as sold out once its quota is used up.
  assert.ok(articles(preorders).some((a) => a.includes('Précommande')));
  assert.ok(
    articles(preorders).every(
      (a) => a.includes('Précommande') || a.includes('Rupture'),
    ),
  );
  // The stock filter cannot narrow a preorder listing: it is not offered.
  assert.doesNotMatch(preorders, /<summary>Disponibilité/);

  const stock = (await page('/en-stock')).html;
  assert.match(strip(stock), /\d+ produits en stock/);
  assert.ok(articles(stock).length > 0);
  assert.ok(
    articles(stock).every(
      (a) => !a.includes('Précommande') && !a.includes('Rupture'),
    ),
  );

  assert.match(strip((await page('/nouveautes')).html), /\d+ nouveautés?/);
});

test('HTTP : aucun résultat et filtres mobile / recherche accessibles', async () => {
  const empty = await page('/catalogue?search=introuvable-caldera');
  assert.ok(
    strip(empty.html).includes('Aucun résultat pour « introuvable-caldera »'),
  );
  assert.ok(empty.html.includes('Réinitialiser la recherche'));
  assert.ok(noindex(empty.html));
  const { html } = await page('/catalogue');
  assert.ok(html.includes('aria-haspopup="dialog"'));
  assert.ok(html.includes('Fermer les filtres'));
  assert.ok(html.includes('Rechercher dans ce catalogue'));
  assert.match(html, /<fieldset\b/);
});
