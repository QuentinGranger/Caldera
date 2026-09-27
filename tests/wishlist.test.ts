import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isProductId,
  MAX_GUEST_FAVORITES,
  parseFavoriteSession,
  serializeFavoriteSession,
} from '../src/lib/wishlist/sessionValue';

const id = (index: number) =>
  `00000000-0000-4000-8000-${index.toString().padStart(12, '0')}`;

test('favoris invités : seuls les UUID valides et uniques sont conservés', () => {
  const first = id(1);
  const second = id(2);
  assert.deepEqual(
    parseFavoriteSession(`${first},invalide,${second},${first.toUpperCase()}`),
    [first, second],
  );
  assert.equal(isProductId(first), true);
  assert.equal(isProductId('produit-1'), false);
});

test('favoris invités : le cookie est borné à cinquante produits', () => {
  const ids = Array.from({ length: MAX_GUEST_FAVORITES + 5 }, (_, index) =>
    id(index + 1),
  );
  const serialized = serializeFavoriteSession(ids);
  assert.equal(parseFavoriteSession(serialized).length, MAX_GUEST_FAVORITES);
  assert.ok(serialized.length < 4096);
});
