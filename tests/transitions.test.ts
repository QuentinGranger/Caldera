import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { compileString } from 'sass';
import {
  CHRONICLE_NUMBER,
  PRODUCT_MORPH,
  WORLD_HERO,
  perTransition,
  productTransitionName,
} from '@/lib/transitions/classes';
import { isPageJourney } from '@/lib/transitions/navigation';
import {
  TRANSITIONS,
  chooseTransition,
  transitionFromTypes,
  transitionType,
} from '@/lib/transitions/matrix';
import {
  CHRONICLE_ORDER,
  chronicleIndex,
  productSlug,
  routeKind,
  samePage,
} from '@/lib/transitions/routes';

const go = (from: string, to: string, override?: string) =>
  chooseTransition({ from, to, override });

test('Transitions : chaque route a sa famille', () => {
  assert.equal(routeKind('/'), 'HOME');
  assert.equal(routeKind('/catalogue'), 'SHOP');
  assert.equal(routeKind('/nouveautes?page=2'), 'SHOP');
  assert.equal(routeKind('/produit/display-151'), 'PRODUCT');
  assert.equal(routeKind('/pokemon'), 'COLLECTION');
  assert.equal(routeKind('/pokemon/boosters'), 'COLLECTION');
  assert.equal(routeKind('/extensions/ecarlate-et-violet'), 'COLLECTION');
  assert.equal(routeKind('/guides/conserver-ses-cartes'), 'EDITORIAL');
  assert.equal(routeKind('/glossaire'), 'EDITORIAL');
  assert.equal(routeKind('/univers'), 'UNIVERSE');
  assert.equal(routeKind('/univers/origines'), 'CHRONICLE');
  assert.equal(routeKind('/univers/inconnue'), 'UNIVERSE');
  assert.equal(routeKind('/compte'), 'ACCOUNT');
  assert.equal(routeKind('/panier'), 'ACCOUNT');
  assert.equal(routeKind('/checkout'), 'UTILITY');
  assert.equal(routeKind('/admin/commandes'), 'UTILITY');
  assert.equal(routeKind('/cgv'), 'UTILITY');
});

test('Transitions : gestes natifs, ancres et liens externes sont exclus', () => {
  const from = new URL('https://lesterresdecaldera.fr/catalogue');
  const to = new URL('/produit/coffret', from);
  assert.equal(isPageJourney({ from, to }), true);
  for (const settings of [
    { button: 1 },
    { button: 2 },
    { modified: true },
    { target: '_blank' },
    { download: true },
  ])
    assert.equal(isPageJourney({ from, to, ...settings }), false);
  for (const href of [
    '/catalogue?langue=FR',
    '/catalogue#resultats',
    '/univers/territoires#forets',
    'https://discord.gg/RQ8AMYaGVq',
    'mailto:contact@lesterresdecaldera.fr',
    'tel:+33123456789',
  ])
    assert.equal(isPageJourney({ from, to: new URL(href, from) }), false, href);
  assert.equal(isPageJourney({ from, to, target: '_self' }), true);
});

test('Transitions : les noms produit sont uniques, même pour les caractères encodés', () => {
  const slugs = [
    'coffret-a',
    'coffret_a',
    'coffret/a',
    'coffret a',
    'é',
    'e',
    '💎',
  ];
  const names = slugs.map(productTransitionName);
  assert.equal(new Set(names).size, slugs.length);
  for (const name of names) assert.match(name, /^product-image-[a-f0-9-]+$/);
});

test('Transitions : les chroniques se lisent dans l’ordre', () => {
  assert.deepEqual(CHRONICLE_ORDER, [
    'origines',
    'archives',
    'territoires',
    'route-des-cinq',
    'horizons',
  ]);
  assert.equal(chronicleIndex('/univers/archives'), 1);
  assert.equal(chronicleIndex('/univers'), -1);
  assert.equal(chronicleIndex('/catalogue'), -1);
  assert.equal(productSlug('/produit/coffret-dresseur'), 'coffret-dresseur');
  assert.equal(productSlug('/catalogue'), null);
});

test('Transitions : une même page (filtres, ancre) ne bouge jamais', () => {
  assert.equal(samePage('/catalogue', '/catalogue?langue=FR'), true);
  assert.equal(samePage('/guides/a', '/guides/a#suite'), true);
  assert.equal(samePage('/catalogue/', '/catalogue'), true);
  assert.equal(samePage('/catalogue', '/nouveautes'), false);
  assert.equal(go('/catalogue', '/catalogue?page=2'), null);
  assert.equal(go('/guides/a', '/guides/a#suite', 'souffle'), null);
});

