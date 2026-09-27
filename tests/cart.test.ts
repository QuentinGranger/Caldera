import assert from 'node:assert/strict';
import { test } from 'node:test';
import { itemIssue, type ValidatableVariant } from '../src/lib/cart/validation';
function variant(
  product: Partial<ValidatableVariant['product']> = {},
  stockQuantity = 5,
): ValidatableVariant {
  return {
    isActive: true,
    stockQuantity,
    reservedQuantity: 0,
    product: {
      status: 'ACTIVE',
      category: { isActive: true },
      tcgSet: { isActive: true },
      game: { isActive: true },
      ...product,
    },
  };
}
test('achat : mêmes règles de visibilité que le catalogue public', () => {
  assert.equal(itemIssue(variant(), 1), null);
  assert.equal(itemIssue(variant({ game: null, tcgSet: null }), 1), null);
  assert.equal(itemIssue(variant({ status: 'ARCHIVED' }), 1), 'UNAVAILABLE');
  assert.equal(
    itemIssue(variant({ category: { isActive: false } }), 1),
    'UNAVAILABLE',
  );
  assert.equal(
    itemIssue(variant({ tcgSet: { isActive: false } }), 1),
    'UNAVAILABLE',
  );
  // A product whose game is deactivated is withdrawn from sale.
  assert.equal(
    itemIssue(variant({ game: { isActive: false } }), 1),
    'UNAVAILABLE',
  );
  assert.equal(itemIssue(variant({}, 0), 1), 'OUT_OF_STOCK');
  assert.equal(itemIssue(variant({}, 2), 3), 'INSUFFICIENT_STOCK');
});
