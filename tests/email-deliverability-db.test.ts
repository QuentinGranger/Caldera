import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { Webhook } from 'svix';
import { getPrisma } from '../src/lib/db/prisma';
import {
  newsletterUnsubscribeHeaders,
  stockAlertUnsubscribeHeaders,
} from '../src/lib/email/unsubscribe-headers';
import { GET, POST } from '../src/app/api/newsletter/unsubscribe/route';
import { POST as stockPost } from '../src/app/api/stock-alerts/unsubscribe/route';
import { POST as webhookPost } from '../src/app/api/webhooks/resend/route';

if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1'].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  )
)
  throw new Error('PostgreSQL local requis');
const db = getPrisma();
after(() => db.$disconnect());
const oneClick = (url: string) =>
  new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'List-Unsubscribe=One-Click',
  });
const unsubscribeUrl = (id: string) =>
  newsletterUnsubscribeHeaders(id)['List-Unsubscribe'].slice(1, -1);

test('RFC 8058 : GET sans mutation, POST sans session, portée limitée et répétition sans erreur', async () => {
  const key = randomUUID();
  const people = await Promise.all(
    [1, 2].map((n) =>
      db.newsletterSubscriber.create({
        data: {
          email: `oneclick-${n}-${key}@example.com`,
          status: 'ACTIVE',
          consentAt: new Date(),
          consentVersion: 'test',
          lastInterestAt: new Date(),
          personalizedEmails: true,
          emailTracking: true,
          emailTrackingConsentAt: new Date(),
        },
      }),
    ),
  );
  const variant = await db.productVariant.findFirstOrThrow();
  const alerts = await Promise.all(
    people.map((p) =>
      db.stockAlert.create({
        data: { email: p.email, variantId: variant.id, status: 'ACTIVE' },
      }),
    ),
  );
  try {
    const url = unsubscribeUrl(people[0]!.id);
    assert.equal((await GET(new Request(url))).status, 307);
    assert.equal(
      (
        await db.newsletterSubscriber.findUniqueOrThrow({
          where: { id: people[0]!.id },
        })
      ).status,
      'ACTIVE',
    );
    for (let n = 0; n < 2; n++)
      assert.equal((await POST(oneClick(url))).status, 200);
    const removed = await db.newsletterSubscriber.findUniqueOrThrow({
      where: { id: people[0]!.id },
    });
    assert.equal(removed.status, 'UNSUBSCRIBED');
    assert.equal(removed.emailTracking, false);
    assert.equal(removed.personalizedEmails, false);
    assert.equal(removed.emailTrackingConsentAt, null);
    assert.equal(
      (
        await db.newsletterSubscriber.findUniqueOrThrow({
          where: { id: people[1]!.id },
        })
      ).status,
      'ACTIVE',
    );
    assert.equal(
      (await POST(oneClick(unsubscribeUrl(randomUUID())))).status,
      200,
    );
    const stockUrl = stockAlertUnsubscribeHeaders(alerts[0]!.id)[
      'List-Unsubscribe'
    ].slice(1, -1);
    assert.equal((await stockPost(oneClick(url))).status, 400);
    for (let n = 0; n < 2; n++)
      assert.equal((await stockPost(oneClick(stockUrl))).status, 200);
    assert.equal(
      await db.stockAlert.count({ where: { id: alerts[0]!.id } }),
      0,
    );
    assert.equal(
      await db.stockAlert.count({ where: { id: alerts[1]!.id } }),
      1,
    );
  } finally {
    await db.stockAlert.deleteMany({
      where: { id: { in: alerts.map((a) => a.id) } },
    });
    await db.newsletterSubscriber.deleteMany({
      where: { id: { in: people.map((p) => p.id) } },
    });
  }
});

