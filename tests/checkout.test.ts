import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Prisma } from '../src/generated/prisma/client';
import { CheckoutError, parseContact } from '../src/lib/checkout/schemas';
import { emptyAddress } from '../src/lib/checkout/types';
import {
  calculateShipping,
  type ShippingRule,
} from '../src/lib/checkout/shipping';
const shipping = {
  ...emptyAddress(),
  firstName: 'Éléonore',
  lastName: 'D’Angelo-Le Roy',
  addressLine1: '12 rue des Terres',
  postalCode: '75001',
  city: 'Paris',
};
const contact = {
  email: 'collection+test@example.com',
  phone: '+33 6 12 34 56 78',
  billingSame: true,
  shipping,
  billing: null,
};
test('coordonnées : noms libres, normalisation douce, erreurs de champs', () => {
  const parsed = parseContact(
    { ...contact, shipping: { ...shipping, city: '  Paris  ' } },
    ['FR', 'BE'],
  );
  for (const phone of ['++++++', '123', 'abcdef'])
    assert.throws(
      () => parseContact({ ...contact, phone }, ['FR']),
      CheckoutError,
    );
  assert.equal(parsed.shipping.city, 'Paris');
  assert.equal(parsed.shipping.lastName, shipping.lastName);
  for (const email of [
    'invalide',
    'a@b',
    'a..b@example.com',
    'a@-example.com',
    'a@exam_ple.com',
  ]) {
    assert.throws(
      () => parseContact({ ...contact, email }, ['FR']),
      (error: unknown) =>
        error instanceof CheckoutError && Boolean(error.errors.email),
    );
  }
  assert.throws(
    () =>
      parseContact({ ...contact, shipping: { ...shipping, city: '' } }, ['FR']),
    (error: unknown) =>
      error instanceof CheckoutError && Boolean(error.errors['shipping.city']),
  );
});
test('facturation distincte, pays et formats postaux', () => {
  const billing = {
    ...shipping,
    countryCode: 'BE',
    postalCode: '1000',
    city: 'Bruxelles',
  };
  assert.equal(
    parseContact({ ...contact, billingSame: false, billing }, ['FR', 'BE'])
      .billing?.city,
    'Bruxelles',
  );
  assert.equal(
    parseContact({ ...contact, billing }, ['FR', 'BE']).billing,
    null,
  );
  assert.throws(
    () => parseContact({ ...contact, billingSame: false }, ['FR']),
    CheckoutError,
  );
  assert.throws(() => parseContact(contact, ['BE']), CheckoutError);
  assert.throws(
    () =>
      parseContact(
        { ...contact, shipping: { ...shipping, postalCode: 'ABCD' } },
        ['FR'],
      ),
    CheckoutError,
  );
  assert.doesNotThrow(() =>
    parseContact(
      {
        ...contact,
        shipping: { ...shipping, countryCode: 'NL', postalCode: '1012 AB' },
      },
      ['NL'],
    ),
  );
});
test('livraison Decimal : juste sous le seuil, égalité, au-dessus et méthode invalide', () => {
  const rule: ShippingRule = {
    id: 'test',
    code: 'TEST',
    type: 'HOME_DELIVERY',
    name: 'Test',
    description: null,
    isActive: true,
    isDevelopment: true,
    price: new Prisma.Decimal('5.90'),
    freeFromAmount: new Prisma.Decimal('150.00'),
    estimatedMinDays: null,
    estimatedMaxDays: null,
    countries: [{ code: 'FR', isActive: true }],
  };
  assert.equal(
    calculateShipping(rule, 'FR', new Prisma.Decimal('149.99')).toFixed(2),
    '5.90',
  );
  assert.equal(
    calculateShipping(rule, 'FR', new Prisma.Decimal('150')).toFixed(2),
    '0.00',
  );
  assert.equal(
    calculateShipping(rule, 'FR', new Prisma.Decimal('150.01')).toFixed(2),
    '0.00',
  );
  assert.throws(
    () => calculateShipping(rule, 'BE', new Prisma.Decimal('150')),
    CheckoutError,
  );
  assert.throws(
    () =>
      calculateShipping(
        { ...rule, isActive: false },
        'FR',
        new Prisma.Decimal('150'),
      ),
    CheckoutError,
  );
});
