import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { Webhook } from 'svix';
import {
  newsletterUnsubscribeHeaders,
  stockAlertUnsubscribeHeaders,
} from '../src/lib/email/unsubscribe-headers';
import { verifyNewsletterUnsubscribeToken } from '../src/lib/newsletter/tokens';
import { verifyStockAlertRemovalToken } from '../src/lib/stock-alerts/tokens';
import { GET, POST } from '../src/app/api/newsletter/unsubscribe/route';
import { POST as stockPost } from '../src/app/api/stock-alerts/unsubscribe/route';
import { POST as webhookPost } from '../src/app/api/webhooks/resend/route';
import { oneClickRequestError } from '../src/lib/email/one-click';
import { parseEnvelope } from '../src/lib/email/provider';
import { emailDeliveryFeedback } from '../src/lib/email/delivery-feedback';
import { renderAdminAccountEmail } from '../src/emails/admin';

test('désinscription : en-têtes signés distincts, GET sans effet et validation avant toute lecture DB', async (t) => {
  const original = {
    secret: process.env.BETTER_AUTH_SECRET,
    url: process.env.APP_URL,
  };
  process.env.BETTER_AUTH_SECRET =
    'test-deliverability-secret-at-least-32-characters';
  process.env.APP_URL = 'https://lesterresdecaldera.fr';
  t.after(() => {
    if (original.secret === undefined) delete process.env.BETTER_AUTH_SECRET;
    else process.env.BETTER_AUTH_SECRET = original.secret;
    if (original.url === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = original.url;
  });
  const id = randomUUID();
  const headers = newsletterUnsubscribeHeaders(id);
  const url = headers['List-Unsubscribe'].slice(1, -1);
  const token = new URL(url).searchParams.get('token');
  assert.equal(headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  assert.equal(verifyNewsletterUnsubscribeToken(token), id);
  assert.equal(verifyStockAlertRemovalToken(token), null);
  const stock = stockAlertUnsubscribeHeaders(id);
  const stockUrl = stock['List-Unsubscribe'].slice(1, -1);
  assert.equal(
    verifyStockAlertRemovalToken(new URL(stockUrl).searchParams.get('token')),
    id,
  );
  const get = await GET(new Request(url));
  assert.equal(get.status, 307);
  assert.equal(
    new URL(get.headers.get('location')!).pathname,
    '/newsletter/desinscription',
  );
  for (const action of [POST, stockPost]) {
    assert.equal(
      (await action(new Request(url, { method: 'POST', body: '{}' }))).status,
      415,
    );
    const options = {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    };
    assert.equal(
      (await action(new Request(url, { ...options, body: 'x'.repeat(300) })))
        .status,
      413,
    );
    assert.equal(
      (
        await action(
          new Request(url, { ...options, body: 'List-Unsubscribe=Wrong' }),
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await action(
          new Request(url, {
            ...options,
            body: 'List-Unsubscribe=One-Click&List-Unsubscribe=One-Click',
          }),
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await action(
          new Request('https://test/api/unsubscribe?token=forged', {
            ...options,
            body: 'List-Unsubscribe=One-Click',
          }),
        )
      ).status,
      400,
    );
  }
  assert.ok(
    !(
      'headers' in
      renderAdminAccountEmail('reset', {
        action: 'https://test/reset',
        logo: 'https://test/logo',
      })
    ),
  );
});

test('enveloppes : texte alternatif requis, injections refusées et champs non autorisés retirés', () => {
  const envelope = {
    from: 'Caldera <contact@example.com>',
    to: ['reader@example.com'],
    subject: 'Une nouvelle édition',
    html: '<p>Contenu utile</p>',
    text: 'Contenu utile',
  };
  assert.deepEqual(
    parseEnvelope({ ...envelope, bcc: ['hidden@example.com'] }),
    envelope,
  );
  for (const value of [
    { ...envelope, subject: 'Bonjour\r\nBcc: hidden@example.com' },
    { ...envelope, to: ['reader@example.com\r\nBcc: hidden@example.com'] },
    { ...envelope, text: '' },
    {
      ...envelope,
      headers: {
        'List-Unsubscribe': '<https://test>\r\nBcc: hidden@example.com',
      },
    },
    { ...envelope, headers: { Bcc: 'hidden@example.com' } },
    { ...envelope, tags: [{ name: 'bad\r\n', value: 'id' }] },
  ])
    assert.throws(() => parseEnvelope(value));
});

test('rebonds : seuls les échecs définitifs et plaintes actuels sont exploitables', () => {
  const event = {
    type: 'email.bounced',
    created_at: new Date().toISOString(),
    data: { email_id: randomUUID(), bounce: { type: 'Permanent' } },
  };
  assert.equal(emailDeliveryFeedback(event)?.reason, 'HARD_BOUNCE');
  assert.equal(
    emailDeliveryFeedback({ ...event, type: 'email.complained' })?.reason,
    'SPAM_COMPLAINT',
  );
  assert.equal(
    emailDeliveryFeedback({ ...event, type: 'email.suppressed' })?.reason,
    'SUPPRESSED',
  );
  assert.equal(
    emailDeliveryFeedback({
      ...event,
      data: { ...event.data, bounce: { type: 'Transient' } },
    }),
    null,
  );
  assert.equal(
    emailDeliveryFeedback({ ...event, type: 'email.delivery_delayed' }),
    null,
  );
  assert.equal(
    emailDeliveryFeedback({
      ...event,
      created_at: new Date(Date.now() - 91 * 86400000).toISOString(),
    }),
    null,
  );
  assert.equal(
    emailDeliveryFeedback({
      ...event,
      data: { email_id: 'not-a-provider-id' },
    }),
    null,
  );
});

test('webhook : la signature reste obligatoire lorsque le suivi marketing est désactivé', async (t) => {
  const saved = {
    flag: process.env.EMAIL_ENGAGEMENT_ENABLED,
    secret: process.env.RESEND_WEBHOOK_SECRET,
  };
  const secret = 'whsec_' + Buffer.alloc(32, 8).toString('base64');
  process.env.EMAIL_ENGAGEMENT_ENABLED = 'false';
  process.env.RESEND_WEBHOOK_SECRET = secret;
  t.after(() => {
    if (saved.flag === undefined) delete process.env.EMAIL_ENGAGEMENT_ENABLED;
    else process.env.EMAIL_ENGAGEMENT_ENABLED = saved.flag;
    if (saved.secret === undefined) delete process.env.RESEND_WEBHOOK_SECRET;
    else process.env.RESEND_WEBHOOK_SECRET = saved.secret;
  });
  const raw = JSON.stringify({
    type: 'email.opened',
    created_at: new Date().toISOString(),
    data: { email_id: randomUUID() },
  });
  const id = 'msg_' + randomUUID(),
    now = new Date();
  const headers = {
    'svix-id': id,
    'svix-timestamp': String(Math.floor(now.getTime() / 1000)),
    'svix-signature': new Webhook(secret).sign(id, now, raw),
  };
  assert.equal(
    (
      await webhookPost(
        new Request('https://test/api/webhooks/resend', {
          method: 'POST',
          headers,
          body: raw,
        }),
      )
    ).status,
    204,
  );
  assert.equal(
    (
      await webhookPost(
        new Request('https://test/api/webhooks/resend', {
          method: 'POST',
          headers: { ...headers, 'svix-signature': 'forged' },
          body: raw,
        }),
      )
    ).status,
    400,
  );
});

test('RFC 8058 : multipart pris en charge, fichiers et champs dupliqués refusés', async () => {
  const form = new FormData();
  form.set('List-Unsubscribe', 'One-Click');
  assert.equal(
    await oneClickRequestError(
      new Request('https://test', { method: 'POST', body: form }),
    ),
    null,
  );
  form.append('List-Unsubscribe', 'One-Click');
  assert.equal(
    await oneClickRequestError(
      new Request('https://test', { method: 'POST', body: form }),
    ),
    400,
  );
  form.set('List-Unsubscribe', new Blob(['One-Click']), 'file');
  assert.equal(
    await oneClickRequestError(
      new Request('https://test', { method: 'POST', body: form }),
    ),
    400,
  );
});
