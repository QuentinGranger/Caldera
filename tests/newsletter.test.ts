import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { renderNewsletterConfirmationEmail } from '../src/emails/newsletter';

process.env.BETTER_AUTH_SECRET ||= randomBytes(32).toString('hex');

const {
  newNewsletterConfirmationToken,
  newsletterTokenHash,
  newsletterUnsubscribeToken,
  verifyNewsletterUnsubscribeToken,
} = await import('../src/lib/newsletter/tokens');

test('newsletter : jetons aléatoires hachés et désinscription signée', () => {
  const confirmation = newNewsletterConfirmationToken();
  assert.match(confirmation, /^[A-Za-z0-9_-]{43}$/);
  assert.match(newsletterTokenHash(confirmation), /^[a-f0-9]{64}$/);
  assert.ok(!newsletterTokenHash(confirmation).includes(confirmation));

  const id = randomUUID();
  const unsubscribe = newsletterUnsubscribeToken(id);
  assert.equal(verifyNewsletterUnsubscribeToken(unsubscribe), id);
  // Always a different last hex digit: a signature ending in 0 must not
  // give back the genuine token (that made this test fail 1 time in 16).
  const tampered = `${unsubscribe.slice(0, -1)}${unsubscribe.endsWith('0') ? '1' : '0'}`;
  assert.notEqual(tampered, unsubscribe);
  assert.equal(verifyNewsletterUnsubscribeToken(tampered), null);
  assert.equal(verifyNewsletterUnsubscribeToken('invalide'), null);
});

test('newsletter : e-mail de confirmation échappé et version texte', () => {
  const confirmation =
    'https://lesterresdecaldera.fr/newsletter/confirmation?token=a"b<c';
  const email = renderNewsletterConfirmationEmail({
    confirmation,
    logo: 'https://lesterresdecaldera.fr/logo.png',
  });
  assert.equal(
    email.subject,
    'Confirmez votre inscription aux nouvelles de Caldera',
  );
  assert.ok(email.html.includes('token=a&quot;b&lt;c'));
  assert.ok(!email.html.includes('token=a"b<c'));
  assert.ok(email.text.includes(confirmation));
  assert.match(email.text, /valable 24 heures/);
  assert.doesNotMatch(email.html, /<script/i);
});
