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
/** The shop's aisles row of a page, and whether `path` is its current aisle. */
function aisleRow(html: string) {
  const start = html.indexOf('aria-label="Rayons de la boutique"');
  assert.ok(start >= 0, 'rayons');
  return html.slice(start, html.indexOf('</nav>', start));
}
const isCurrentAisle = (row: string, path: string) =>
  [...row.matchAll(/<a\b[^>]*>/g)].some(
    ([tag]) =>
      tag.includes(`href="${path}"`) && tag.includes('aria-current="page"'),
  );
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
  // The real figures, in the search snippet: the hero itself has none.
  const description =
    /<meta name="description" content="([^"]*)"/.exec(catalogue)?.[1] ?? '';
  assert.match(description, /\d+ produits de [\d,]+\s€ à [\d,]+\s€/);
  for (const href of ['/nouveautes', '/precommandes', '/en-stock', '/pokemon'])
    assert.ok(catalogue.includes(`href="${href}"`), href);
  assert.ok(strip(catalogue).includes('Produits scellés (14)'));

  const preorders = (await page('/precommandes')).html;
  // Every preorder is a Pokémon one: the game's page defers to the listing.
  assert.ok(!preorders.includes('href="/pokemon/precommandes"'));
  assert.equal(
    canonical((await page('/pokemon/precommandes')).html),
    '/precommandes',
  );
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
  // The figures: in the bar and the search snippet, not told in prose.
  assert.match(strip(stock), /\d+ produits/);
  assert.match(stock, /<meta name="description" content="[^"]*\d+ produits/);
  assert.ok(articles(stock).length > 0);
  assert.ok(
    articles(stock).every(
      (a) => !a.includes('Précommande') && !a.includes('Rupture'),
    ),
  );

  const arrivals = strip((await page('/nouveautes')).html);
  assert.match(arrivals, /\d+ produits/);
  // What « Nouveau » means on this page, said once under the title.
  assert.ok(arrivals.includes('« Nouveau » : signalé comme nouveauté'));
});

test('HTTP : hub de jeu, la boutique d’abord puis l’exploration', async () => {
  const { html } = await page('/pokemon');
  assert.equal(h1Count(html), 1);
  const text = strip(html);
  // The hero: where, what, the way to the products; no figures in prose.
  assert.ok(
    text.includes(
      'Cartes, boosters, displays et coffrets Pokémon sélectionnés pour jouer, collectionner et ouvrir.',
    ),
  );
  assert.ok(html.includes('href="#catalogue-resultats"'));
  assert.doesNotMatch(text, /produits au catalogue|Disponibilité : \d/);
  const at = (marker: string, from = 0) => {
    const index = html.indexOf(marker, from);
    assert.ok(index >= 0, marker);
    return index;
  };
  // The products come before every secondary block, in this order.
  const blocks = [
    '<article',
    'id="extensions"',
    'id="explorer"',
    'id="guides"',
    'id="questions"',
    'aria-label="Réassorts et nouveautés"',
  ].map((marker) => at(marker));
  assert.deepEqual(
    blocks,
    [...blocks].sort((a, b) => a - b),
  );
  // Three guides at most; the questions open in place.
  const guides = html.slice(at('id="guides"'), at('id="questions"'));
  const guideCount = (guides.match(/<h3[\s>]/g) ?? []).length;
  assert.ok(guideCount >= 1 && guideCount <= 3, String(guideCount));
  assert.ok(guides.includes('href="/guides"'));
  assert.match(
    html.slice(at('id="questions"')),
    /<details\b[^>]*>\s*<summary>/,
  );
  assert.equal(
    jsonLdTypes(html).filter((type) => type === 'FAQPage').length,
    1,
  );
  // The families are the aisles above the products, the shortcuts below
  // lead elsewhere: only indexable pages. Every preorder is a Pokémon one:
  // the shop's listing stands for the game's.
  const aisles = aisleRow(html);
  assert.ok(isCurrentAisle(aisles, '/pokemon'));
  assert.ok(aisles.includes('href="/pokemon/boosters"'));
  const explorer = html.slice(at('id="explorer"'), at('id="guides"'));
  for (const href of [
    '/pokemon/francais',
    '/pokemon/en-stock',
    '/precommandes',
  ])
    assert.ok(explorer.includes(`href="${href}"`), href);
  for (const href of [
    '/pokemon/boosters',
    '/pokemon/japonais',
    '/pokemon/precommandes',
  ])
    assert.ok(!explorer.includes(`href="${href}"`), href);
});

