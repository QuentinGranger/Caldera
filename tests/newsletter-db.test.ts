import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { getPrisma } from '../src/lib/db/prisma';
import {
  queueNewsletterCampaign,
  saveNewsletterCampaign,
} from '../src/lib/newsletter/campaigns';
import { processNewsletterDeliveries } from '../src/lib/newsletter/processor';
import type { EmailEnvelope, EmailProvider } from '../src/lib/email/provider';

if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1'].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  )
)
  throw new Error('Tests réservés à PostgreSQL local.');

const db = getPrisma();
function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

test('campagne newsletter : audience figée, désinscription respectée et envoi idempotent', async () => {
  const key = randomUUID();
  const admin = await db.adminUser.create({
    data: { name: 'Admin newsletter test', email: `admin-${key}@example.com` },
  });
  const subscribers = await Promise.all(
    ['one', 'two'].map((name) =>
      db.newsletterSubscriber.create({
        data: {
          email: `${name}-${key}@example.com`,
          status: 'ACTIVE',
          consentAt: new Date(),
          consentSource: 'test',
          consentVersion: 'test',
          confirmedAt: new Date(),
          lastInterestAt: new Date(),
        },
      }),
    ),
  );
  const pending = await db.newsletterSubscriber.create({
    data: {
      email: `pending-${key}@example.com`,
      status: 'PENDING',
      consentAt: new Date(),
      consentSource: 'test',
      consentVersion: 'test',
      lastInterestAt: new Date(),
    },
  });
  let campaignId = '';
  const sent: EmailEnvelope[] = [];
  const provider: EmailProvider = {
    name: 'test',
    async send(envelope) {
      sent.push(envelope);
      return { id: `provider-${sent.length}` };
    },
  };
  try {
    const campaign = await saveNewsletterCampaign(
      admin.id,
      form({
        internalName: 'Campagne de recette',
        subject: 'Objet de recette',
        preheader: 'Aperçu',
        heading: 'Cap sur Caldera',
        bodyMarkdown: 'Bonjour **aventuriers**.',
        ctaLabel: 'Découvrir',
        ctaUrl: '/nouveautes',
      }),
    );
    campaignId = campaign.id;
    const queued = await queueNewsletterCampaign(
      admin.id,
      form({ id: campaign.id }),
    );
    assert.equal(queued.status, 'QUEUED');
    assert.equal(queued.recipientCount, 2);
    assert.equal(
      await db.newsletterCampaignDelivery.count({
        where: { campaignId: campaign.id },
      }),
      2,
    );

    await db.newsletterSubscriber.update({
      where: { id: subscribers[1]!.id },
      data: { status: 'UNSUBSCRIBED', unsubscribedAt: new Date() },
    });
    const result = await processNewsletterDeliveries({
      limit: 10,
      provider,
      settings: {
        from: 'Caldera <test@example.com>',
        replyTo: undefined,
        testRecipient: undefined,
      },
    });
    assert.deepEqual(
      {
        sent: result.sent,
        skipped: result.skipped,
        completed: result.completed,
      },
      { sent: 1, skipped: 1, completed: 1 },
    );
    assert.equal(sent.length, 1);
    assert.equal(sent[0]!.to[0], subscribers[0]!.email);
    assert.match(sent[0]!.html, /newsletter\/desinscription\?token=/);
    assert.equal(
      (
        await db.newsletterCampaign.findUniqueOrThrow({
          where: { id: campaign.id },
        })
      ).status,
      'COMPLETED',
    );
    await processNewsletterDeliveries({
      limit: 10,
      provider,
      settings: {
        from: 'Caldera <test@example.com>',
        replyTo: undefined,
        testRecipient: undefined,
      },
    });
    assert.equal(sent.length, 1);
  } finally {
    if (campaignId) {
      await db.adminAuditLog.deleteMany({
        where: { entityType: 'NewsletterCampaign', entityId: campaignId },
      });
      await db.newsletterCampaignDelivery.deleteMany({ where: { campaignId } });
      await db.newsletterCampaign.deleteMany({ where: { id: campaignId } });
    }
    await db.newsletterSubscriber.deleteMany({
      where: { id: { in: [...subscribers.map((row) => row.id), pending.id] } },
    });
    await db.adminUser.delete({ where: { id: admin.id } });
    await db.$disconnect();
  }
});

