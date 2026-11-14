import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parisMidnightUtc, previousParisDay, validDay, splitProductLineHt } from '../src/lib/finance/dailySnapshot';

test('Date du rapport : validité stricte', () => {
  assert.equal(validDay('2026-11-13'), true);
  assert.equal(validDay('2026-02-29'), false);
  assert.equal(validDay('2026-2-9'), false);
  assert.equal(validDay('2024-02-29'), true);
});
test('Lendemain local et heure de Paris', () => {
  assert.equal(previousParisDay(new Date('2026-11-14T07:00:00Z')), '2026-11-13');
  assert.equal(parisMidnightUtc('2026-11-14').toISOString(), '2026-11-13T23:00:00.000Z');
  assert.equal(parisMidnightUtc('2026-07-14').toISOString(), '2026-07-13T22:00:00.000Z');
});
test('Changement heure hiver : journée de 25 heures', () => {
  const start = parisMidnightUtc('2026-10-25');
  const end = parisMidnightUtc('2026-10-26');
  assert.equal((end.getTime() - start.getTime()) / 3600000, 25);
});
test('Changement heure été : journée de 23 heures', () => {
  const start = parisMidnightUtc('2027-03-28');
  const end = parisMidnightUtc('2027-03-29');
  assert.equal((end.getTime() - start.getTime()) / 3600000, 23);
});

test('Remise TTC : CA brut, remise et net exprimes sur la meme base HT', () => {
  const split = splitProductLineHt({
    lineTotal: 120,
    discountAmount: 20,
    taxAmount: 16.67,
    taxRate: 20,
  });
  assert.ok(Math.abs(split.grossHt - 100) < 0.01);
  assert.ok(Math.abs(split.discountHt - 16.666) < 0.01);
  assert.ok(Math.abs(split.grossHt - split.discountHt - 83.33) < 0.01);
});

test('Franchise de TVA : aucune TVA inventee', () => {
  const split = splitProductLineHt({
    lineTotal: 100,
    discountAmount: 20,
    taxAmount: 0,
    taxRate: null,
  });
  assert.equal(split.grossHt, 100);
  assert.equal(split.discountHt, 20);
  assert.equal(split.netHt, 80);
});
