import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderAdminPasswordResetEmail } from '../src/emails/admin';

test('mot de passe admin : e-mail sûr avec lien unique', () => {
  const action =
    'https://lesterresdecaldera.fr/admin/nouveau-mot-de-passe?token=a%22b%3Cc';
  const email = renderAdminPasswordResetEmail({
    action,
    logo: 'https://lesterresdecaldera.fr/logo.png',
  });
  assert.equal(
    email.subject,
    'Nouveau mot de passe pour le back-office Caldera',
  );
  assert.ok(email.html.includes(action.replace('%22', '%22')));
  assert.doesNotMatch(email.html, /<script/i);
  assert.match(email.text, /valable une heure/i);
  assert.equal(email.text.match(/https:\/\//g)?.length, 1);
});
