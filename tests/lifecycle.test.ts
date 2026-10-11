import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import {
  cartStage,
  commercialFrequencyAllowed,
  DAY,
  lowStock,
  LIFECYCLE_KINDS,
} from '../src/lib/lifecycle/policy';
import { renderLifecycleEmail } from '../src/emails/lifecycle';
import {
  recoveryToken,
  verifyRecoveryToken,
  recoveryUrl,
} from '../src/lib/lifecycle/tokens';
test('cadence : J+1, dernier rappel J+4, jamais avant ni après J+7', () => {
  const start = new Date('2026-10-11T10:00:00Z');
  const at = (days: number) => new Date(start.getTime() + days * DAY);
  assert.equal(cartStage(start, at(0.99)), null);
  assert.equal(cartStage(start, at(1)), 'CART_FIRST');
  assert.equal(cartStage(start, at(3.5)), null);
  assert.equal(cartStage(start, at(4)), 'CART_SECOND');
  assert.equal(cartStage(start, at(7)), null);
  assert.equal(lowStock(3, 4), true);
  assert.equal(lowStock(4, 4), false);
  assert.equal(lowStock(1, 0), false);
  assert.equal(lowStock(0, 2), false);
  assert.equal(commercialFrequencyAllowed([at(1)], at(3)), false);
  assert.equal(
    commercialFrequencyAllowed([at(1), at(7), at(14)], at(20)),
    false,
  );
  assert.equal(commercialFrequencyAllowed([at(1)], at(4)), true);
});
test('tous les scénarios : texte, HTML échappé, liens sociaux et désinscription', () => {
  for (const kind of LIFECYCLE_KINDS) {
    const rendered = renderLifecycleEmail(
      kind,
      [
        {
          name: 'Produit <script>dangereux</script>',
          price: '19,90 €',
          url: 'https://lesterresdecaldera.fr/produit/test',
          stock: 3,
        },
      ],
      {
        action: 'https://lesterresdecaldera.fr/catalogue',
        unsubscribe: 'https://lesterresdecaldera.fr/newsletter/desinscription',
        preferences: 'https://lesterresdecaldera.fr/compte/profil',
        logo: 'https://lesterresdecaldera.fr/logo.png',
      },
    );
    assert.ok(rendered.subject);
    assert.ok(!rendered.html.includes('<script>'));
    assert.ok(rendered.html.includes('&lt;script&gt;'));
    assert.ok(rendered.text.includes('Désinscription'));
    assert.ok(rendered.text.includes('instagram.com'));
    assert.ok(rendered.text.includes('discord'));
    assert.ok(rendered.html.includes('19,90'));
  }
});
test('reprise : signature, échéance et isolation des liens sans secret en query', () => {
  process.env.BETTER_AUTH_SECRET ??= 'qa-secret-never-for-production-123456789';
  const id = randomUUID(),
    now = new Date(),
    expiry = new Date(now.getTime() + DAY),
    token = recoveryToken(id, expiry);
  assert.equal(verifyRecoveryToken(token, now), id);
  assert.equal(
    verifyRecoveryToken(token, new Date(expiry.getTime() + 1)),
    null,
  );
  assert.equal(verifyRecoveryToken(token.replace(id, randomUUID()), now), null);
  assert.equal(verifyRecoveryToken(token + 'x', now), null);
  assert.ok(recoveryUrl(id, expiry).includes('#token='));
  assert.ok(!recoveryUrl(id, expiry).includes('?token='));
});
