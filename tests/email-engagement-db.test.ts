import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { Webhook } from 'svix';
import { getPrisma } from '../src/lib/db/prisma';
import { processNewsletterDeliveries } from '../src/lib/newsletter/processor';
import {
  clearSubscriberEngagement,
  purgeEmailEngagement,
} from '../src/lib/email/engagement';
import { POST } from '../src/app/api/webhooks/resend/route';
if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1'].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  )
)
  throw new Error('PostgreSQL local requis');
const db = getPrisma();
after(() => db.$disconnect());
test('emails : envoi selon accord, webhook signé, dédoublonnage, retrait et rétention', async () => {
  const saved = {
    flag: process.env.EMAIL_ENGAGEMENT_ENABLED,
    from: process.env.MARKETING_EMAIL_FROM,
    secret: process.env.RESEND_WEBHOOK_SECRET,
  };
  const secret = 'whsec_' + Buffer.alloc(32, 3).toString('base64');
  process.env.EMAIL_ENGAGEMENT_ENABLED = 'true';
  process.env.MARKETING_EMAIL_FROM =
    'Caldera <lettre@news.lesterresdecaldera.fr>';
  process.env.RESEND_WEBHOOK_SECRET = secret;
  const key = randomUUID();
  const admin = await db.adminUser.create({
    data: { name: 'QA engagement', email: `eng-admin-${key}@example.com` },
  });
  const campaign = await db.newsletterCampaign.create({
    data: {
      createdById: admin.id,
      internalName: 'QA engagement',
      subject: 'Recette',
      heading: 'Recette',
      bodyMarkdown: 'Contenu',
      status: 'QUEUED',
    },
  });
  const people = await Promise.all(
    [true, false].map((tracked) =>
      db.newsletterSubscriber.create({
        data: {
          email: `eng-${tracked}-${key}@example.com`,
          status: 'ACTIVE',
          consentAt: new Date(),
          consentVersion: 'test',
          lastInterestAt: new Date(),
          emailTracking: tracked,
          emailTrackingConsentAt: tracked ? new Date() : null,
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
        },
      }),
    ),
  );
  const messageIds = new Map<string, string>();
  try {
    const result = await processNewsletterDeliveries({
      limit: 2,
      settings: {
        from: 'Caldera <tx@lesterresdecaldera.fr>',
        replyTo: undefined,
        testRecipient: undefined,
      },
      provider: {
        name: 'test',
        async send(envelope) {
          const person = people.find((p) => p.email === envelope.to[0])!;
          assert.equal(envelope.from.includes('@news.'), person.emailTracking);
          const messageId = randomUUID();
          messageIds.set(person.id, messageId);
          return { id: messageId };
        },
      },
    });
    assert.equal(result.sent, 2);
    const tracked = deliveries[0]!;
    const messageId = messageIds.get(people[0]!.id)!;
    const signed = async (type: string, at = new Date(), id = messageId) => {
      const payload = JSON.stringify({
        type,
        created_at: at.toISOString(),
        data: {
          email_id: id,
          tags: { caldera_delivery: tracked.id, caldera_kind: 'campaign' },
          to: ['private@example.com'],
          click: { ipAddress: 'private', link: 'https://test/?secret=private' },
        },
      });
      const stamp = new Date();
      const svixId = 'msg_' + randomUUID();
      return POST(
        new Request('https://test/api/webhooks/resend', {
          method: 'POST',
          headers: {
            'svix-id': svixId,
            'svix-timestamp': String(Math.floor(stamp.getTime() / 1000)),
            'svix-signature': new Webhook(secret).sign(svixId, stamp, payload),
          },
          body: payload,
        }),
      );
    };
    assert.equal((await signed('email.opened')).status, 204);
    const first = await db.newsletterCampaignDelivery.findUniqueOrThrow({
      where: { id: tracked.id },
    });
    assert.ok(first.openedAt);
    assert.ok(first.deliveredAt);
    await signed('email.opened', new Date(Date.now() + 500));
    assert.equal(
      (
        await db.newsletterCampaignDelivery.findUniqueOrThrow({
          where: { id: tracked.id },
        })
      ).openedAt!.getTime(),
      first.openedAt.getTime(),
    );
    await signed('email.clicked');
    assert.ok(
      (
        await db.newsletterCampaignDelivery.findUniqueOrThrow({
          where: { id: tracked.id },
        })
      ).clickedAt,
    );
    await db.newsletterSubscriber.update({
      where: { id: people[0]!.id },
      data: { emailTracking: false },
    });
    await clearSubscriberEngagement(people[0]!.id);
    await signed('email.opened');
    const withdrawn = await db.newsletterCampaignDelivery.findUniqueOrThrow({
      where: { id: tracked.id },
    });
    assert.equal(withdrawn.openedAt, null);
    assert.equal(withdrawn.clickedAt, null);
    await db.newsletterCampaignDelivery.update({
      where: { id: tracked.id },
      data: {
        trackingEnabled: true,
        sentAt: new Date(Date.now() - 91 * 86400000),
        openedAt: new Date(),
      },
    });
    await purgeEmailEngagement();
    assert.equal(
      (
        await db.newsletterCampaignDelivery.findUniqueOrThrow({
          where: { id: tracked.id },
        })
      ).openedAt,
      null,
    );
  } finally {
    await db.newsletterCampaignDelivery.deleteMany({
      where: { campaignId: campaign.id },
    });
    await db.newsletterCampaign.delete({ where: { id: campaign.id } });
    await db.newsletterSubscriber.deleteMany({
      where: { id: { in: people.map((p) => p.id) } },
    });
    await db.adminUser.delete({ where: { id: admin.id } });
    for (const [name, value] of Object.entries({
      EMAIL_ENGAGEMENT_ENABLED: saved.flag,
      MARKETING_EMAIL_FROM: saved.from,
      RESEND_WEBHOOK_SECRET: saved.secret,
    })) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
