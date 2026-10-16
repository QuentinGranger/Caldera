import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { getPrisma } from '../src/lib/db/prisma';
import {
  readNewsletterCampaignList,
  readDiscordPublicationList,
} from '../src/lib/admin/communication-queries';
if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1'].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  )
)
  throw Error('QA locale uniquement');
const db = getPrisma();
test('Communication : recherche, états réels et pagination indépendante sans publication', async (t) => {
  const key = randomUUID();
  const admin = await db.adminUser.create({
    data: { name: 'Communication QA', email: `comm-${key}@example.com` },
  });
  const beforeCampaign = await readNewsletterCampaignList(db);
  const beforeDiscord = await readDiscordPublicationList(db);
  const campaignIds = Array.from({ length: 31 }, () => randomUUID());
  const eventIds = Array.from({ length: 33 }, () => randomUUID());
  try {
    await db.newsletterCampaign.createMany({
      data: campaignIds.map((id, i) => ({
        id,
        createdById: admin.id,
        internalName: `${key}-campagne-${i}`,
        subject: i === 30 ? 'Objet unique communication' : 'Newsletter de QA',
        heading: 'QA',
        bodyMarkdown: 'QA',
        status:
          i < 26
            ? 'DRAFT'
            : i < 29
              ? 'QUEUED'
              : i === 29
                ? 'SENDING'
                : 'COMPLETED',
        createdAt: new Date('2026-10-15T08:00:00Z'),
      })),
    });
    await db.discordOutbox.createMany({
      data: eventIds.map((id, i) => ({
        id,
        eventKey: `${key}-${i}`,
        title: `${key}-publication-${i}`,
        summary: i === 32 ? 'Résumé unique communication' : 'Message de QA',
        path: '/',
        kind: 'announcement',
        status:
          i < 26
            ? 'DRAFT'
            : i === 26
              ? 'PENDING'
              : i === 27
                ? 'RETRY'
                : i === 28
                  ? 'PROCESSING'
                  : i === 29
                    ? 'REVIEW'
                    : i === 30
                      ? 'REJECTED'
                      : i === 31
                        ? 'SENT'
                        : 'CANCELLED',
        createdAt: new Date('2026-10-15T08:00:00Z'),
      })),
    });
    await t.test(
      'Campagnes : 25 puis 6, ordre stable et page bornée, indépendante des abonnés',
      async () => {
        const first = await readNewsletterCampaignList(db, {
          campaignSearch: key,
          page: '99',
        });
        const second = await readNewsletterCampaignList(db, {
          campaignSearch: key,
          campaignPage: '2',
        });
        assert.equal(first.page, 1);
        assert.equal(first.total, 31);
        assert.equal(first.campaigns.length, 25);
        assert.equal(second.campaigns.length, 6);
        const ids = [...first.campaigns, ...second.campaigns].map((c) => c.id);
        assert.deepEqual(ids, [...campaignIds].sort());
        assert.equal(
          (
            await readNewsletterCampaignList(db, {
              campaignSearch: key,
              campaignPage: '9999999',
            })
          ).page,
          2,
        );
      },
    );
    await t.test(
      'Campagnes : recherche sur l’objet, filtre exact et compteurs indépendants du filtre',
      async () => {
        const drafts = await readNewsletterCampaignList(db, {
          campaignSearch: key,
          campaignStatus: 'DRAFT',
        });
        assert.equal(drafts.total, 26);
        assert.ok(drafts.campaigns.every((c) => c.status === 'DRAFT'));
        assert.equal(
          drafts.counts.QUEUED,
          (beforeCampaign.counts.QUEUED ?? 0) + 3,
        );
        assert.equal(
          (
            await readNewsletterCampaignList(db, {
              campaignSearch: 'Objet unique communication',
            })
          ).campaigns[0]?.id,
          campaignIds[30],
        );
        assert.equal(
          (
            await readNewsletterCampaignList(db, {
              campaignSearch: key,
              campaignStatus: 'INVALID',
            })
          ).total,
          31,
        );
        assert.equal(
          (
            await readNewsletterCampaignList(db, {
              campaignSearch: "' OR 1=1 --",
            })
          ).total,
          0,
        );
      },
    );
    await t.test(
      'Discord : groupes complets, recherche de résumé, filtre inconnu et pagination',
      async () => {
        const queue = await readDiscordPublicationList(db, {
          search: key,
          view: 'queue',
        });
        assert.equal(queue.total, 3);
        assert.deepEqual(queue.events.map((e) => e.status).sort(), [
          'PENDING',
          'PROCESSING',
          'RETRY',
        ]);
        const review = await readDiscordPublicationList(db, {
          search: key,
          view: 'review',
        });
        assert.equal(review.total, 2);
        assert.equal(review.counts.sent, beforeDiscord.counts.sent + 1);
        const first = await readDiscordPublicationList(db, { search: key }),
          last = await readDiscordPublicationList(db, {
            search: key,
            page: '99',
          });
        assert.equal(first.events.length, 25);
        assert.equal(last.events.length, 8);
        assert.equal(last.page, 2);
        for (const view of ['invalid', '__proto__', 'constructor'])
          assert.equal(
            (await readDiscordPublicationList(db, { search: key, view })).total,
            33,
          );
        assert.equal(
          (
            await readDiscordPublicationList(db, {
              search: 'Résumé unique communication',
            })
          ).events[0]?.id,
          eventIds[32],
        );
        assert.ok(
          !('errorCode' in first.events[0]!) &&
            !('eventKey' in first.events[0]!),
        );
      },
    );
    assert.equal(
      await db.newsletterCampaignDelivery.count({
        where: { campaignId: { in: campaignIds } },
      }),
      0,
    );
    assert.equal(
      await db.discordOutbox.count({
        where: { id: { in: eventIds }, status: 'DRAFT' },
      }),
      26,
    );
  } finally {
    await db.newsletterCampaign.deleteMany({
      where: { id: { in: campaignIds } },
    });
    await db.discordOutbox.deleteMany({ where: { id: { in: eventIds } } });
    await db.adminUser.delete({ where: { id: admin.id } });
    await db.$disconnect();
  }
});
