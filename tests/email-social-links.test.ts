import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DISCORD_INVITE_URL } from '../src/data/community';
import { INSTAGRAM_PROFILE_URL } from '../src/lib/social';
import {
  renderAccountEmail,
  type AccountEmailKind,
} from '../src/emails/account';
import {
  renderAdminAccountEmail,
  type AdminEmailKind,
} from '../src/emails/admin';
import { renderEmail, type EmailSnapshot } from '../src/emails/templates';
import { renderShopEmail, type ShopEmailSnapshot } from '../src/emails/shop';
import { renderContactEmail } from '../src/emails/contact';
import { renderNewsletterConfirmationEmail } from '../src/emails/newsletter';
import { renderNewsletterCampaignEmail } from '../src/emails/newsletter-campaign';
import {
  renderStockAlertConfirmationEmail,
  renderStockAlertNotificationEmail,
} from '../src/emails/stock-alert';
import { customerReplyLink } from '../src/emails/reply';

const urls = {
  action: 'https://caldera.example/verification#token=private-token',
  reset: 'https://caldera.example/reset',
  logo: 'https://caldera.example/logo.png',
  order: 'https://caldera.example/commande/test',
  admin: 'https://caldera.example',
  site: 'https://caldera.example',
  confirmation: 'https://caldera.example/confirmation#token=private-token',
  removal: 'https://caldera.example/annuler#token=private-token',
  product: 'https://caldera.example/produit/test',
  unsubscribe: 'https://caldera.example/desinscription#token=private-token',
};
const order: EmailSnapshot = {
  version: 1,
  orderNumber: 'CAL-2026-ABCDEF0123456789ABCD',
  publicId: 'test',
  shippingMethod: 'Colissimo',
  subtotal: '59.90',
  shipping: '4.90',
  total: '64.80',
  address: [],
  items: [],
  shipment: null,
  refund: { amount: '59.90', shipping: '0', items: [] },
  returnRequest: {
    number: 'RET-2026-ABCD1234',
    reason: 'Article abîmé',
    withdrawal: false,
    requestedAt: '2026-10-01T10:00:00Z',
    items: [{ name: 'Coffret', quantity: 1 }],
    resolution: 'Votre demande a été traitée.',
    replacement: {
      carrier: 'Colissimo',
      trackingNumber: null,
      trackingUrl: null,
    },
  },
};
const shop: ShopEmailSnapshot = {
  version: 1,
  orderId: 'test',
  orderNumber: order.orderNumber,
  customer: { email: 'client@example.test', phone: null, name: 'Camille' },
  shippingMethod: order.shippingMethod,
  total: order.total,
  shipping: order.shipping,
  promotionCode: null,
  address: [],
  items: [],
  review: 'STOCK',
  returnRequest: {
    id: 'test',
    number: 'RET-2026-ABCD1234',
    reason: 'Article abîmé',
    withdrawal: false,
    message: 'Merci de vérifier.',
    items: [],
  },
  refund: { amount: '59.90', code: 'test' },
};

function assertSocialLinks(email: { html: string; text: string }) {
  for (const [label, url] of [
    ['Discord', DISCORD_INVITE_URL],
    ['Instagram', INSTAGRAM_PROFILE_URL],
  ] as const) {
    // Check direct clickable anchors, excluding encoded URLs in prepared mailto replies.
    assert.equal(
      email.html.split(`href="${url}"`).length - 1,
      1,
      `${label}: one HTML footer link`,
    );
    assert.equal(
      email.text.split(url).length - 1,
      1,
      `${label}: one plain-text link`,
    );
    assert.ok(email.text.includes(`${label} : ${url}`));
    assert.ok(
      email.html.indexOf(`href="${url}"`) >
        email.html.lastIndexOf('border-top:1px solid'),
      `${label}: link belongs to the footer`,
    );
  }
}

test('official social links appear once in every automated email, in HTML and plain text', async (t) => {
  for (const kind of [
    'verify',
    'reset',
    'existing',
    'password-changed',
  ] satisfies AccountEmailKind[]) {
    await t.test(`customer account: ${kind}`, () => {
      const email = renderAccountEmail(kind, urls);
      assertSocialLinks(email);
      assert.ok(email.html.includes(`href="${urls.action}"`));
      assert.ok(email.text.includes(urls.action));
    });
  }
  for (const kind of ['reset', 'password-changed'] satisfies AdminEmailKind[]) {
    await t.test(`admin account: ${kind}`, () =>
      assertSocialLinks(renderAdminAccountEmail(kind, urls)),
    );
  }
  for (const kind of [
    'ORDER_CONFIRMATION',
    'ORDER_SHIPPED',
    'ORDER_REFUNDED',
    'RETURN_REQUESTED',
    'RETURN_APPROVED',
    'RETURN_REJECTED',
    'RETURN_RECEIVED',
    'RETURN_REPLACED',
  ] as const) {
    await t.test(kind, () => assertSocialLinks(renderEmail(kind, order, urls)));
  }
  for (const kind of [
    'SHOP_ORDER_PAID',
    'SHOP_ORDER_REVIEW',
    'SHOP_RETURN_REQUESTED',
    'SHOP_REFUND_FAILED',
  ] as const) {
    await t.test(kind, () => {
      const email = renderShopEmail(kind, shop, urls);
      assertSocialLinks(email);
      assert.equal(email.replyTo, shop.customer.email);
    });
  }
  await t.test('contact notification', () =>
    assertSocialLinks(
      renderContactEmail(
        {
          name: 'Camille',
          email: 'client@example.test',
          topic: 'Question',
          orderNumber: '',
          message: 'Bonjour.',
        },
        urls,
      ),
    ),
  );
  const product = { name: 'Coffret', language: 'Français', price: '59,90 €' };
  await t.test('stock confirmation', () =>
    assertSocialLinks(renderStockAlertConfirmationEmail(product, urls)),
  );
  await t.test('stock notification', () =>
    assertSocialLinks(renderStockAlertNotificationEmail(product, urls)),
  );
  await t.test('newsletter confirmation', () =>
    assertSocialLinks(renderNewsletterConfirmationEmail(urls)),
  );
  await t.test(
    'newsletter campaign preserves unsubscribe and content preview',
    () => {
      const email = renderNewsletterCampaignEmail(
        {
          subject: 'Actualités',
          preheader: null,
          heading: 'Caldera',
          bodyMarkdown: 'Nos actualités.',
          ctaLabel: 'Découvrir',
          ctaUrl: '/actualites',
        },
        urls,
      );
      assertSocialLinks(email);
      assert.ok(email.html.includes(`href="${urls.unsubscribe}"`));
      assert.ok(email.text.endsWith(`Se désinscrire : ${urls.unsubscribe}`));
      assert.ok(
        email.html.indexOf(`href="${urls.unsubscribe}"`) >
          email.html.indexOf(`href="${INSTAGRAM_PROFILE_URL}"`),
      );
      assert.ok(!email.contentHtml.includes(DISCORD_INVITE_URL));
    },
  );
});

test('prepared customer replies include social links in the signature, before the quoted message', () => {
  const href = customerReplyLink({
    to: 'client@example.test',
    subject: 'Votre demande',
    name: 'Camille',
    quote: 'Ma question.',
  });
  const body = new URL(href).searchParams.get('body')!;
  for (const url of [DISCORD_INVITE_URL, INSTAGRAM_PROFILE_URL]) {
    assert.equal(body.split(url).length - 1, 1);
    assert.ok(body.indexOf(url) > body.indexOf('Bien à vous,'));
    assert.ok(body.indexOf(url) < body.indexOf('Votre message :'));
  }
});
