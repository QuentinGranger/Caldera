import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  auditCatalog,
  faqProblem,
  findSlugCollisions,
  type AuditCategory,
  type AuditGame,
  type AuditProduct,
  type AuditSet,
  type CatalogSnapshot,
} from '../src/lib/seo/audit/catalog';
import { parseAuditArgs } from '../src/lib/seo/audit/cli';
import {
  crawlSite,
  interleaveBySitemap,
  mapWithConcurrency,
  type FetchLike,
} from '../src/lib/seo/audit/crawl';
import {
  decodeEntities,
  extractPageFacts,
  isNoindex,
  robotsDirectives,
  tokenizeHtml,
} from '../src/lib/seo/audit/html';
import {
  auditPage,
  findDuplicates,
  findOrphans,
  findSortSearchLinks,
  internalLinks,
  listUrls,
  recordLinks,
  referrersDetail,
  stripTitleSuffix,
  textLength,
  summarizePage,
  urlKey,
  type AnalyzedPage,
  type FetchedPage,
  type LinkIndex,
} from '../src/lib/seo/audit/pages';
import {
  exitCodeOf,
  formatReport,
  summarize,
  toJsonReport,
} from '../src/lib/seo/audit/report';
import { parseSitemap } from '../src/lib/seo/audit/sitemap';
import { checkStructuredData } from '../src/lib/seo/audit/structured-data';
import type {
  AuditIssue,
  AuditReport,
  AuditRuleCode,
} from '../src/lib/seo/audit/types';

const SITE = 'https://lesterresdecaldera.fr';
const LOCAL = 'http://localhost:3000';

const codes = (issues: readonly AuditIssue[]) =>
  issues.map((issue) => issue.code).sort();
const codesOf = (issues: readonly AuditIssue[], subject: string) =>
  codes(issues.filter((issue) => issue.subject === subject));

// ---------------------------------------------------------------------------
// HTML fixtures shaped like the Next.js output

interface PageFixture {
  path: string;
  title?: string | null;
  description?: string | null;
  canonical?: string | null;
  robots?: string;
  h1?: string[];
  jsonLd?: string[];
  links?: string[];
}

const productGraph = JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Product',
      name: 'ETB Flammes Obsidiennes',
      offers: {
        '@type': 'Offer',
        price: '54.90',
        priceCurrency: 'EUR',
        availability: 'https://schema.org/InStock',
      },
    },
  ],
}).replace(/</g, '\\u003c');

function html({
  path,
  title = `Page ${path} – prix et stock`,
  description = `Description de ${path}.`,
  canonical = `${SITE}${path}`,
  robots = 'index, follow',
  h1 = [`Titre ${path}`],
  jsonLd = [],
  links = [],
}: PageFixture): string {
  return `<!DOCTYPE html><html lang="fr"><head><meta charSet="utf-8"/>
${title === null ? '' : `<title>${title} | Caldera</title>`}
${description === null ? '' : `<meta name="description" content="${description}"/>`}
<meta name="robots" content="${robots}"/>
${canonical === null ? '' : `<link rel="canonical" href="${canonical}"/>`}
<script>self.__next_f.push([1,"<a href=\\"/jamais\\">"])</script>
</head><body><a class="skip-link" href="#contenu">Aller au contenu</a>
<header><a href="/"><svg viewBox="0 0 10 10"><title>Logo</title></svg>Accueil</a></header>
<main id="contenu">${h1.map((text) => `<h1 class="t">${text}</h1>`).join('')}
<!-- <h1>commentaire</h1> <a href="/commentaire">x</a> -->
${links.map((href) => `<a href="${href}">Lien</a>`).join('\n')}
${jsonLd.map((json) => `<script type="application/ld+json">${json}</script>`).join('')}
</main></body></html>`;
}

