import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderAdminPasswordResetEmail } from '../src/emails/admin';
import { DISCORD_INVITE_URL } from '../src/data/community';
import { INSTAGRAM_PROFILE_URL } from '../src/lib/social';

test('mot de passe admin : e-mail sûr avec lien de récupération unique', () => {
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
  assert.equal(email.html.split(`href="${action}"`).length - 1, 1);
  assert.equal(email.text.split(action).length - 1, 1);
  assert.deepEqual(email.text.match(/https:\/\/\S+/g), [
    action,
    DISCORD_INVITE_URL,
    INSTAGRAM_PROFILE_URL,
  ]);
});
