import assert from 'node:assert/strict';
import { test } from 'node:test';
import { franchiseStatus, projectYear } from '../src/lib/tax/franchise';

const thresholds = { baseCents: 8_500_000, majoredCents: 9_350_000 };

test('franchise : niveaux selon le chiffre d’affaires de l’année et de la précédente', () => {
  const level = (currentCents: number, previousCents = 0) =>
    franchiseStatus({ currentCents, previousCents, ...thresholds }).level;
  assert.equal(level(0), 'OK');
  assert.equal(level(6_799_999), 'OK');
  assert.equal(level(6_800_000), 'NEAR');
  assert.equal(level(8_500_000), 'NEAR');
  assert.equal(level(8_500_001), 'BASE');
  assert.equal(level(9_350_000), 'BASE');
  assert.equal(level(9_350_001), 'MAJORED');
  // L’an dernier compte aussi.
  assert.equal(level(100, 8_600_000), 'BASE');
  assert.equal(level(100, 9_400_000), 'MAJORED');
  assert.match(
    franchiseStatus({
      currentCents: 9_400_000,
      previousCents: 0,
      ...thresholds,
    }).message,
    /dès le jour du dépassement/,
  );
});

test('franchise : projection linéaire sur l’année', () => {
  // Au 1er juillet 2026 (181 jours écoulés), 50 000 € → ~100 829 €.
  const projected = projectYear(5_000_000, new Date('2026-07-01T00:00:00Z'));
  assert.equal(projected, Math.round((5_000_000 * 365) / 181));
  // Premier jour : pas de division par zéro.
  assert.equal(projectYear(1000, new Date('2026-01-01T00:00:00Z')), 365000);
});
