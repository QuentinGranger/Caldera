import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import {
  renderStockAlertConfirmationEmail,
  renderStockAlertNotificationEmail,
} from '../src/emails/stock-alert';

process.env.BETTER_AUTH_SECRET ||= randomBytes(32).toString('hex');
const tokens = await import('../src/lib/stock-alerts/tokens');

const product = {
  name: 'ETB <Terres> & "Braise"',
  language: 'Français',
  price: '59,90 €',
};

test('alertes : e-mails échappés, lien unique, version texte', () => {
  const confirmation = renderStockAlertConfirmationEmail(product, {
    confirmation: 'https://lesterresdecaldera.fr/alertes/confirmation#token=a',
    removal: 'https://lesterresdecaldera.fr/alertes/desinscription#token=b',
    logo: 'https://lesterresdecaldera.fr/logo.png',
  });
  assert.equal(
    confirmation.subject,
    'Confirmez votre alerte de retour en stock',
  );
  assert.ok(
    confirmation.html.includes('ETB &lt;Terres&gt; &amp; &quot;Braise&quot;'),
  );
  assert.doesNotMatch(confirmation.html, /<Terres>/);
  assert.match(confirmation.text, /valable 24 heures/);
  assert.match(confirmation.text, /Annuler cette alerte : https:/);
  const notification = renderStockAlertNotificationEmail(product, {
    product: 'https://lesterresdecaldera.fr/produit/etb?variant=ETB-FR',
    logo: 'https://lesterresdecaldera.fr/logo.png',
  });
  assert.equal(notification.subject, `De retour en stock : ${product.name}`);
  assert.match(notification.text, /une seule fois/);
  assert.match(notification.text, /59,90 €/);
  // No line break can reach the subject header.
  assert.doesNotMatch(
    renderStockAlertNotificationEmail(
      { ...product, name: 'A\r\nBcc: x@y.z' },
      { product: 'https://x', logo: 'https://x' },
    ).subject,
    /[\r\n]/,
  );
});

test('alertes : lien de suppression signé, jeton de confirmation haché', () => {
  const id = randomUUID();
  const removal = tokens.stockAlertRemovalToken(id);
  assert.equal(tokens.verifyStockAlertRemovalToken(removal), id);
  assert.equal(
    tokens.verifyStockAlertRemovalToken(
      `${randomUUID()}.${removal.split('.')[1]}`,
    ),
    null,
  );
  assert.equal(
    tokens.verifyStockAlertRemovalToken(`${id}.${'0'.repeat(64)}`),
    null,
  );
  assert.equal(tokens.verifyStockAlertRemovalToken('nimporte'), null);
  // Links carry their token in the fragment only.
  assert.match(
    tokens.stockAlertRemovalUrl(id),
    /\/alertes\/desinscription#token=/,
  );
  const token = tokens.newStockAlertToken();
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.match(tokens.stockAlertTokenHash(token), /^[0-9a-f]{64}$/);
  assert.notEqual(tokens.stockAlertTokenHash(token), token);
  assert.match(
    tokens.stockAlertConfirmationUrl(token),
    /\/alertes\/confirmation#token=/,
  );
});
