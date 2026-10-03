import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';

async function tsxFiles(root: string): Promise<string[]> {
  const entries = await readdir(root);
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(root, entry);
    const info = await stat(path);
    if (info.isDirectory()) files.push(...(await tsxFiles(path)));
    else if (path.endsWith('.tsx')) files.push(path);
  }
  return files;
}

test('CTA storefront : une même destination catalogue garde le même vocabulaire', async () => {
  const files = await tsxFiles('src');
  const contents = await Promise.all(
    files.map(async (path) => ({ path, content: await readFile(path, 'utf8') })),
  );

  const forbidden = [
    'Découvrir le catalogue',
    'Explorer le catalogue',
    'Voir le catalogue',
    'Tout le catalogue',
    'Explorer la boutique',
  ];

  for (const { path, content } of contents) {
    for (const phrase of forbidden)
      assert.ok(!content.includes(phrase), `${path}: "${phrase}"`);
  }

  const canonical = await readFile('src/lib/ux/copy.ts', 'utf8');
  assert.match(canonical, /ALL_PRODUCTS_LABEL = 'Voir tous les produits'/);
});

test('CTA storefront : produit, panier et extension ont des verbes explicites', async () => {
  const copy = await readFile('src/lib/ux/copy.ts', 'utf8');
  assert.match(copy, /ADD_TO_CART_LABEL = 'Ajouter au panier'/);
  assert.match(copy, /VIEW_EXTENSION_LABEL = 'Voir l’extension'/);
  assert.match(copy, /viewProductLabel/);
  assert.match(copy, /addProductToCartLabel/);

  const cart = await readFile('src/components/cart/CartEmpty.tsx', 'utf8');
  const card = await readFile(
    'src/components/product/ProductCard/ProductCard.tsx',
    'utf8',
  );
  const setCard = await readFile('src/components/landing/SetCard.tsx', 'utf8');

  assert.match(cart, /ALL_PRODUCTS_LABEL/);
  assert.match(card, /viewProductLabel/);
  assert.match(setCard, /VIEW_EXTENSION_LABEL/);
});
