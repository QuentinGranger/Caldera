import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Prisma } from '../src/generated/prisma/client';
import {
  calculateShipping,
  getAvailableShippingMethods,
} from '../src/lib/checkout/shipping';
import { assertPaymentConfiguration } from '../src/lib/stripe/stripe';
import { proxy } from '../src/proxy';
import { NextRequest } from 'next/server';
test('demo mode blocks payments and indexing; production excludes fictitious shipping', async () => {
  const previous = {
    node: process.env.NODE_ENV,
    open: process.env.STORE_OPEN,
    demo: process.env.CATALOG_DEMO_MODE,
  };
  try {
    Object.assign(process.env, { NODE_ENV: 'production' });
    process.env.STORE_OPEN = '1';
    process.env.CATALOG_DEMO_MODE = '1';
    assert.throws(() => assertPaymentConfiguration(), /démonstration/);
    const response = await proxy(
      new NextRequest('https://lesterresdecaldera.fr/catalogue'),
    );
    assert.equal(response.headers.get('x-middleware-rewrite'), null);
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
    const method = {
      id: 'example',
      name: 'Exemple',
      description: null,
      isActive: true,
      isDevelopment: true,
      price: new Prisma.Decimal(0),
      freeFromAmount: null,
      estimatedMinDays: null,
      estimatedMaxDays: null,
      countries: [{ code: 'FR', isActive: true }],
    };
    assert.throws(() =>
      calculateShipping(method, 'FR', new Prisma.Decimal(10)),
    );
    assert.deepEqual(
      getAvailableShippingMethods([method], 'FR', new Prisma.Decimal(10)),
      [],
    );
  } finally {
    for (const [key, value] of Object.entries({
      NODE_ENV: previous.node,
      STORE_OPEN: previous.open,
      CATALOG_DEMO_MODE: previous.demo,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