test('Transitions : la matrice', () => {
  // The universe.
  assert.equal(go('/', '/univers'), 'enter-world');
  assert.equal(go('/catalogue', '/univers/origines'), 'enter-world');
  assert.equal(go('/univers', '/univers/origines'), 'descend');
  assert.equal(go('/univers/archives', '/univers'), 'ascend');
  assert.equal(go('/univers/origines', '/univers/archives'), 'chapter-forward');
  assert.equal(go('/univers/horizons', '/univers/archives'), 'chapter-back');
  assert.equal(go('/univers/archives', '/'), 'leave-world');
  assert.equal(go('/univers', '/produit/x'), 'leave-world');
  // Products.
  assert.equal(go('/pokemon/boosters', '/produit/x'), 'product');
  assert.equal(go('/produit/x', '/produit/y'), 'product');
  assert.equal(go('/produit/x', '/pokemon/boosters'), 'product-return');
  assert.equal(go('/produit/x', '/catalogue'), 'product-return');
  assert.equal(go('/produit/x', '/'), 'product-return');
  // Reading, the shop, the rest.
  assert.equal(go('/', '/guides/a'), 'archive');
  assert.equal(go('/guides/a', '/catalogue'), 'archive');
  assert.equal(go('/', '/catalogue'), 'shop');
  assert.equal(go('/catalogue', '/pokemon'), 'shop');
  assert.equal(go('/pokemon', '/compte'), 'shop');
  assert.equal(go('/catalogue', '/'), 'souffle');
  // Utilities: no show.
  assert.equal(go('/panier', '/checkout'), 'instant');
  assert.equal(go('/checkout', '/'), 'instant');
  assert.equal(go('/admin', '/admin/commandes'), 'instant');
  assert.equal(go('/univers', '/cgv'), 'instant');
});

test('Transitions : un lien peut demander la sienne, jamais une inconnue', () => {
  assert.equal(go('/', '/catalogue', 'souffle'), 'souffle');
  assert.equal(go('/', '/catalogue', 'glitch'), 'shop');
});

test('Transitions : chaque paire de familles reçoit une transition connue', () => {
  const samples = [
    '/',
    '/catalogue',
    '/produit/x',
    '/pokemon',
    '/guides/a',
    '/univers',
    '/univers/origines',
    '/univers/archives',
    '/compte',
    '/checkout',
  ];
  for (const from of samples)
    for (const to of samples) {
      const name = go(from, to);
      if (from === to) assert.equal(name, null);
      else assert.ok(name && TRANSITIONS.includes(name), `${from} → ${to}`);
    }
});

test('Transitions : les types React aller-retour', () => {
  assert.equal(transitionType('souffle'), 'caldera-souffle');
  assert.equal(
    transitionFromTypes(['nav-forward', 'caldera-descend']),
    'descend',
  );
  assert.equal(transitionFromTypes(['caldera-inconnue']), null);
  assert.equal(transitionFromTypes([]), null);
});

test('Transitions : les éléments partagés ne réagissent qu’à leurs voyages', () => {
  const map = perTransition({ shop: 'x' });
  assert.deepEqual(map, { default: 'none', 'caldera-shop': 'x' });
  assert.deepEqual(Object.keys(PRODUCT_MORPH).sort(), [
    'caldera-product',
    'caldera-product-return',
    'default',
  ]);
  assert.equal(WORLD_HERO.default, 'none');
  assert.equal(
    WORLD_HERO['caldera-shop' as keyof typeof WORLD_HERO],
    undefined,
  );
  assert.deepEqual(Object.keys(CHRONICLE_NUMBER).sort(), [
    'caldera-chapter-back',
    'caldera-chapter-forward',
    'default',
  ]);
});

test('Transitions : la feuille de mouvement tient ses promesses', async () => {
  const css = await readFile('src/styles/base/_transitions.scss', 'utf8');
  const compiled = compileString(css).css;
  // Verify actual generated selectors, rather than merely SCSS names.
  for (const name of TRANSITIONS.filter((name) => name !== 'instant'))
    assert.match(
      compiled,
      new RegExp(`\\[data-caldera-arrival=["\']?${name}["\']?\\]`),
      name,
    );
  // The motion tokens.
  for (const token of [
    '--motion-instant',
    '--motion-fast',
    '--motion-page',
    '--motion-cinematic',
    '--ease-caldera:',
    '--ease-caldera-enter',
    '--ease-caldera-exit',
  ])
    assert.ok(css.includes(token), token);
  // Every decorative cut stays below one second; controls never wait.
  for (const [, value] of css.matchAll(/(\d+)ms/g))
    assert.ok(Number(value) <= 900, `${value}ms`);
  // The live page stays clickable, reduced motion has its own version.
  assert.match(css, /::view-transition\s*\{\s*pointer-events:\s*none/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  // Nothing the brief forbids.
  assert.doesNotMatch(css, /glitch|scanline|neon|hue-rotate|rotate\(/i);
});
