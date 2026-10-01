import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  describePromotion,
  evaluatePromotion,
  normalizePromotionCode,
  splitCents,
  type PromotionLine,
  type PromotionRule,
} from '../src/lib/promotions/pricing';
import { categoryDescendants } from '../src/lib/promotions/service';

const now = new Date('2026-10-01T10:00:00Z');
const rule = (overrides: Partial<PromotionRule> = {}): PromotionRule => ({
  id: 'p',
  code: 'BIENVENUE',
  label: 'Bienvenue',
  type: 'PERCENTAGE',
  percentOff: 10,
  amountOffCents: null,
  minimumSubtotalCents: null,
  startsAt: null,
  endsAt: null,
  isActive: true,
  maxRedemptions: null,
  maxPerCustomer: null,
  gameId: null,
  categoryIds: null,
  ...overrides,
});
const lines: PromotionLine[] = [
  {
    id: 'a',
    unitCents: 5990,
    quantity: 2,
    gameId: 'pokemon',
    categoryId: 'etb',
  },
  {
    id: 'b',
    unitCents: 1999,
    quantity: 1,
    gameId: 'jeu-test',
    categoryId: 'deck',
  },
];
const unused = { total: 0, customer: 0 };
const run = (
  promotion: PromotionRule,
  shippingCents: number | null = 690,
  usage = unused,
) => evaluatePromotion(promotion, { lines, shippingCents, usage, now });

test('codes promo : saisie normalisée', () => {
  assert.equal(normalizePromotionCode(' bienvenue-10 '), 'BIENVENUE-10');
  assert.equal(normalizePromotionCode('noël 2026'), null);
  assert.equal(normalizePromotionCode('Ｎ O E L 26'), 'NOEL26');
  for (const invalid of ['', 'AB', '-ABC', 'ABC-', 'A'.repeat(33), 42, null])
    assert.equal(normalizePromotionCode(invalid), null, String(invalid));
});

test('codes promo : répartition exacte au centime', () => {
  assert.deepEqual(splitCents(100, [1, 1, 1]), [34, 33, 33]);
  assert.deepEqual(splitCents(0, [5, 5]), [0, 0]);
  assert.deepEqual(splitCents(7, [0, 0]), [0, 0]);
  const parts = splitCents(1398, [11980, 1999]);
  assert.equal(parts[0]! + parts[1]!, 1398);
});

test('codes promo : pourcentage, montant fixe, livraison offerte', () => {
  const percent = run(rule());
  assert.ok(percent.ok);
  // 10 % de 139,79 € = 13,98 € (arrondi au centime le plus proche).
  assert.equal(percent.itemsCents, 1398);
  assert.equal(
    percent.items.reduce((sum, item) => sum + item.cents, 0),
    1398,
  );
  assert.equal(percent.shippingCents, 0);

  const fixed = run(
    rule({ type: 'FIXED_AMOUNT', percentOff: null, amountOffCents: 500 }),
  );
  assert.ok(fixed.ok);
  assert.equal(fixed.itemsCents, 500);

  const shipping = run(rule({ type: 'FREE_SHIPPING', percentOff: null }));
  assert.ok(shipping.ok);
  assert.equal(shipping.itemsCents, 0);
  assert.equal(shipping.shippingCents, 690);
  // Livraison pas encore choisie : rien à offrir pour l’instant.
  const later = run(rule({ type: 'FREE_SHIPPING', percentOff: null }), null);
  assert.ok(later.ok);
  assert.equal(later.shippingCents, 0);
});

