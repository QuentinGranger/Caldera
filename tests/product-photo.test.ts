import assert from 'node:assert/strict';
import test from 'node:test';
import { productPhotoBounds } from '../src/lib/three/product-photo';

test('packshot : exclut les marges transparentes pour ancrer le vrai pied du produit', () => {
  const pixels = new Uint8ClampedArray(5 * 6 * 4);
  for (const [x, y] of [
    [1, 1],
    [3, 1],
    [2, 4],
  ] as const)
    pixels[(y * 5 + x) * 4 + 3] = 255;
  pixels[(5 * 5 + 2) * 4 + 3] = 2; // Ombre presque invisible sous le produit.
  assert.deepEqual(productPhotoBounds(pixels, 5, 6), {
    left: 1,
    top: 1,
    width: 3,
    height: 4,
  });
});

test('packshot : conserve une photo opaque et accepte un produit au bord de l’image', () => {
  const opaque = new Uint8ClampedArray(3 * 2 * 4).fill(255);
  assert.deepEqual(productPhotoBounds(opaque, 3, 2), {
    left: 0,
    top: 0,
    width: 3,
    height: 2,
  });
  const corner = new Uint8ClampedArray(3 * 2 * 4);
  corner[corner.length - 1] = 255;
  assert.deepEqual(productPhotoBounds(corner, 3, 2), {
    left: 2,
    top: 1,
    width: 1,
    height: 1,
  });
});

test('packshot : une image vide conserve le secours HTML au lieu de masquer le produit', () => {
  assert.equal(productPhotoBounds(new Uint8ClampedArray(16), 2, 2), null);
});