test('HTTP : un seul système de pages catalogue, des rayons reliés', async () => {
  const pages = [
    '/catalogue',
    '/pokemon',
    '/pokemon/scelles',
    '/pokemon/boosters',
    '/pokemon/displays',
    '/pokemon/coffrets',
    '/nouveautes',
    '/precommandes',
    '/en-stock',
    '/categorie/accessoires',
  ];
  for (const path of pages) {
    const { html } = await page(path);
    assert.equal(h1Count(html), 1, path);
    // The same hero, the way to the products, no figures told in prose.
    assert.match(
      html,
      /<section[^>]+data-frame="(backdrop|arch|window)"/,
      path,
    );
    assert.ok(html.includes('href="#catalogue-resultats"'), path);
    assert.doesNotMatch(
      strip(html),
      /produits au catalogue|Disponibilité : \d|Langues? : /,
      path,
    );
    // The products first, every secondary block after them, the newsletter
    // last.
    const products = html.indexOf('<article');
    const newsletter = html.indexOf('aria-label="Réassorts et nouveautés"');
    assert.ok(products > 0 && newsletter > products, path);
    for (const id of ['id="explorer"', 'id="guides"', 'id="questions"']) {
      const index = html.indexOf(id);
      if (index >= 0)
        assert.ok(index > products && index < newsletter, `${path} ${id}`);
    }
  }
  // Each aisle of the shop is marked in the same row on its own page.
  for (const path of [
    '/pokemon/scelles',
    '/pokemon/boosters',
    '/pokemon/coffrets',
    '/categorie/accessoires',
  ]) {
    const { html } = await page(path);
    const row = aisleRow(html);
    assert.ok(row.includes('href="/pokemon"'), path);
    assert.ok(isCurrentAisle(row, path), path);
  }
  // Boosters: the sets as chips above the products, the drawer's own filter.
  const boosters = (await page('/pokemon/boosters')).html;
  const setRow = (html: string) => {
    const start = html.indexOf('aria-label="Extensions"');
    assert.ok(start >= 0, 'extensions');
    return html.slice(start, html.indexOf('</nav>', start));
  };
  const chips = (html: string) =>
    [...setRow(html).matchAll(/<a\b([^>]*)>([^<]*)/g)].map(
      ([, attrs = '', label = '']) => ({
        label,
        href: /href="([^"]*)"/.exec(attrs)?.[1]?.replaceAll('&amp;', '&'),
        current: attrs.includes('aria-current'),
      }),
    );
  const all = chips(boosters);
  assert.deepEqual(all[0], {
    label: 'Toutes les extensions',
    href: '/pokemon/boosters',
    current: true,
  });
  const vallees = '/pokemon/boosters?set=dev-vallees-oubliees';
  assert.ok(all.some((chip) => chip.href === vallees && !chip.current));
  // Above the bar and the products, under the aisles.
  const at = (marker: string) => boosters.indexOf(marker);
  assert.ok(
    at('aria-label="Rayons de la boutique"') < at('aria-label="Extensions"') &&
      at('aria-label="Extensions"') < at('role="status"') &&
      at('role="status"') < at('<article'),
  );
  const one = (await page(vallees)).html;
  assert.ok(chips(one).some((chip) => chip.href === vallees && chip.current));
  assert.ok(!chips(one)[0]?.current);
  assert.ok(one.includes('Retirer le filtre [Démo] Vallées Oubliées'));
  assert.equal(articles(one).length, 3);

  // The sealed products lead to a real guide, by its own title.
  const sealed = (await page('/pokemon/scelles')).html;
  assert.ok(sealed.includes('href="/guides/etb-display-ou-booster"'));
  assert.ok(strip(sealed).includes('Lire le guide'));
  // /extensions: the same entrance, each set once, on the shared card.
  const extensions = (await page('/extensions')).html;
  assert.equal(h1Count(extensions), 1);
  assert.match(extensions, /<section[^>]+data-frame="backdrop"/);
  // The announced set shows once, under « À venir », not again below.
  assert.equal(
    (extensions.match(/<h3[^>]*>[^<]*Sentiers d’Opale/g) ?? []).length,
    1,
  );
  for (const href of ['href="#a-venir"', 'href="#pokemon"'])
    assert.ok(extensions.includes(href), href);
  assert.ok(strip(extensions).includes('Découvrir l’extension'));
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