test('codes promo : jeu, catégorie et minimum sur les articles concernés', () => {
  const pokemon = run(rule({ gameId: 'pokemon' }));
  assert.ok(pokemon.ok);
  assert.deepEqual(pokemon.items, [{ id: 'a', cents: 1198 }]);

  const deck = run(rule({ categoryIds: new Set(['deck']) }));
  assert.ok(deck.ok);
  assert.deepEqual(deck.items, [{ id: 'b', cents: 200 }]);

  const none = run(rule({ gameId: 'magic' }));
  assert.equal(none.ok, false);
  assert.match(!none.ok ? none.reason : '', /aucun article/);

  const minimum = run(rule({ gameId: 'jeu-test', minimumSubtotalCents: 5000 }));
  assert.equal(minimum.ok, false);
  assert.match(
    !minimum.ok ? minimum.reason : '',
    /dès 50,00\s€ d’articles concernés/,
  );
  assert.ok(run(rule({ minimumSubtotalCents: 13979 })).ok);

  // Un montant fixe ne dépasse jamais les articles concernés.
  const capped = run(
    rule({
      type: 'FIXED_AMOUNT',
      percentOff: null,
      amountOffCents: 10000,
      gameId: 'jeu-test',
    }),
  );
  assert.ok(capped.ok);
  assert.equal(capped.itemsCents, 1999);
});

test('codes promo : dates, activation et limites d’utilisation', () => {
  const reason = (result: ReturnType<typeof run>) =>
    result.ok ? '' : result.reason;
  assert.match(reason(run(rule({ isActive: false }))), /n’est pas valable/);
  assert.match(
    reason(run(rule({ startsAt: new Date('2026-10-02T00:00:00Z') }))),
    /sera valable à partir du 2 octobre 2026/,
  );
  assert.match(reason(run(rule({ endsAt: now }))), /a expiré/);
  assert.ok(run(rule({ endsAt: new Date(now.getTime() + 1) })).ok);
  assert.match(
    reason(run(rule({ maxRedemptions: 3 }), 690, { total: 3, customer: 0 })),
    /limite d’utilisation/,
  );
  assert.ok(
    run(rule({ maxRedemptions: 3 }), 690, { total: 2, customer: 0 }).ok,
  );
  assert.match(
    reason(run(rule({ maxPerCustomer: 1 }), 690, { total: 5, customer: 1 })),
    /déjà utilisé/,
  );
});

test('codes promo : jamais moins de 0,50 € à payer', () => {
  const cheap: PromotionLine[] = [
    { id: 'x', unitCents: 100, quantity: 1, gameId: null, categoryId: 'c' },
  ];
  const all = rule({
    type: 'FIXED_AMOUNT',
    percentOff: null,
    amountOffCents: 100,
  });
  const withShipping = evaluatePromotion(all, {
    lines: cheap,
    shippingCents: 0,
    usage: unused,
    now,
  });
  assert.equal(withShipping.ok, false);
  assert.match(!withShipping.ok ? withShipping.reason : '', /0,50/);
  // Avec des frais de port payants, il reste assez à régler.
  assert.ok(
    evaluatePromotion(all, {
      lines: cheap,
      shippingCents: 490,
      usage: unused,
      now,
    }).ok,
  );
});

test('codes promo : libellés et catégories descendantes', () => {
  assert.equal(
    describePromotion({
      type: 'PERCENTAGE',
      percentOff: 15,
      amountOffCents: null,
    }),
    '−15 %',
  );
  assert.match(
    describePromotion({
      type: 'FIXED_AMOUNT',
      percentOff: null,
      amountOffCents: 500,
    }),
    /^−5,00\s€$/,
  );
  assert.equal(
    describePromotion({
      type: 'FREE_SHIPPING',
      percentOff: null,
      amountOffCents: null,
    }),
    'Livraison offerte',
  );
  const tree = [
    { id: 'root', parentId: null },
    { id: 'child', parentId: 'root' },
    { id: 'grandchild', parentId: 'child' },
    { id: 'other', parentId: null },
  ];
  assert.deepEqual([...categoryDescendants('root', tree)].sort(), [
    'child',
    'grandchild',
    'root',
  ]);
  assert.deepEqual([...categoryDescendants('other', tree)], ['other']);
});
