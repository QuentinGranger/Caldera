import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderAccountEmail } from '../src/emails/account';
import { customerOrdersWhere } from '../src/lib/account/queries';
import {
  PASSWORD_MAX,
  PASSWORD_MIN,
  accountEmail,
  accountName,
  accountPassword,
  safeReturnPath,
} from '../src/lib/account/validation';

test('compte : e-mail normalisé, nom borné, mot de passe par longueur seule', () => {
  assert.equal(accountEmail('  Alice@Exemple.FR '), 'alice@exemple.fr');
  for (const bad of [
    '',
    'alice',
    'a@b',
    'a b@c.fr',
    `${'a'.repeat(65)}@c.fr`,
    42,
  ])
    assert.equal(accountEmail(bad), null, String(bad));
  assert.equal(accountName('  Jeanne   Dupont '), 'Jeanne Dupont');
  assert.equal(accountName('x'.repeat(81)), null);
  assert.equal(accountName('Nom\u0000'), null);
  assert.equal(accountName('   '), null);
  assert.equal(accountPassword('a'.repeat(PASSWORD_MIN - 1)), null);
  assert.equal(accountPassword('a'.repeat(PASSWORD_MAX + 1)), null);
  // No composition rule: a long passphrase is accepted as is.
  assert.equal(
    accountPassword('cheval correct agrafe'),
    'cheval correct agrafe',
  );
});

test('compte : retour après connexion limité aux chemins du site', () => {
  assert.equal(safeReturnPath('/checkout'), '/checkout');
  assert.equal(safeReturnPath('/produit/etb?x=1'), '/produit/etb?x=1');
  for (const bad of [
    '//exemple.com',
    '/\\exemple.com',
    'https://exemple.com',
    'javascript:alert(1)',
    '/api/cron/maintenance',
    '/a\nb',
    undefined,
    ['/checkout'],
  ])
    assert.equal(safeReturnPath(bad), '/compte', String(bad));
});

test('compte : historique par compte, et par e-mail seulement une fois vérifié', () => {
  const verified = customerOrdersWhere({
    id: 'c1',
    email: 'alice@exemple.fr',
    emailVerified: true,
  });
  const serialized = JSON.stringify(verified);
  assert.match(serialized, /"customerId":"c1"/);
  assert.match(serialized, /"equals":"alice@exemple.fr","mode":"insensitive"/);
  // Real orders only: paid, or payment still being confirmed.
  assert.match(serialized, /"paidAt":\{"not":null\}/);
  assert.doesNotMatch(
    JSON.stringify(
      customerOrdersWhere({
        id: 'c1',
        email: 'alice@exemple.fr',
        emailVerified: false,
      }),
    ),
    /alice@exemple\.fr/,
  );
});

test('compte : e-mails échappés, lien unique, version texte', () => {
  const email = renderAccountEmail('verify', {
    action: 'https://lesterresdecaldera.fr/compte/verification?token=a"b<c',
    logo: 'https://lesterresdecaldera.fr/logo.png',
  });
  assert.equal(email.subject, 'Confirmez votre adresse e-mail');
  assert.ok(email.html.includes('token=a&quot;b&lt;c'));
  assert.ok(!email.html.includes('a"b<c'));
  assert.ok(email.text.includes('token=a"b<c'));
  assert.match(email.text, /valable 24 heures/);
  const existing = renderAccountEmail('existing', {
    action: 'https://lesterresdecaldera.fr/compte/connexion',
    logo: 'https://lesterresdecaldera.fr/logo.png',
    reset: 'https://lesterresdecaldera.fr/compte/mot-de-passe-oublie',
  });
  assert.match(existing.text, /Mot de passe oublié : https:/);
  assert.doesNotMatch(existing.html, /<script/i);
});
