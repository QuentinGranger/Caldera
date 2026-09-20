import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Prisma } from '../src/generated/prisma/client';
import { createSlug } from '../src/lib/catalog/createSlug';
import {
  getAvailability,
  getProductBadge,
} from '../src/lib/catalog/getAvailability';
import { getPricing } from '../src/lib/catalog/getPricing';
import { formatPrice } from '../src/utils/formatPrice';

test('slugs : accents, ligatures, caractères spéciaux, collisions et valeur vide', () => {
  assert.equal(
    createSlug('Élite Trainer Box Évoli'),
    'elite-trainer-box-evoli',
  );
  assert.equal(createSlug('  Cœur & Æther -- 2026! '), 'coeur-aether-2026');
  assert.equal(createSlug('Évoli', ['evoli', 'evoli-2']), 'evoli-3');
  assert.equal(createSlug('!!!'), 'produit');
});
const stock = (quantity: number, threshold = 2, isActive = true) => ({
  stockQuantity: quantity,
  reservedQuantity: 0,
  lowStockThreshold: threshold,
  isActive,
});
test('disponibilité : priorités, bornes et variantes inactives', () => {
  assert.equal(getAvailability(true, []), 'OUT_OF_STOCK');
  assert.equal(getAvailability(true, [stock(0)]), 'PREORDER');
  assert.equal(getAvailability(false, [stock(0)]), 'OUT_OF_STOCK');
  assert.equal(getAvailability(false, [stock(2)]), 'LOW_STOCK');
  assert.equal(getAvailability(false, [stock(3)]), 'IN_STOCK');
  assert.equal(getAvailability(false, [stock(0), stock(1)]), 'LOW_STOCK');
  assert.equal(getAvailability(false, [stock(1), stock(9)]), 'IN_STOCK');
  assert.equal(
    getAvailability(false, [stock(0), stock(999, 2, false)]),
    'OUT_OF_STOCK',
  );
  assert.equal(getProductBadge('OUT_OF_STOCK', true), 'sold-out');
});
const priced = (
  sku: string,
  price: string,
  isActive = true,
  isDefault = false,
  compareAtPrice: string | null = null,
) => ({
  sku,
  price: new Prisma.Decimal(price),
  compareAtPrice: compareAtPrice ? new Prisma.Decimal(compareAtPrice) : null,
  isActive,
  isDefault,
});
test('prix : Decimal exact, minimum actif, prix barré cohérent et variante par défaut', () => {
  assert.deepEqual(
    getPricing([
      priced('FR', '59.90', true, true, '69.90'),
      priced('EN', '54.90', true, false, '64.90'),
      priced('JP', '1.00', false),
    ]),
    { price: '54.90', compareAtPrice: '64.90', priceFrom: true },
  );
  assert.deepEqual(
    getPricing([
      priced('FR', '9.90', true, true, '8.90'),
      priced('EN', '9.90'),
    ]),
    { price: '9.90', compareAtPrice: null, priceFrom: false },
  );
  assert.deepEqual(getPricing([]), {
    price: null,
    compareAtPrice: null,
    priceFrom: false,
  });
  assert.equal(new Prisma.Decimal('0.10').plus('0.20').toFixed(2), '0.30');
  assert.match(formatPrice('59.90'), /^59,90\s€$/u);
});
