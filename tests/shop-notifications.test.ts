import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  parseShopSnapshot,
  renderShopEmail,
  type ShopEmailSnapshot,
} from '../src/emails/shop';
import { isShopEmail, shopRecipient } from '../src/lib/email/shop';

const urls = {
  admin: 'https://boutique.example',
  logo: 'https://boutique.example/logo.png',
};
const base: ShopEmailSnapshot = {
  version: 1,
  orderId: '0b7c6c3e-6f2a-4a8e-9a55-0d6f1c2b3a4d',
  orderNumber: 'CAL-2026-ABCDEF0123456789ABCD',
  customer: {
    email: 'client@example.com',
    phone: '0600000000',
    name: 'Camille <b>Test</b>',
  },
  shippingMethod: 'Colissimo suivi',
  total: '65.80',
  shipping: '5.90',
  promotionCode: null,
  address: ['Camille Test', '1 rue des Tests', '75001 Paris', 'FR'],
  items: [
    {
      name: 'Coffret Dresseur d’élite',
      sku: 'ETB-FR',
      language: 'FR',
      quantity: 1,
      total: '59.90',
    },
  ],
};

test('notifications boutique : rendu, garde-fous et destinataire', async (t) => {
  await t.test(
    'nouvelle commande : articles, client, stock et lien admin',
    () => {
      const email = renderShopEmail(
        'SHOP_ORDER_PAID',
        parseShopSnapshot(
          structuredClone({
            ...base,
            stock: [
              { sku: 'ETB-FR', name: 'Coffret Dresseur d’élite', available: 0 },
            ],
          }),
        ),
        urls,
      );
      // Intl separates the amount and € with a narrow no-break space.
      assert.match(
        email.subject,
        /^Nouvelle commande CAL-2026-ABCDEF0123456789ABCD — 65,80\s€$/,
      );
      assert.equal(email.replyTo, 'client@example.com');
      assert.ok(
        email.html.includes(`${urls.admin}/admin/commandes/${base.orderId}`),
      );
      assert.ok(email.html.includes('Camille &lt;b&gt;Test&lt;/b&gt;'));
      assert.ok(!email.html.includes('<b>Test</b>'));
      assert.match(email.text, /1 × Coffret Dresseur d’élite \(ETB-FR, FR\)/);
      assert.match(email.text, /Coffret Dresseur d’élite \(ETB-FR\) — rupture/);
      assert.match(email.text, /0600000000/);
    },
  );

  await t.test('commande à vérifier : la cause est dite', () => {
    const stock = renderShopEmail(
      'SHOP_ORDER_REVIEW',
      { ...base, review: 'STOCK' },
      urls,
    );
    assert.match(stock.subject, /^À vérifier : commande CAL-/);
    assert.match(stock.text, /stock réservé ne couvre plus/);
    const stale = renderShopEmail(
      'SHOP_ORDER_REVIEW',
      { ...base, review: 'STALE_PAYMENT' },
      urls,
    );
    assert.match(stale.text, /Vérifiez dans Stripe/);
  });

  await t.test('retour client : motif, message et lien vers le retour', () => {
    const email = renderShopEmail(
      'SHOP_RETURN_REQUESTED',
      {
        ...base,
        returnRequest: {
          id: 'f1e2d3c4-b5a6-4789-8abc-def012345678',
          number: 'RET-2026-ABCD1234',
          reason: 'Rétractation (14 jours)',
          withdrawal: true,
          message: 'Je me rétracte.\nMerci',
          items: [{ name: 'Coffret Dresseur d’élite', quantity: 1 }],
        },
      },
      urls,
    );
    assert.match(email.subject, /^Rétractation RET-2026-ABCD1234 — commande /);
    assert.ok(
      email.html.includes(
        `${urls.admin}/admin/retours/f1e2d3c4-b5a6-4789-8abc-def012345678`,
      ),
    );
    assert.match(email.text, /Je me rétracte\.\nMerci/);
    assert.match(email.text, /14 jours après sa demande/);
    // The ready answer: to the customer, their words quoted.
    const reply = /href="(mailto:[^"?]+\?subject=[^"]+)"/.exec(email.html)![1]!;
    const url = new URL(reply.replaceAll('&amp;', '&'));
    assert.equal(decodeURIComponent(url.pathname), 'client@example.com');
    assert.equal(
      url.searchParams.get('subject'),
      'Votre demande RET-2026-ABCD1234 — commande CAL-2026-ABCDEF0123456789ABCD',
    );
    assert.match(url.searchParams.get('body')!, /^Bonjour Camille,/);
    assert.match(url.searchParams.get('body')!, /> Je me rétracte\./);
    assert.ok(!url.searchParams.get('body')!.includes('/admin/'));
  });

  await t.test('article abîmé : une réclamation, réponse en premier', () => {
    const email = renderShopEmail(
      'SHOP_RETURN_REQUESTED',
      {
        ...base,
        returnRequest: {
          id: 'f1e2d3c4-b5a6-4789-8abc-def012345678',
          number: 'RET-2026-ABCD1234',
          reason: 'Article abîmé à la réception',
          reasonCode: 'DAMAGED',
          withdrawal: false,
          message: 'Coin enfoncé.',
          items: [{ name: 'Coffret Dresseur d’élite', quantity: 1 }],
        },
      },
      urls,
    );
    assert.match(email.subject, /^Réclamation RET-2026-ABCD1234 — commande /);
    assert.match(email.html, /Nouvelle réclamation/);
    // The answer comes before the paperwork.
    assert.ok(
      email.html.indexOf('Répondre à Camille') <
        email.html.indexOf('Traiter le retour'),
    );
  });

  await t.test('remboursement refusé : montant et motif Stripe', () => {
    const email = renderShopEmail(
      'SHOP_REFUND_FAILED',
      {
        ...base,
        refund: { amount: '29.95', code: 'expired_or_canceled_card' },
      },
      urls,
    );
    assert.equal(
      email.subject,
      'Remboursement refusé — commande CAL-2026-ABCDEF0123456789ABCD',
    );
    assert.match(email.text, /29,95\s€.*expired_or_canceled_card/);
    assert.ok(email.html.includes('#remboursements'));
  });

  await t.test('snapshot invalide ou détail absent : refusé', () => {
    assert.throws(() => parseShopSnapshot({ ...base, version: 2 }));
    assert.throws(() => parseShopSnapshot({ ...base, items: [{ name: 'x' }] }));
    assert.throws(() => parseShopSnapshot({ ...base, review: 'AUTRE' }));
    assert.throws(() => renderShopEmail('SHOP_REFUND_FAILED', base, urls));
    assert.throws(() => renderShopEmail('ORDER_CONFIRMATION', base, urls));
  });

  await t.test('destinataire : adresse dédiée, sinon celle du contact', () => {
    const saved = {
      notification: process.env.NOTIFICATION_EMAIL_TO,
      contact: process.env.CONTACT_EMAIL_TO,
    };
    try {
      process.env.NOTIFICATION_EMAIL_TO = '';
      process.env.CONTACT_EMAIL_TO = ' contact@boutique.example ';
      assert.equal(shopRecipient(), 'contact@boutique.example');
      process.env.NOTIFICATION_EMAIL_TO = 'alertes@boutique.example';
      assert.equal(shopRecipient(), 'alertes@boutique.example');
      process.env.NOTIFICATION_EMAIL_TO = 'pas une adresse';
      process.env.CONTACT_EMAIL_TO = '';
      assert.equal(shopRecipient(), null);
    } finally {
      for (const [key, value] of [
        ['NOTIFICATION_EMAIL_TO', saved.notification],
        ['CONTACT_EMAIL_TO', saved.contact],
      ] as const)
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }
    assert.ok(isShopEmail('SHOP_ORDER_PAID'));
    assert.ok(!isShopEmail('ORDER_CONFIRMATION'));
  });
});