function fetched(
  fixture: PageFixture,
  overrides: Partial<FetchedPage> = {},
): FetchedPage {
  return {
    loc: `${SITE}${fixture.path}`,
    url: `${LOCAL}${fixture.path}`,
    status: 200,
    contentType: 'text/html; charset=utf-8',
    xRobotsTag: null,
    body: html(fixture),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tokenizer and extraction

test('tokenizer : attributs entre guillemets, sans guillemets, booléens et entités', () => {
  const [token] = tokenizeHtml(
    `<a href='/a?x=1&amp;y=2' data-label="a > b" hidden rel=nofollow title="L&rsquo;&#233;t&#xE9;">`,
  );
  assert.equal(token?.type, 'start');
  if (token?.type !== 'start') return;
  assert.deepEqual(token.attrs, {
    href: '/a?x=1&y=2',
    'data-label': 'a > b',
    hidden: '',
    rel: 'nofollow',
    title: 'L’été',
  });
  assert.equal(
    decodeEntities('&lt;b&gt; &amp;amp; &unknown; &#0;'),
    '<b> &amp; &unknown; \ufffd',
  );
});

test('tokenizer : commentaires, scripts, SVG et balises mal formées', () => {
  const tokens = tokenizeHtml(
    '<p>a < b</p><!-- <h1>x</h1> --><script>if (a<b) "</div>"</script><svg><title>Icône</title><path d="M0"/></svg><title>Vrai</title>',
  );
  const starts = tokens.filter((token) => token.type === 'start');
  assert.deepEqual(
    starts.map((token) => [token.name, token.foreign]),
    [
      ['p', false],
      ['script', false],
      ['svg', true],
      ['title', true],
      ['path', true],
      ['title', false],
    ],
  );
  assert.deepEqual(tokens[1], { type: 'text', text: 'a < b' });
  const script = starts.find((token) => token.name === 'script');
  assert.equal(script?.content, 'if (a<b) "</div>"');
});

test('extraction : title, description, canonical, robots, h1, JSON-LD et liens', () => {
  const facts = extractPageFacts(
    html({
      path: '/pokemon',
      title: 'Pokémon : boosters &amp; ETB en stock',
      description: 'Pokémon : 12 produits de 5,90&nbsp;€ à 54,90&nbsp;€.',
      h1: ['<span>Pokémon</span> <img src="/l.png" alt="logo"/>'],
      jsonLd: [productGraph],
      links: ['/pokemon/etb', `${SITE}/produit/etb`, 'mailto:a@b.fr'],
    }),
  );
  assert.deepEqual(facts.titles, [
    'Pokémon : boosters & ETB en stock | Caldera',
  ]);
  assert.deepEqual(facts.descriptions, [
    'Pokémon : 12 produits de 5,90 € à 54,90 €.',
  ]);
  assert.deepEqual(facts.canonicals, [`${SITE}/pokemon`]);
  assert.deepEqual(facts.robots, ['index, follow']);
  assert.deepEqual(facts.h1, ['Pokémon logo']);
  assert.equal(facts.jsonLd.length, 1);
  assert.deepEqual(facts.links, [
    '#contenu',
    '/',
    '/pokemon/etb',
    `${SITE}/produit/etb`,
    'mailto:a@b.fr',
  ]);
  const multiple = extractPageFacts(
    '<h1>A</h1><div><h1>B <em>c</em></h1></div><link rel="alternate canonical" href="/x">',
  );
  assert.deepEqual(multiple.h1, ['A', 'B c']);
  assert.deepEqual(multiple.canonicals, ['/x']);
  assert.deepEqual(extractPageFacts('<main><p>Sans titre</p></main>').h1, []);
});

test('robots : directives, préfixe de robot et valeurs', () => {
  assert.ok(isNoindex(robotsDirectives(['noindex, follow'])));
  assert.ok(isNoindex(robotsDirectives(['index', 'googlebot: noindex'])));
  assert.ok(isNoindex(robotsDirectives(['NONE'])));
  assert.ok(
    !isNoindex(
      robotsDirectives([
        'index, follow, max-image-preview:none, max-snippet:-1',
      ]),
    ),
  );
  assert.ok(!isNoindex(robotsDirectives([])));
});

// ---------------------------------------------------------------------------
// Structured data and sitemaps

test('JSON-LD : blocs illisibles, @context manquant et offres de Product', () => {
  assert.deepEqual(checkStructuredData([productGraph]).problems, []);
  assert.equal(checkStructuredData([productGraph]).productCount, 1);
  const result = checkStructuredData([
    '{"@context":"https://schema.org",',
    '{"@type":"Organization","name":"Caldera"}',
    JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'Product', name: 'Sans offre' },
        {
          '@type': ['Product'],
          name: 'Deux offres',
          offers: [
            { '@type': 'Offer', price: 12.5, availability: 'InStock' },
            { '@type': 'Offer', price: '12,50' },
          ],
        },
        {
          '@type': 'Product',
          offers: { '@type': 'AggregateOffer', lowPrice: '9.90' },
        },
      ],
    }),
  ]);
  assert.deepEqual(
    result.problems.map((problem) => problem.kind),
    ['invalid', 'no-context', 'product-offer', 'product-offer'],
  );
  assert.match(result.problems[2]?.detail ?? '', /Sans offre.*offers absent/);
  assert.match(
    result.problems[3]?.detail ?? '',
    /offre 2 : price absent ou invalide, offre 2 : availability absente/,
  );
  assert.equal(
    checkStructuredData(['[{"@context":"https://schema.org","@type":"Thing"}]'])
      .problems.length,
    0,
  );
  assert.equal(checkStructuredData(['"texte"']).problems[0]?.kind, 'invalid');
});

