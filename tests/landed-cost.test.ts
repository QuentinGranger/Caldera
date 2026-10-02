import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@/generated/prisma/client';
import { landedCost } from '@/lib/finance/landedCost';

test('landedCost adds supplier shipping and procurement fees', () => {
  const result = landedCost({
    costPrice: new Prisma.Decimal('30.00'),
    inboundShippingCost: new Prisma.Decimal('1.25'),
    procurementFees: new Prisma.Decimal('0.75'),
  });

  assert.equal(result?.toFixed(2), '32.00');
});

test('landedCost stays unknown when purchase cost is missing', () => {
  const result = landedCost({
    costPrice: null,
    inboundShippingCost: new Prisma.Decimal('1.25'),
    procurementFees: new Prisma.Decimal('0.75'),
  });

  assert.equal(result, null);
});
