import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  distinctSections,
  isDemoCatalogue,
} from '../src/components/home/homeData';
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