test('sitemaps : index, urlset, CDATA, entités et extension image ignorée', () => {
  const index = parseSitemap(`<?xml version="1.0" encoding="UTF-8"?>
<!-- <urlset> -->
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${SITE}/sitemaps/pages.xml</loc><lastmod>2026-09-01</lastmod></sitemap>
  <sitemap>
    <loc><![CDATA[${SITE}/sitemaps/products-0.xml]]></loc>
  </sitemap>
</sitemapindex>`);
  assert.equal(index.kind, 'index');
  assert.deepEqual(index.entries, [
    { loc: `${SITE}/sitemaps/pages.xml`, lastmod: '2026-09-01' },
    { loc: `${SITE}/sitemaps/products-0.xml`, lastmod: null },
  ]);
  const urlset =
    parseSitemap(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
<url><loc>${SITE}/catalogue?page=2&amp;x=1</loc><image:image><image:loc>${SITE}/a.png</image:loc></image:image></url>
<url><loc> ${SITE}/pok%C3%A9mon </loc></url>
</urlset>`);
  assert.equal(urlset.kind, 'urlset');
  assert.deepEqual(
    urlset.entries.map((entry) => entry.loc),
    [`${SITE}/catalogue?page=2&x=1`, `${SITE}/pok%C3%A9mon`],
  );
  assert.equal(parseSitemap('<html></html>').kind, 'unknown');
});

// ---------------------------------------------------------------------------
// Page rules

test('règles de page : page conforme sans constat', () => {
  const audit = auditPage(
    fetched({ path: '/produit/etb', jsonLd: [productGraph] }),
  );
  assert.deepEqual(audit.issues, []);
  assert.equal(audit.page?.key, '/produit/etb');
  assert.equal(audit.page?.productCount, 1);
});

test('règles de page : longueurs, suffixe du title et longueurs en caractères', () => {
  assert.equal(
    stripTitleSuffix('Boosters Pokémon | Caldera'),
    'Boosters Pokémon',
  );
  assert.equal(
    stripTitleSuffix('Les Terres de Caldera'),
    'Les Terres de Caldera',
  );
  assert.equal(textLength('Pokémon 🃏'), 9);
  const short = auditPage(fetched({ path: '/a', title: 'Court' }));
  assert.deepEqual(codes(short.issues), ['title-length']);
  assert.match(short.issues[0]?.detail ?? '', /^5 caractères/);
  const exact = auditPage(fetched({ path: '/b', title: 'x'.repeat(65) }));
  assert.deepEqual(exact.issues, []);
  const long = auditPage(
    fetched({
      path: '/c',
      title: 'x'.repeat(66),
      description: 'd'.repeat(171),
    }),
  );
  assert.deepEqual(codes(long.issues), [
    'description-too-long',
    'title-length',
  ]);
});

test('règles de page : éléments manquants, doublons de balises et noindex', () => {
  const empty = auditPage(
    fetched({
      path: '/vide',
      title: null,
      description: null,
      canonical: null,
      h1: [],
    }),
  );
  assert.deepEqual(codes(empty.issues), [
    'canonical-missing',
    'description-missing',
    'h1-missing',
    'title-missing',
  ]);
  const noisy = auditPage(
    fetched({
      path: '/bruit',
      canonical: '/bruit',
      robots: 'noindex, follow',
      h1: ['Un', 'Deux'],
      jsonLd: ['{"@type":"Thing"}', '{oops}'],
    }),
  );
  assert.deepEqual(codes(noisy.issues), [
    'canonical-relative',
    'h1-multiple',
    'jsonld-invalid',
    'jsonld-no-context',
    'noindex-in-sitemap',
  ]);
  const header = auditPage(
    fetched({ path: '/entete' }, { xRobotsTag: 'noindex' }),
  );
  assert.deepEqual(codes(header.issues), ['noindex-in-sitemap']);
});

test('règles de page : canonical vers soi, doublon déclaré, autre origine', () => {
  const encoded = auditPage(
    fetched(
      { path: '/pok%C3%A9mon/', canonical: `${SITE}/pokémon` },
      { loc: `${SITE}/pok%C3%A9mon/` },
    ),
  );
  assert.deepEqual(encoded.issues, []);
  const duplicate = auditPage(
    fetched({ path: '/pokemon/francais', canonical: `${SITE}/pokemon` }),
  );
  assert.deepEqual(codes(duplicate.issues), ['canonical-not-self']);
  const origin = auditPage(
    fetched({ path: '/x', canonical: 'https://preview.vercel.app/x' }),
  );
  assert.deepEqual(codes(origin.issues), ['canonical-not-self']);
});

test('règles de page : statut, redirection et type de contenu', () => {
  assert.deepEqual(auditPage(fetched({ path: '/a' }, { status: 404 })).issues, [
    { code: 'page-status', subject: '/a', detail: '404' },
  ]);
  assert.equal(
    auditPage(fetched({ path: '/b' }, { status: 308, location: '/pokemon/b' }))
      .issues[0]?.detail,
    '308 → /pokemon/b',
  );
  assert.equal(
    auditPage(
      fetched({ path: '/c' }, { status: null, error: 'connexion refusée' }),
    ).issues[0]?.detail,
    'connexion refusée',
  );
  assert.deepEqual(
    codes(
      auditPage(fetched({ path: '/d' }, { contentType: 'application/json' }))
        .issues,
    ),
    ['page-not-html'],
  );
});

// ---------------------------------------------------------------------------
// Across pages

function analyzed(fixture: PageFixture): AnalyzedPage {
  const page = auditPage(fetched(fixture)).page;
  assert.ok(page);
  return page;
}

test('clés d’URL : encodage, slash final, requête triée, fragment ignoré', () => {
  assert.equal(urlKey(new URL(`${SITE}/pok%C3%A9mon/`)), '/pokémon');
  assert.equal(urlKey(new URL(`${LOCAL}/pokémon#top`)), '/pokémon');
  assert.equal(urlKey(new URL(`${SITE}/`)), '/');
  assert.equal(
    urlKey(new URL(`${SITE}/catalogue?sort=price&page=2`)),
    '/catalogue?page=2&sort=price',
  );
});

test('doublons de title et de description, casse et espaces ignorés', () => {
  const pages = [
    analyzed({ path: '/a', title: 'Boosters Pokémon', description: 'Même' }),
    analyzed({ path: '/b', title: 'boosters  pokémon', description: 'Autre' }),
    analyzed({
      path: '/c',
      title: 'ETB Pokémon en stock',
      description: 'même',
    }),
  ].map(summarizePage);
  assert.deepEqual(pages[0], {
    loc: `${SITE}/a`,
    title: 'Boosters Pokémon | Caldera',
    description: 'Même',
  });
  const titles = findDuplicates(pages, 'title');
  assert.deepEqual(codes(titles), ['title-duplicate']);
  assert.match(titles[0]?.detail ?? '', /^2 pages : .*\/a, .*\/b$/);
  assert.deepEqual(codes(findDuplicates(pages, 'description')), [
    'description-duplicate',
  ]);
});

test('liens internes, graphe, orphelins et paramètres de tri/recherche', () => {
  const home = analyzed({
    path: '/',
    links: [
      '/pokemon',
      `${SITE}/pokemon/etb`,
      'https://ailleurs.fr/x',
      'tel:+33100000000',
      '/catalogue?sort=price-asc',
      '/catalogue?search=dracaufeu#r',
      '/',
    ],
  });
  const hub = analyzed({ path: '/pokemon', links: ['../', 'etb?page=2'] });
  const options = { crawlOrigin: LOCAL, siteOrigins: new Set([SITE]) };
  const homeLinks = internalLinks(home, options);
  assert.deepEqual(
    homeLinks.map((link) => link.key),
    [
      '/',
      '/pokemon',
      '/pokemon/etb',
      '/catalogue?sort=price-asc',
      '/catalogue?search=dracaufeu',
      '/',
    ],
  );
  assert.equal(homeLinks[2]?.url, `${LOCAL}/pokemon/etb`);
  const hubLinks = internalLinks(hub, options);
  assert.deepEqual(
    hubLinks.map((link) => link.key),
    ['/', '/', '/etb?page=2'],
  );

  const index: LinkIndex = new Map();
  recordLinks(index, home.key, homeLinks);
  recordLinks(index, hub.key, hubLinks);
  // Self links and repeats on one page are not counted.
  assert.deepEqual(
    [...index.values()].map((target) => [
      target.link.key,
      target.referrerCount,
      target.referrers,
    ]),
    [
      ['/pokemon', 1, ['/']],
      ['/pokemon/etb', 1, ['/']],
      ['/catalogue?sort=price-asc', 1, ['/']],
      ['/catalogue?search=dracaufeu', 1, ['/']],
      ['/', 1, ['/pokemon']],
      ['/etb?page=2', 1, ['/pokemon']],
    ],
  );
  for (const source of ['/a', '/b', '/c', '/d'])
    recordLinks(index, source, homeLinks);
  const pokemon = index.get('/pokemon');
  assert.ok(pokemon);
  assert.equal(pokemon.referrerCount, 5);
  assert.equal(referrersDetail(pokemon), 'depuis /, /a, /b et 2 autres');
  assert.equal(listUrls(['/x', '/y'], 5), '/x, /y');
  const sitemap = [
    `${SITE}/`,
    `${SITE}/pokemon`,
    `${SITE}/pokemon/etb`,
    `${SITE}/pokemon/boosters`,
  ];
  assert.deepEqual(findOrphans(sitemap, index, false), [
    { code: 'orphan-page', subject: '/pokemon/boosters' },
  ]);
  assert.deepEqual(codes(findOrphans(sitemap, index, true)), [
    'orphan-page-partial',
  ]);
  const sortSearch = findSortSearchLinks(index);
  assert.deepEqual(
    sortSearch.map((issue) => issue.subject),
    ['/catalogue?search=dracaufeu', '/catalogue?sort=price-asc'],
  );
  assert.equal(sortSearch[0]?.detail, 'depuis /, /a, /b et 2 autres');
});

// ---------------------------------------------------------------------------
// Crawl on fixtures

type Route =
  | { status: number; body?: string; type?: string; location?: string }
  | ((init: RequestInit) => Response);

function fakeServer(routes: Record<string, Route>) {
  const requested: string[] = [];
  const fetchImpl: FetchLike = async (input, init) => {
    const url = new URL(input);
    assert.equal(url.origin, LOCAL, 'le crawl reste sur l’origine crawlée');
    assert.equal(init.redirect, 'manual');
    requested.push(url.pathname + url.search);
    const route = routes[url.pathname + url.search];
    if (typeof route === 'function') return route(init);
    if (!route) return new Response('Not found', { status: 404 });
    const headers = new Headers({
      'content-type': route.type ?? 'text/html; charset=utf-8',
    });
    if (route.location) headers.set('location', route.location);
    return new Response(route.body ?? '', { status: route.status, headers });
  };
  return { fetchImpl, requested };
}

const xml = 'application/xml';
const urlset = (paths: string[]) =>
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths
    .map((path) => `<url><loc>${SITE}${path}</loc></url>`)
    .join('')}</urlset>`;

function shopRoutes(): Record<string, Route> {
  const page = (fixture: PageFixture): Route => ({
    status: 200,
    body: html(fixture),
  });
  return {
    '/sitemap.xml': {
      status: 200,
      type: xml,
      body: `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<sitemap><loc>${SITE}/sitemaps/pages.xml</loc></sitemap>
