import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderEmail, type EmailSnapshot } from '../src/emails/templates';

const urls = {
  order: 'https://boutique.example/commande/x',
  logo: 'https://boutique.example/logo.png',
};
const base: EmailSnapshot = {
  version: 1,
  orderNumber: 'CAL-2026-ABCDEF0123456789ABCD',
  publicId: 'x',
  shippingMethod: 'Colissimo',
  subtotal: '59.90',
  shipping: '4.90',
  total: '64.80',
  address: [],
  items: [],
  shipment: null,
};
const request = {
  number: 'RET-2026-ABCD1234',
  reason: 'Article abîmé à la réception',
  withdrawal: false,
  requestedAt: '2026-10-01T10:00:00.000Z',
  items: [{ name: 'Coffret Dresseur d’élite', quantity: 1 }],
  resolution: 'Les frais de retour sont à votre charge.',
};

test('retours : colis reçu et remplacement expédié', async (t) => {
  await t.test('colis reçu : sans répéter la réponse précédente', () => {
    const email = renderEmail(
      'RETURN_RECEIVED',
      { ...base, returnRequest: request },
      urls,
    );
    assert.match(email.subject, /^Colis de retour reçu RET-2026-ABCD1234/);
    assert.match(email.text, /est bien arrivé/);
    assert.match(email.text, /revenons vers vous par e-mail/);
    assert.ok(!email.text.includes('frais de retour sont à votre charge'));
  });

  await t.test('rétractation reçue : date limite de remboursement', () => {
    const email = renderEmail(
      'RETURN_RECEIVED',
      { ...base, returnRequest: { ...request, withdrawal: true } },
      urls,
    );
    // CGV art. 14: 14 days after the request of 1 October.
    assert.match(email.text, /au plus tard le 15 octobre 2026/);
  });

  await t.test('remplacement : suivi et message du jour seulement', () => {
    const email = renderEmail(
      'RETURN_REPLACED',
      {
        ...base,
        returnRequest: {
          ...request,
          resolution: 'Toutes nos excuses.',
          replacement: {
            carrier: 'Colissimo',
            trackingNumber: '8R00012345',
            trackingUrl: 'https://www.laposte.fr/outils/suivre-vos-envois',
          },
        },
      },
      urls,
    );
    assert.match(email.subject, /^Remplacement expédié RET-2026-ABCD1234/);
    assert.match(email.text, /Colissimo · suivi 8R00012345/);
    assert.match(email.text, /Toutes nos excuses\./);
    assert.ok(email.html.includes('Suivre mon colis'));
    assert.ok(!email.text.includes('Motif :'));
  });
});