import {
  cancelNewsletterCampaign,
  duplicateNewsletterCampaign,
} from '../src/lib/newsletter/campaigns';
import { serializeNewsletterDocument } from '../src/lib/newsletter/document';
test('studio : audience consentie, programmation réelle, annulation et duplication sûre', async () => {
  const key = randomUUID();
  const admin = await db.adminUser.create({
    data: { name: 'Studio QA', email: `studio-${key}@example.com` },
  });
  const subscribers = await Promise.all(
    [true, false].map((personalizedEmails) =>
      db.newsletterSubscriber.create({
        data: {
          email: `studio-${personalizedEmails}-${key}@example.com`,
          status: 'ACTIVE',
          consentAt: new Date(),
          confirmedAt: new Date(
            Date.now() - (personalizedEmails ? 40 : 0) * 86400000,
          ),
          consentVersion: 'test',
          lastInterestAt: new Date(),
          personalizedEmails,
          personalizedConsentAt: personalizedEmails ? new Date() : null,
        },
      }),
    ),
  );
  const ids: string[] = [];
  try {
    const bodyMarkdown = serializeNewsletterDocument({
      version: 1,
      theme: 'journal',
      blocks: [
        { id: 'text', type: 'text', text: 'Une actualité utile.' },
        { id: 'cta', type: 'button', label: 'Découvrir', href: '/catalogue' },
      ],
    });
    const campaign = await saveNewsletterCampaign(
      admin.id,
      form({
        internalName: 'Studio QA',
        subject: 'Objet',
        heading: 'Titre',
        bodyMarkdown,
      }),
    );
    ids.push(campaign.id);
    const queued = await queueNewsletterCampaign(
      admin.id,
      form({
        id: campaign.id,
        audience: 'established',
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      }),
    );
    assert.equal(queued.recipientCount, 1);
    let calls = 0;
    const provider: EmailProvider = {
      name: 'studio-test',
      async send() {
        calls++;
        return { id: 'unexpected' };
      },
    };
    const result = await processNewsletterDeliveries({
      provider,
      settings: {
        from: 'test@example.com',
        replyTo: undefined,
        testRecipient: undefined,
      },
    });
    assert.equal(result.sent, 0);
    assert.equal(calls, 0, 'Une campagne future ne doit pas être envoyée');
    await assert.rejects(
      saveNewsletterCampaign(
        admin.id,
        form({
          id: campaign.id,
          internalName: 'Mutation',
          subject: 'Objet',
          heading: 'Titre',
          bodyMarkdown,
        }),
      ),
      /ne peut plus/,
    );
    const copy = await duplicateNewsletterCampaign(
      admin.id,
      form({ id: campaign.id }),
    );
    ids.push(copy.id);
    assert.equal(copy.status, 'DRAFT');
    assert.equal(copy.recipientCount, 0);
    assert.equal(copy.queuedAt, null);
    assert.equal(copy.bodyMarkdown, bodyMarkdown);
    assert.equal(
      await db.newsletterCampaignDelivery.count({
        where: { campaignId: copy.id },
      }),
      0,
    );
    await cancelNewsletterCampaign(admin.id, form({ id: campaign.id }));
    assert.equal(
      (
        await db.newsletterCampaign.findUniqueOrThrow({
          where: { id: campaign.id },
        })
      ).status,
      'DRAFT',
    );
    assert.equal(
      await db.newsletterCampaignDelivery.count({
        where: { campaignId: campaign.id },
      }),
      0,
    );
    await queueNewsletterCampaign(
      admin.id,
      form({
        id: campaign.id,
        audience: 'established',
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      }),
    );
    await db.newsletterCampaignDelivery.updateMany({
      where: { campaignId: campaign.id },
      data: { attemptCount: 1 },
    });
    await assert.rejects(
      cancelNewsletterCampaign(admin.id, form({ id: campaign.id })),
      /déjà commencé/,
    );
    const incomplete = await saveNewsletterCampaign(
      admin.id,
      form({
        internalName: 'Incomplète',
        subject: 'Objet',
        heading: 'Titre',
        bodyMarkdown: serializeNewsletterDocument({
          version: 1,
          theme: 'journal',
          blocks: [],
        }),
      }),
    );
    ids.push(incomplete.id);
    await assert.rejects(
      queueNewsletterCampaign(admin.id, form({ id: incomplete.id })),
      /Ajoutez/,
    );
  } finally {
    await db.newsletterCampaignDelivery.deleteMany({
      where: { campaignId: { in: ids } },
    });
    await db.newsletterCampaign.deleteMany({ where: { id: { in: ids } } });
    await db.adminAuditLog.deleteMany({ where: { adminUserId: admin.id } });
    await db.newsletterSubscriber.deleteMany({
      where: { id: { in: subscribers.map((s) => s.id) } },
    });
    await db.adminUser.delete({ where: { id: admin.id } });
    await db.$disconnect();
  }
});