<sitemap><loc>${SITE}/sitemaps/products-0.xml</loc></sitemap>
<sitemap><loc>${SITE}/sitemaps/absent.xml</loc></sitemap>
</sitemapindex>`,
    },
    '/sitemaps/pages.xml': {
      status: 200,
      type: xml,
      body: urlset(['/', '/pokemon', '/pokemon/etb', '/guides']),
    },
    '/sitemaps/products-0.xml': {
      status: 200,
      type: xml,
      body: urlset(['/produit/etb', '/produit/booster', '/pokemon']).replace(
        '</urlset>',
        '<url><loc>https://preview.vercel.app/produit/etb</loc></url></urlset>',
      ),
    },
    '/': page({
      path: '/',
      title: 'Les Terres de Caldera – boutique de cartes',
      links: [
        '/pokemon',
        '/produit/etb',
        '/extensions/ancienne',
        '/cgv',
        '/panier',
        '/catalogue?sort=price-asc',
      ],
    }),
    '/pokemon': page({
      path: '/pokemon',
      links: ['/pokemon/etb', '/produit/booster', '/mort'],
    }),
    '/pokemon/etb': page({
      path: '/pokemon/etb',
      robots: 'noindex, follow',
      links: ['/'],
    }),
    '/guides': page({ path: '/guides', links: ['/'] }),
    '/produit/etb': page({
      path: '/produit/etb',
      jsonLd: [productGraph],
      links: ['/pokemon'],
    }),
    '/produit/booster': { status: 500, body: 'Erreur' },
    '/extensions/ancienne': {
      status: 308,
      location: '/pokemon/ancienne',
    },
    '/cgv': { status: 200, body: '<title>CGV</title>' },
    '/catalogue?sort=price-asc': { status: 200, body: '' },
  };
}

test('crawl : sitemaps, pages, liens cassés, redirections et orphelins', async () => {
  const server = fakeServer(shopRoutes());
  const progress: string[] = [];
  const result = await crawlSite({
    baseUrl: `${LOCAL}/ignoré`,
    fetch: server.fetchImpl,
    onProgress: ({ phase }) => progress.push(phase),
  });
  assert.equal(result.crawlOrigin, LOCAL);
  assert.equal(result.siteOrigin, SITE);
  assert.equal(result.partial, false);
  assert.deepEqual(result.stats, {
    sitemaps: 3,
    sitemapUrls: 6,
    crawledPages: 6,
    analyzedPages: 5,
    productPages: 1,
    internalLinkTargets: 10,
    checkedLinks: 4,
  });
  assert.ok(!server.requested.includes('/panier'));
  assert.deepEqual(new Set(progress), new Set(['sitemaps', 'pages', 'links']));
  const { issues } = result;
  assert.deepEqual(codesOf(issues, '/sitemaps/absent.xml'), [
    'sitemap-unavailable',
  ]);
  assert.deepEqual(codesOf(issues, '/pokemon'), ['sitemap-duplicate-url']);
  assert.deepEqual(codesOf(issues, '/pokemon/etb'), ['noindex-in-sitemap']);
  assert.deepEqual(codesOf(issues, '/produit/booster'), [
    'broken-link',
    'page-status',
  ]);
  assert.deepEqual(codesOf(issues, '/guides'), ['orphan-page']);
  assert.deepEqual(codesOf(issues, 'https://preview.vercel.app/produit/etb'), [
    'sitemap-invalid-url',
  ]);
  const broken = issues.filter((issue) => issue.code === 'broken-link');
  assert.deepEqual(
    broken.map((issue) => [issue.subject, issue.detail]),
    [
      ['/mort', '404 depuis /pokemon'],
      ['/produit/booster', '500 depuis /pokemon'],
    ],
  );
  assert.deepEqual(codesOf(issues, '/extensions/ancienne'), ['link-redirect']);
  assert.deepEqual(codesOf(issues, '/catalogue?sort=price-asc'), [
    'link-sort-search',
  ]);
  assert.ok(!issues.some((issue) => issue.subject === '/cgv'));
});

test('crawl : limite répartie entre les sitemaps et crawl partiel', async () => {
  const server = fakeServer(shopRoutes());
  const result = await crawlSite({
    baseUrl: LOCAL,
    limit: 2,
    linkSample: 0,
    fetch: server.fetchImpl,
  });
  assert.equal(result.partial, true);
  assert.equal(result.stats.crawledPages, 2);
  assert.equal(result.stats.checkedLinks, 0);
  assert.ok(server.requested.includes('/'));
  assert.ok(server.requested.includes('/produit/etb'));
  assert.ok(
    result.issues.some((issue) => issue.code === 'orphan-page-partial'),
  );
  assert.ok(!result.issues.some((issue) => issue.code === 'orphan-page'));
  assert.deepEqual(
    interleaveBySitemap(
      [
        { id: 1, sitemap: 'a' },
        { id: 2, sitemap: 'a' },
        { id: 3, sitemap: 'a' },
        { id: 4, sitemap: 'b' },
      ],
      3,
    ).map((item) => item.id),
    [1, 4, 2],
  );
});

test('crawl : serveur injoignable, sitemap simple et délai dépassé', async () => {
  const down = await crawlSite({
    baseUrl: LOCAL,
    fetch: async () => {
      throw new TypeError('fetch failed', {
        cause: Object.assign(new Error('refused'), { code: 'ECONNREFUSED' }),
      });
    },
  });
  assert.deepEqual(down.issues, [
    {
      code: 'crawl-unavailable',
      subject: LOCAL,
      detail:
        'connexion refusée : démarrez le serveur ou définissez SEO_BASE_URL',
    },
  ]);

  const slow = fakeServer({
    '/sitemap.xml': { status: 200, type: xml, body: urlset(['/lent']) },
    '/lent': (init) => {
      const error = new DOMException('timeout', 'TimeoutError');
      assert.ok(init.signal);
      throw error;
    },
  });
  const result = await crawlSite({
    baseUrl: LOCAL,
    fetch: slow.fetchImpl,
    timeoutMs: 2_000,
  });
  assert.deepEqual(codes(result.issues), [
    'orphan-page',
    'page-status',
    'sitemap-not-index',
  ]);
  assert.equal(
    result.issues.find((issue) => issue.code === 'page-status')?.detail,
    'délai dépassé (2 s)',
  );
});

test('concurrence : au plus N requêtes simultanées, ordre conservé', async () => {
  let active = 0;
  let peak = 0;
  const results = await mapWithConcurrency(
    [5, 1, 4, 2, 3, 0],
    4,
    async (delay) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, delay));
      active--;
      return delay * 10;
    },
  );
  assert.deepEqual(results, [50, 10, 40, 20, 30, 0]);
  assert.equal(peak, 4);
});

// ---------------------------------------------------------------------------
// Database rules

const game = (overrides: Partial<AuditGame> = {}): AuditGame => ({
  id: 'g-pkm',
  slug: 'pokemon',
  name: 'Pokémon',
  isActive: true,
  seoTitle: null,
  seoDescription: null,
  faq: null,
  ...overrides,
});
const tcgSet = (overrides: Partial<AuditSet> = {}): AuditSet => ({
  id: 's-obf',
  slug: 'flammes-obsidiennes',
  name: 'Flammes Obsidiennes',
  isActive: true,
  gameId: 'g-pkm',
  releaseDate: new Date('2026-08-11T00:00:00.000Z'),
  seoTitle: null,
  seoDescription: null,
  faq: null,
  ...overrides,
});
const category = (overrides: Partial<AuditCategory> = {}): AuditCategory => ({
  id: 'c-etb',
  slug: 'etb',
  name: 'ETB',
  isActive: true,
  parentId: 'c-sealed',
  seoTitle: null,
  seoDescription: null,
  faq: null,
  ...overrides,
});
const product = (overrides: Partial<AuditProduct> = {}): AuditProduct => ({
  id: 'p-etb',
  slug: 'etb-obf',
  name: 'ETB Flammes Obsidiennes',
  productType: 'ETB',
  visible: true,
  hasDescription: true,
  gameId: 'g-pkm',
  tcgSetId: 's-obf',
  categoryId: 'c-etb',
  seoTitle: null,
  seoDescription: null,
  images: [{ url: 'https://blob.example/etb.webp', alt: 'ETB' }],
  ...overrides,
});
function snapshot(overrides: Partial<CatalogSnapshot> = {}): CatalogSnapshot {
  return {
    games: [game()],
    sets: [tcgSet()],
    categories: [
      category({
        id: 'c-sealed',
        slug: 'scelles',
        name: 'Scellés',
        parentId: null,
      }),
      category(),
    ],
    products: [product()],
    now: new Date('2026-09-26T00:00:00.000Z'),
    ...overrides,
  };
}

test('base : catalogue sain sans constat, catégorie parente comptée par ses enfants', () => {
  const audit = auditCatalog(snapshot());
  assert.deepEqual(audit.issues, []);
  assert.deepEqual(audit.stats, {
    games: 1,
    activeGames: 1,
    sets: 1,
    activeSets: 1,
    categories: 2,
    activeCategories: 2,
    products: 1,
    visibleProducts: 1,
    images: 1,
  });
});

test('base : produits sans image réelle, description, jeu ou alt ; jeu incohérent', () => {
  const { issues } = auditCatalog(
    snapshot({
      games: [game(), game({ id: 'g-lor', slug: 'lorcana', name: 'Lorcana' })],
      products: [
        product(),
        product({
          id: 'p1',
          slug: 'sans-image',
          hasDescription: false,
          images: [
            { url: '/assets/products/placeholder-sealed.png', alt: 'x' },
            { url: '  ', alt: '' },
          ],
        }),
        product({
          id: 'p2',
          slug: 'sans-jeu',
          gameId: null,
          tcgSetId: null,
          images: [{ url: '/uploads/a.webp', alt: ' ' }],
        }),
        product({
          id: 'p3',
          slug: 'protege-cartes',
          productType: 'ACCESSORY',
          gameId: null,
          tcgSetId: null,
        }),
        product({ id: 'p4', slug: 'mauvais-jeu', gameId: 'g-lor' }),
        product({
          id: 'p5',
          slug: 'brouillon',
          visible: false,
          hasDescription: false,
          images: [],
          gameId: null,
        }),
      ],
    }),
  );
  assert.deepEqual(codesOf(issues, '/produit/sans-image'), [
    'product-no-description',
    'product-no-image',
  ]);
  assert.deepEqual(codesOf(issues, '/produit/sans-jeu'), [
    'image-no-alt',
    'product-no-game',
  ]);
  assert.deepEqual(codesOf(issues, '/produit/protege-cartes'), [
    'accessory-no-game',
  ]);
  assert.deepEqual(codesOf(issues, '/produit/mauvais-jeu'), [
    'product-game-mismatch',
  ]);
  assert.match(
    issues.find((issue) => issue.subject === '/produit/mauvais-jeu')?.detail ??
      '',
    /jeu du produit : Lorcana ; extension « Flammes Obsidiennes » : Pokémon/,
  );
  // A hidden product only counts for data integrity.
  assert.deepEqual(codesOf(issues, '/produit/brouillon'), [
    'product-game-mismatch',
  ]);
});

test('base : extensions, jeux et catégories vides ou incomplets', () => {
  const { issues } = auditCatalog(
    snapshot({
      games: [
        game(),
        game({ id: 'g-op', slug: 'one-piece', name: 'One Piece' }),
      ],
      sets: [
        tcgSet(),
        tcgSet({ id: 's1', slug: 'sans-jeu', gameId: null, releaseDate: null }),
        tcgSet({
          id: 's2',
          slug: 'a-venir',
          releaseDate: new Date('2026-11-14T00:00:00.000Z'),
        }),
        tcgSet({ id: 's3', slug: 'inactive', isActive: false, gameId: null }),
      ],
      categories: [
        category({
          id: 'c-sealed',
          slug: 'scelles',
          name: 'Scellés',
          parentId: null,
        }),
        category(),
        category({
          id: 'c-acc',
          slug: 'accessoires',
          name: 'Accessoires',
          parentId: null,
        }),
        category({
          id: 'c-old',
          slug: 'ancienne',
          isActive: false,
          parentId: null,
        }),
      ],
    }),
  );
  assert.deepEqual(codesOf(issues, 'extension sans-jeu'), [
    'empty-set',
    'set-no-game',
    'set-no-release-date',
  ]);
  assert.deepEqual(codesOf(issues, 'extension a-venir'), [
    'upcoming-empty-set',
  ]);
  assert.deepEqual(codesOf(issues, 'extension inactive'), []);
  assert.deepEqual(codesOf(issues, 'jeu one-piece'), ['empty-game']);
  assert.deepEqual(codesOf(issues, 'catégorie accessoires'), [
    'empty-category',
  ]);
  assert.deepEqual(codesOf(issues, 'catégorie scelles'), []);
  assert.deepEqual(codesOf(issues, 'catégorie ancienne'), []);
});

test('base : collisions de slugs dans l’espace des facettes et racines réservées', () => {
  const issues = findSlugCollisions({
    games: [game(), game({ id: 'g2', slug: 'guides', name: 'Guides' })],
    sets: [
      tcgSet(),
      tcgSet({ id: 's1', slug: 'ETB', name: 'ETB Promo' }),
      tcgSet({ id: 's2', slug: 'japonais', name: 'Japonais' }),
      tcgSet({ id: 's3', slug: 'precommandes', isActive: false }),
    ],
    categories: [
      category(),
      category({ id: 'c2', slug: 'en-stock', name: 'Stock' }),
    ],
  });
  assert.deepEqual(
    issues.map((issue) => [issue.code, issue.subject]),
    [
      ['slug-collision', 'guides'],
      ['slug-collision', 'japonais'],
      ['slug-collision-inactive', 'precommandes'],
      ['slug-collision', 'en-stock'],
      ['slug-collision', 'ETB'],
    ],
  );
  assert.match(
    issues.at(-1)?.detail ?? '',
    /extension « ETB Promo » \/ catégorie « ETB » : même slug de facette/,
  );
});

test('base : surcharges SEO trop longues et FAQ JSON invalides', () => {
  assert.equal(faqProblem(null), null);
  assert.equal(faqProblem([]), null);
  assert.equal(faqProblem([{ question: 'Q ?', answer: 'R.' }]), null);
  assert.equal(faqProblem({ question: 'Q' }), 'la FAQ n’est pas une liste');
  assert.equal(
    faqProblem([
      { question: 'Q ?', answer: 'R.' },
      'texte',
      { question: ' ', answer: 'R' },
    ]),
    'entrées 2, 3 sans question ou réponse texte',
  );
  const { issues } = auditCatalog(
    snapshot({
      games: [game({ seoTitle: 't'.repeat(71), faq: 'pas une liste' })],
      sets: [
        tcgSet({ seoDescription: 'd'.repeat(171), faq: [{ question: 'Q' }] }),
      ],
      products: [product({ seoTitle: 't'.repeat(70) })],
    }),
  );
  assert.deepEqual(codesOf(issues, 'jeu pokemon'), [
    'faq-invalid',
    'seo-title-too-long',
  ]);
  assert.deepEqual(codesOf(issues, 'extension flammes-obsidiennes'), [
    'faq-invalid',
    'seo-description-too-long',
  ]);
  assert.deepEqual(codesOf(issues, '/produit/etb-obf'), []);
});

// ---------------------------------------------------------------------------
// Command line and report

test('ligne de commande : DATABASE_URL explicite exigée, options de crawl', () => {
  const refused = parseAuditArgs([], {});
  assert.equal(refused.type, 'error');
  assert.match(
    refused.type === 'error' ? refused.message : '',
    /DATABASE_URL absente.*jamais \.env.*--crawl-only/,
  );
  const crawlOnly = parseAuditArgs(['--crawl-only', '--limit=20'], {
    SEO_BASE_URL: 'http://127.0.0.1:3100/chemin',
  });
  assert.deepEqual(crawlOnly, {
    type: 'run',
    options: {
      json: false,
      all: false,
      database: false,
      crawl: true,
      baseUrl: 'http://127.0.0.1:3100',
      limit: 20,
      linkSample: 200,
      timeoutMs: 15_000,
      databaseTarget: null,
    },
  });
  const full = parseAuditArgs(
    ['--json', '--db-only', '--links', '0', '--timeout=40'],
    {
      DATABASE_URL:
        'postgresql://postgres:secret@127.0.0.1:5434/caldera?schema=public',
    },
  );
  assert.equal(full.type, 'run');
  if (full.type === 'run') {
    assert.equal(full.options.databaseTarget, '127.0.0.1:5434/caldera');
    assert.equal(full.options.crawl, false);
    assert.equal(full.options.linkSample, 0);
    assert.equal(full.options.timeoutMs, 40_000);
    assert.equal(full.options.baseUrl, 'http://localhost:3000');
  }
  for (const argv of [
    ['--crawl-only', '--limit', '0'],
    ['--crawl-only', '--timeout', '1.5'],
    ['--crawl-only', '--base-url', 'ftp://x'],
    ['--crawl-only', '--db-only'],
    ['--crawl-only', '--inconnue'],
  ])
    assert.equal(parseAuditArgs(argv, {}).type, 'error');
  assert.equal(
    parseAuditArgs([], { DATABASE_URL: 'mysql://localhost/x' }).type,
    'error',
  );
  assert.deepEqual(parseAuditArgs(['--help'], {}), { type: 'help' });
});

test('rapport : bilan, code de sortie, rendu terminal et JSON', () => {
  const issue = (code: AuditRuleCode, subject: string): AuditIssue => ({
    code,
    subject,
  });
  const report: AuditReport = {
    generatedAt: '2026-09-26T08:00:00.000Z',
    sections: [
      {
        section: 'database',
        target: '127.0.0.1:5434/caldera',
        stats: { products: 3, visibleProducts: 2 },
        issues: [
          issue('product-no-image', '/produit/a'),
          issue('product-no-image', '/produit/b'),
          issue('accessory-no-game', '/produit/c'),
        ],
      },
      {
        section: 'crawl',
        target: LOCAL,
        stats: { crawledPages: 2 },
        issues: [{ ...issue('broken-link', '/mort'), detail: '404 depuis /' }],
      },
    ],
  };
  assert.deepEqual(summarize(report), { errors: 1, warnings: 2, notices: 1 });
  assert.equal(exitCodeOf(report), 1);
  const text = formatReport(report, { maxPerRule: 1 });
  assert.ok(!text.includes('\u001b['));
  assert.match(text, /produits : 3 · produits visibles : 2/);
  assert.match(text, /ERREUR {2}Liens internes cassés .*\(1\) \[broken-link\]/);
  assert.match(text, /\/mort — 404 depuis \//);
  assert.match(text, /… et 1 de plus \(--all pour tout afficher\)/);
  assert.match(text, /Bilan : 1 erreur, 2 alertes, 1 info → échec/);
  assert.ok(formatReport(report, { color: true }).includes('\u001b[31m'));
  const json = toJsonReport(report);
  assert.equal(json.exitCode, 1);
  assert.deepEqual(json.sections[1]?.issues[0], {
    severity: 'error',
    code: 'broken-link',
    label: 'Liens internes cassés (4xx, 5xx ou sans réponse)',
    subject: '/mort',
    detail: '404 depuis /',
  });
  const clean: AuditReport = {
    generatedAt: report.generatedAt,
    sections: [
      { section: 'database', skipped: '--crawl-only', stats: {}, issues: [] },
      { section: 'crawl', stats: { crawledPages: 1 }, issues: [] },
    ],
  };
  assert.equal(exitCodeOf(clean), 0);
  assert.match(formatReport(clean), /Ignoré : --crawl-only/);
  assert.match(formatReport(clean), /Aucun problème détecté/);
});
