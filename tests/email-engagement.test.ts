import assert from 'node:assert/strict';
import { test } from 'node:test';
import { marketingSender, trackingAllowed } from '../src/lib/email/engagement';
import { POST } from '../src/app/api/webhooks/resend/route';
const consent = {
  status: 'ACTIVE',
  emailTracking: true,
  emailTrackingConsentAt: new Date(),
};
test('suivi email : accord distinct, expire après 180 jours, domaine dédié obligatoire', () => {
  const saved = {
    flag: process.env.EMAIL_ENGAGEMENT_ENABLED,
    from: process.env.MARKETING_EMAIL_FROM,
  };
  try {
    process.env.EMAIL_ENGAGEMENT_ENABLED = 'true';
    process.env.MARKETING_EMAIL_FROM =
      'Caldera <lettre@news.lesterresdecaldera.fr>';
    assert.equal(marketingSender(consent, 'tx@example.com').tracked, true);
    assert.equal(
      marketingSender({ ...consent, emailTracking: false }, 'tx@example.com')
        .from,
      'tx@example.com',
    );
    assert.equal(trackingAllowed({ ...consent, status: 'PENDING' }), false);
    assert.equal(
      trackingAllowed({
        ...consent,
        emailTrackingConsentAt: new Date(Date.now() - 181 * 86400000),
      }),
      false,
    );
    process.env.MARKETING_EMAIL_FROM =
      'Caldera <commande@lesterresdecaldera.fr>';
    assert.throws(() => marketingSender(consent, 'tx@example.com'));
  } finally {
    if (saved.flag === undefined) delete process.env.EMAIL_ENGAGEMENT_ENABLED;
    else process.env.EMAIL_ENGAGEMENT_ENABLED = saved.flag;
    if (saved.from === undefined) delete process.env.MARKETING_EMAIL_FROM;
    else process.env.MARKETING_EMAIL_FROM = saved.from;
  }
});
test('webhook email : secret requis, signature et taille contrôlées avant accès DB', async () => {
  const saved = process.env.RESEND_WEBHOOK_SECRET,
    flag = process.env.EMAIL_ENGAGEMENT_ENABLED;
  try {
    delete process.env.RESEND_WEBHOOK_SECRET;
    assert.equal(
      (
        await POST(
          new Request('https://test/api/webhooks/resend', {
            method: 'POST',
            body: '{}',
          }),
        )
      ).status,
      503,
    );
    process.env.EMAIL_ENGAGEMENT_ENABLED = 'true';
    process.env.RESEND_WEBHOOK_SECRET =
      'whsec_' + Buffer.alloc(32, 1).toString('base64');
    const headers = {
      'svix-id': 'msg_test',
      'svix-timestamp': String(Math.floor(Date.now() / 1000)),
      'svix-signature': 'v1,forged',
    };
    assert.equal(
      (
        await POST(
          new Request('https://test/api/webhooks/resend', {
            method: 'POST',
            headers,
            body: '{}',
          }),
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await POST(
          new Request('https://test/api/webhooks/resend', {
            method: 'POST',
            headers,
            body: 'x'.repeat(33000),
          }),
        )
      ).status,
      413,
    );
  } finally {
    if (saved === undefined) delete process.env.RESEND_WEBHOOK_SECRET;
    else process.env.RESEND_WEBHOOK_SECRET = saved;
    if (flag === undefined) delete process.env.EMAIL_ENGAGEMENT_ENABLED;
    else process.env.EMAIL_ENGAGEMENT_ENABLED = flag;
  }
});
