import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  HOME_PROMISE,
  distinctSections,
  familyTargets,
  homeDescription,
  isDemoCatalogue,
} from '../src/components/home/homeData';
import { isShopGame } from '../src/lib/catalog/shopGame';
import type { NavigationFamily } from '../src/lib/seo/links';
import type { CatalogProduct } from '../src/types/product';

// Seuls les champs lus par les fonctions.
const product = (id: string, name = `Produit ${id}`) =>
  ({ id, name }) as CatalogProduct;

test('accueil : un produit apparaît une fois, dans la première section qui le montre', () => {
  const [selected, latest, restocked] = distinctSections([
    [product('a'), product('b')],
    [product('b'), product('c'), product('d')],
    [product('a'), product('d'), product('e')],
  ]);
  assert.deepEqual(
    selected.map((item) => item.id),
    ['a', 'b'],
  );
  assert.deepEqual(
    latest.map((item) => item.id),
    ['c', 'd'],
  );
  assert.deepEqual(
    restocked.map((item) => item.id),
    ['e'],
  );
});

test('accueil : les sections gardent leur ordre et peuvent rester vides', () => {
  const [first, second] = distinctSections([[product('a')], [product('a')]]);
  assert.equal(first.length, 1);
  assert.deepEqual(second, []);
  assert.deepEqual(distinctSections([[], []]), [[], []]);
});

test('accueil : mention de démonstration pour les seuls produits de démo', () => {
  assert.equal(isDemoCatalogue([]), false);
  assert.equal(
    isDemoCatalogue([product('a', 'Display Écarlate et Violet')]),
    false,
  );
  assert.equal(
    isDemoCatalogue([
      product('a', 'Display Écarlate et Violet'),
      product('b', '[Démo] Booster — Terres de Braise'),
    ]),
    true,
  );
  // Le préfixe, pas une mention plus loin dans le nom.
  assert.equal(isDemoCatalogue([product('a', 'Coffret [Démo]')]), false);
});

const family = (
  slug: string,
  href: string,
  count: number,
): NavigationFamily => ({
  slug,
  name: slug,
  label: slug,
  href,
  count,
  children: [],
});

test('accueil : chaque famille mène à sa page Pokémon, le hub multi-jeux seulement à défaut', () => {
  const targets = familyTargets({
    games: [
      {
        slug: 'lorcana',
        name: 'Lorcana',
        shortName: null,
        href: '/lorcana',
        count: 30,
        families: [family('scelles', '/lorcana/scelles', 30)],
      },
      {
        slug: 'pokemon',
        name: 'Pokémon',
        shortName: null,
        href: '/pokemon',
        count: 12,
        families: [family('scelles', '/pokemon/scelles', 12)],
      },
    ],
    categoryHubs: [
      family('scelles', '/categorie/scelles', 42),
      family('accessoires', '/categorie/accessoires', 5),
    ],
  });
  assert.deepEqual(Object.fromEntries(targets), {
    scelles: { href: '/pokemon/scelles', count: 12 },
    accessoires: { href: '/categorie/accessoires', count: 5 },
  });
});

test('accueil : description des seuls produits Pokémon, la promesse tant que rien n’est en ligne', () => {
  assert.equal(
    homeDescription({ stats: null, families: [] }),
    `${HOME_PROMISE} Livraison en France métropolitaine.`,
  );
  const description = homeDescription({
    stats: {
      productCount: 14,
      inStockCount: 11,
      preorderCount: 3,
      minPrice: '5.90',
      maxPrice: '189.90',
    },
    families: [{ name: 'Boosters' }, { name: 'ETB' }],
  });
  assert.match(description, /^Cartes Pokémon : 14 produits de 5,90/);
  assert.match(description, /dont 11 en stock et 3 en précommande\./);
  assert.ok(description.includes('Boosters et ETB.'));
  assert.ok(description.length <= 160);
  assert.doesNotMatch(description, /Lorcana|JCC/);
});

test('accueil : lectures Pokémon ou sans licence, jamais celles d’un autre jeu', () => {
  assert.equal(isShopGame(['pokemon']), true);
  assert.equal(isShopGame([]), true);
  assert.equal(isShopGame(['lorcana']), false);
  assert.equal(isShopGame(['magic', 'pokemon']), true);
});