test('retours Resend : rebond définitif, arrêt des files, plainte, consentement renouvelé et signature', async (t) => {
  const saved = {
    flag: process.env.EMAIL_ENGAGEMENT_ENABLED,
    secret: process.env.RESEND_WEBHOOK_SECRET,
  };
  const secret = 'whsec_' + Buffer.alloc(32, 7).toString('base64');
  process.env.EMAIL_ENGAGEMENT_ENABLED = 'false';
  process.env.RESEND_WEBHOOK_SECRET = secret;
  t.after(() => {
    for (const [name, value] of Object.entries({
      EMAIL_ENGAGEMENT_ENABLED: saved.flag,
      RESEND_WEBHOOK_SECRET: saved.secret,
    })) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
  const key = randomUUID(),
    old = new Date(Date.now() - 60_000),
    at = new Date(Date.now() - 10_000);
  const admin = await db.adminUser.create({
    data: {
      name: 'QA deliverability',
      email: `feedback-admin-${key}@example.com`,
    },
  });
  const campaign = await db.newsletterCampaign.create({
    data: {
      createdById: admin.id,
      internalName: 'QA feedback',
      subject: 'Test',
      heading: 'Test',
      bodyMarkdown: 'Test',
      status: 'QUEUED',
    },
  });
  const people = await Promise.all(
    [1, 2, 3].map((n) =>
      db.newsletterSubscriber.create({
        data: {
          email: `feedback-${n}-${key}@example.com`,
          status: 'ACTIVE',
          consentAt: old,
          confirmedAt: old,
          createdAt: old,
          consentVersion: 'test',
          lastInterestAt: new Date(),
          emailTracking: true,
          emailTrackingConsentAt: old,
        },
      }),
    ),
  );
  const deliveries = await Promise.all(
    people.map((p) =>
      db.newsletterCampaignDelivery.create({
        data: {
          campaignId: campaign.id,
          subscriberId: p.id,
          recipient: p.email,
          status: 'SENT',
          providerMessageId: randomUUID(),
          firstAttemptAt: old,
          createdAt: old,
          trackingEnabled: true,
          openedAt: old,
        },
      }),
    ),
  );
  const lifecycle = await db.lifecycleDelivery.create({
    data: {
      subscriberId: people[0]!.id,
      kind: 'WELCOME',
      eventKey: key,
      variantIds: [],
      quantities: [],
      expiresAt: new Date(Date.now() + 86400000),
      createdAt: old,
    },
  });
  const variant = await db.productVariant.findFirstOrThrow();
  const stock = await db.stockAlert.create({
    data: {
      email: people[0]!.email,
      variantId: variant.id,
      status: 'ACTIVE',
      createdAt: old,
      confirmedAt: old,
    },
  });
  const signed = async (
    index: number,
    type = 'email.bounced',
    bounceType = 'Permanent',
    id?: string,
    forged = false,
  ) => {
    const payload = JSON.stringify({
      type,
      created_at: at.toISOString(),
      data: {
        email_id: id ?? deliveries[index]!.providerMessageId,
        bounce: { type: bounceType },
        to: ['untrusted-address@example.com'],
      },
    });
    const stamp = new Date(),
      svixId = 'msg_' + randomUUID();
    return webhookPost(
      new Request('https://test/api/webhooks/resend', {
        method: 'POST',
        headers: {
          'svix-id': svixId,
          'svix-timestamp': String(Math.floor(stamp.getTime() / 1000)),
          'svix-signature': forged
            ? 'forged'
            : new Webhook(secret).sign(svixId, stamp, payload),
        },
        body: payload,
      }),
    );
  };
  try {
    assert.equal(
      (await signed(0, 'email.bounced', 'Permanent', undefined, true)).status,
      400,
    );
    assert.equal((await signed(0, 'email.bounced', 'Transient')).status, 204);
    assert.equal(
      (
        await db.newsletterSubscriber.findUniqueOrThrow({
          where: { id: people[0]!.id },
        })
      ).status,
      'ACTIVE',
    );
    assert.equal(
      (await signed(0, 'email.bounced', 'Permanent', randomUUID())).status,
      204,
    );
    for (let n = 0; n < 2; n++) assert.equal((await signed(0)).status, 204);
    const bounced = await db.newsletterCampaignDelivery.findUniqueOrThrow({
      where: { id: deliveries[0]!.id },
    });
    assert.equal(bounced.status, 'FAILED');
    assert.equal(bounced.retryBlocked, true);
    assert.equal(bounced.lastError, 'EMAIL_HARD_BOUNCE');
    assert.equal(bounced.openedAt, null);
    assert.equal(bounced.trackingEnabled, false);
    assert.equal(
      (
        await db.newsletterSubscriber.findUniqueOrThrow({
          where: { id: people[0]!.id },
        })
      ).status,
      'UNSUBSCRIBED',
    );
    assert.equal(
      (
        await db.lifecycleDelivery.findUniqueOrThrow({
          where: { id: lifecycle.id },
        })
      ).status,
      'SKIPPED',
    );
    assert.equal(
      (await db.stockAlert.findUniqueOrThrow({ where: { id: stock.id } }))
        .status,
      'FAILED',
    );
    await db.newsletterSubscriber.update({
      where: { id: people[1]!.id },
      data: { consentAt: new Date(), confirmedAt: new Date() },
    });
    assert.equal((await signed(1)).status, 204);
    assert.equal(
      (
        await db.newsletterSubscriber.findUniqueOrThrow({
          where: { id: people[1]!.id },
        })
      ).status,
      'ACTIVE',
    );
    assert.equal((await signed(2, 'email.complained')).status, 204);
    assert.equal(
      (
        await db.newsletterSubscriber.findUniqueOrThrow({
          where: { id: people[2]!.id },
        })
      ).status,
      'UNSUBSCRIBED',
    );
    assert.equal(
      (
        await db.newsletterCampaignDelivery.findUniqueOrThrow({
          where: { id: deliveries[2]!.id },
        })
      ).lastError,
      'EMAIL_SPAM_COMPLAINT',
    );
  } finally {
    await db.stockAlert.deleteMany({ where: { id: stock.id } });
    await db.lifecycleDelivery.deleteMany({ where: { id: lifecycle.id } });
    await db.newsletterCampaignDelivery.deleteMany({
      where: { campaignId: campaign.id },
    });
    await db.newsletterCampaign.delete({ where: { id: campaign.id } });
    await db.newsletterSubscriber.deleteMany({
      where: { id: { in: people.map((p) => p.id) } },
    });
    await db.adminUser.delete({ where: { id: admin.id } });
  }
});
