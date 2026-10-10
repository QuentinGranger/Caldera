import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  freeShipping,
  freeThresholdLabel,
  lowestShippingPrice,
  shippingFromLabel,
} from '../src/lib/shipping/summary';
import { shippingOptionViews } from '../src/lib/product/services';
import type { ShippingFact } from '../src/lib/seo/shipping';

const offer = (name: string, price: string, freeFromAmount: string | null) => ({
  name,
  price,
  freeFromAmount,
});
const relay = offer('Mondial Relay — Point Relais', '4.90', '60.00');
const home = offer('La Poste / Colissimo — domicile', '7.90', null);
const space = /\s/gu;

test('livraison : le tarif « dès » est le plus bas des modes, jamais un chiffre à part', () => {
  assert.equal(lowestShippingPrice([]), null);
  assert.equal(lowestShippingPrice([home, relay]), '4.90');
  assert.equal(shippingFromLabel([]), null);
  assert.equal(
    shippingFromLabel([home, relay])?.replace(space, ' '),
    'Livraison dès 4,90 €',
  );
  // A method at no cost: the whole delivery is said to be free.
  assert.equal(
    shippingFromLabel([offer('Retrait', '0.00', null), home]),
    'Livraison offerte',
  );
});

test('livraison : le seuil de gratuité vient des modes, nommé quand il y en a plusieurs', () => {
  assert.equal(freeThresholdLabel([home]), null);
  assert.equal(
    freeThresholdLabel([relay])?.replace(space, ' '),
    'offerte dès 60,00 € d’achat',
  );
  assert.equal(
    freeThresholdLabel([home, relay])?.replace(space, ' '),
    'offerte dès 60,00 € d’achat avec Mondial Relay — Point Relais',
  );
  // A method already free has no threshold to speak of.
  assert.equal(freeThresholdLabel([offer('Retrait', '0.00', '10.00')]), null);
  // The nearest threshold among several.
  assert.equal(
    freeThresholdLabel([
      offer('A', '5.00', '120.00'),
      offer('B', '5.00', '80.00'),
    ])?.replace(space, ' '),
    'offerte dès 80,00 € d’achat avec B',
  );
});

test('livraison : le panier mesure la gratuité comme le paiement, au centime', () => {
  assert.equal(freeShipping([home], '10.00'), null);
  const toGo = freeShipping([home, relay], '42.10');
  assert.equal(toGo?.state, 'toGo');
  if (toGo?.state === 'toGo') {
    assert.equal(toGo.remaining, '17.90');
    assert.equal(toGo.ratio, 42.1 / 60);
    assert.match(toGo.label, /livraison offerte avec Mondial Relay/);
  }
  // Exactly at the threshold: reached (the checkout's `gte`).
  const reached = freeShipping([home, relay], '60.00');
  assert.equal(reached?.state, 'reached');
  assert.match(reached?.label ?? '', /^Livraison offerte avec Mondial Relay/);
  assert.equal(freeShipping([home, relay], '59.99')?.state, 'toGo');
  assert.equal(
    freeShipping([relay], '59.99')?.state === 'toGo' &&
      (freeShipping([relay], '59.99') as { remaining: string }).remaining,
    '0.01',
  );
  // One method only: no need to name it.
  assert.equal(
    freeShipping([relay], '10.00')?.label,
    'pour la livraison offerte',
  );
  // An empty cart is at zero, never below.
  const empty = freeShipping([relay], '0.00');
  assert.equal(empty?.state === 'toGo' && empty.ratio, 0);
});

test('livraison : une vue de mode garde le prix, le seuil et le délai pour le panier', () => {
  const fact: ShippingFact = {
    code: 'REL',
    name: 'Mondial Relay — Point Relais',
    description: null,
    type: 'HOME_DELIVERY',
    price: '4.90',
    freeFromAmount: '60.00',
    estimatedMinDays: 3,
    estimatedMaxDays: 5,
    minDays: 3,
    maxDays: 5,
    countries: ['FR'],
    destinations: [{ code: 'FR', name: 'France' }],
  };
  const [view] = shippingOptionViews([fact]);
  assert.equal(view?.price, '4.90');
  assert.equal(view?.freeFromAmount, '60.00');
  assert.equal(view?.transit, '3 à 5 jours ouvrés');
  assert.equal(view?.details[2], 'livraison en 3 à 5 jours ouvrés');
  const [unknown] = shippingOptionViews([
    { ...fact, minDays: null, maxDays: null },
  ]);
  assert.equal(unknown?.transit, null);
});
