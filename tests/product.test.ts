import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  selectProductVariant,
  normalizeQuantity,
  canPreparePurchase,
  type ProductVariantView,
} from '../src/lib/product/purchase';
import {
  formatProductDate,
  formatProductWeight,
} from '../src/utils/formatProduct';
const variant = (sku: string, isDefault = false): ProductVariantView => ({
  id: sku,
  sku,
  language: 'FR',
  condition: 'NEW',
  isDefault,
  price: '59.90',
  compareAtPrice: null,
  availability: 'IN_STOCK',
  maxQuantity: 3,
  lowStockQuantity: null,
  weightGrams: 850,
});
test('variante : deep link, défaut actif, ordre déterministe et absence', () => {
  const fr = variant('FR', true),
    en = variant('EN');
  assert.equal(selectProductVariant([en, fr])?.sku, 'FR');
  assert.equal(selectProductVariant([fr, en], 'EN')?.sku, 'EN');
  assert.equal(selectProductVariant([en, fr], 'JP')?.sku, 'FR');
  assert.equal(selectProductVariant([variant('ZZ'), en])?.sku, 'EN');
  assert.equal(selectProductVariant([]), null);
});
test('quantité : minimum, maximum, valeurs invalides et précommandes limitées', () => {
  for (const value of [0, -2, '', 'abc', '1.5', 'Infinity'])
    assert.equal(normalizeQuantity(value, 3), 1);
  assert.equal(normalizeQuantity(1, 3), 1);
  assert.equal(normalizeQuantity(99, 3), 3);
  assert.equal(normalizeQuantity(3, 3), 3);
  assert.equal(normalizeQuantity(2, 0), 1);
  assert.equal(canPreparePurchase(variant('FR'), 3), true);
  assert.equal(canPreparePurchase(variant('FR'), 4), false);
  assert.equal(canPreparePurchase(variant('FR'), 0), false);
  assert.equal(canPreparePurchase(null, 1), false);
  assert.equal(
    canPreparePurchase({ ...variant('FR'), availability: 'OUT_OF_STOCK' }, 1),
    false,
  );
  assert.equal(
    canPreparePurchase(
      { ...variant('FR'), availability: 'PREORDER', maxQuantity: 0 },
      1,
    ),
    false,
  );
  assert.equal(
    canPreparePurchase({ ...variant('FR'), availability: 'PREORDER' }, 3),
    true,
  );
});
test('date et poids français sans décalage de fuseau', () => {
  assert.equal(
    formatProductDate('2026-09-01T00:00:00.000Z'),
    '1 septembre 2026',
  );
  assert.match(formatProductWeight(850), /^850\s?g$/);
  assert.match(formatProductWeight(1200), /^1,2\s?kg$/);
});
