import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { getPrisma } from '../src/lib/db/prisma';
import {
  saveNewsletterCampaign,
  queueNewsletterCampaign,
  cancelNewsletterCampaign,
} from '../src/lib/newsletter/campaigns';
import { processNewsletterDeliveries } from '../src/lib/newsletter/processor';
import { carnetPublicDate } from '../src/lib/carnets/dates';
import {
  carnetAccessToken,
  verifyCarnetAccess,
} from '../src/lib/carnets/access';
import { readCarnet, listPublicCarnets } from '../src/lib/carnets/public';
import { getContentUrls } from '../src/app/sitemaps/_lib/data';
import { saveCarnetChapter } from '../src/lib/carnets/admin';
import {
  EmailProviderError,
  type EmailEnvelope,
} from '../src/lib/email/provider';
if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1'].includes(
    new URL(process.env.DATABASE_URL ?? 'invalid:').hostname,
  )
)
  throw new Error('Tests réservés à PostgreSQL local.');
const db = getPrisma();
after(() => db.$disconnect());
function form(values: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
}
const content = {
  version: 1,
  document: {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'EXTRAIT_CANONIQUE_QA' }],
      },
      { type: 'newsletterCut' },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'RECIT_RESERVE_QA' }],
      },
    ],
  },
};
test('Cycle Carnet : programmation, annulation, tokens, diffusion réelle simulée, verrouillage et publicité sans cron', async () => {
  const key = randomUUID();
  const admin = await db.adminUser.create({
    data: { name: 'Cycle QA', email: `cycle-${key}@example.com` },
  });
  const sub = await db.newsletterSubscriber.create({
    data: {
      email: `cycle-${key}@example.com`,
      status: 'ACTIVE',
      consentAt: new Date(),
      consentSource: 'test',
      consentVersion: 'test',
      confirmedAt: new Date(),
      lastInterestAt: new Date(),
    },
  });
  const fields = {
    number: '678902',
    title: 'Cycle QA',
    slug: `cycle-${key}`,
    revision: '0',
    status: 'READY',
    content: JSON.stringify(content),
  };
  try {
    const chapter = await saveCarnetChapter(admin.id, form(fields));
    const campaign = await saveNewsletterCampaign(
      admin.id,
      form({
        internalName: 'Cycle',
        subject: 'Cycle',
        heading: 'Cycle',
        bodyMarkdown: 'NE_JAMAIS_ENVOYER_CETTE_COPIE',
        chapterId: chapter.id,
      }),
    );
    const schedule = new Date(Date.now() + 3600000);
    await queueNewsletterCampaign(
      admin.id,
      form({ id: campaign.id, scheduledAt: schedule.toISOString() }),
    );
    let planned = await db.carnetChapter.findUniqueOrThrow({
      where: { id: chapter.id },
    });
    assert.equal(planned.earlyAccessAt!.getTime(), schedule.getTime());
    assert.equal(
      planned.publicAt!.getTime(),
      carnetPublicDate(schedule).getTime(),
    );
    const token = carnetAccessToken(planned);
    assert.equal(
      (await readCarnet(chapter.slug, token, new Date(schedule.getTime() - 1)))!
        .content,
      null,
    );
    assert.equal(
      (await readCarnet(chapter.slug, undefined, schedule))!.content,
      null,
    );
    assert.ok((await readCarnet(chapter.slug, token, schedule))!.content);
    assert.ok(
      !(await listPublicCarnets(schedule)).some((c) => c.id === chapter.id),
    );
    assert.ok(
      !(await getContentUrls()).some((c) => c.loc.endsWith(chapter.slug)),
    );
    await assert.rejects(
      saveCarnetChapter(
        admin.id,
        form({ ...fields, id: chapter.id, revision: String(planned.revision) }),
      ),
      /diffusion/,
    );
    await cancelNewsletterCampaign(admin.id, form({ id: campaign.id }));
    assert.equal(await readCarnet(chapter.slug, token), null);
    await queueNewsletterCampaign(
      admin.id,
      form({
        id: campaign.id,
        scheduledAt: new Date(schedule.getTime() + 86400000).toISOString(),
      }),
    );
    planned = await db.carnetChapter.findUniqueOrThrow({
      where: { id: chapter.id },
    });
    assert.equal(
      planned.earlyAccessAt!.getTime(),
      schedule.getTime() + 86400000,
    );
    assert.equal(
      verifyCarnetAccess(planned, token, planned.earlyAccessAt!),
      false,
    );
    await cancelNewsletterCampaign(admin.id, form({ id: campaign.id }));
    await queueNewsletterCampaign(
      admin.id,
      form({ id: campaign.id, sendMode: 'now' }),
    );
    const before = Date.now();
    const envelopes: EmailEnvelope[] = [];
    const options = {
      limit: 1,
      provider: {
        name: 'test',
        async send(envelope: EmailEnvelope) {
          const frozen = await db.carnetChapter.findUniqueOrThrow({
            where: { id: chapter.id },
          });
          assert.ok(frozen.publishedAt);
          assert.ok(frozen.earlyAccessAt!.getTime() >= before);
          assert.equal(
            frozen.publicAt!.getTime(),
            carnetPublicDate(frozen.earlyAccessAt!).getTime(),
          );
          await assert.rejects(
            cancelNewsletterCampaign(admin.id, form({ id: campaign.id })),
            /commencé/,
          );
          envelopes.push(envelope);
          if (envelopes.length === 1)
            throw new EmailProviderError('TEST_RETRY');
          return { id: 'cycle-test' };
        },
      },
      settings: {
        from: 'Test <test@example.com>',
        replyTo: undefined,
        testRecipient: sub.email,
      },
    };
    const failed = await processNewsletterDeliveries(options);
    assert.equal(failed.failed, 1);
    const firstCalendar = await db.carnetChapter.findUniqueOrThrow({
      where: { id: chapter.id },
    });
    await db.newsletterCampaignDelivery.updateMany({
      where: { campaignId: campaign.id },
      data: { nextAttemptAt: new Date(Date.now() - 1000) },
    });
    const result = await processNewsletterDeliveries(options);
    assert.equal(result.sent, 1);
    assert.equal(envelopes.length, 2);
    assert.deepEqual(
      envelopes[0],
      envelopes[1],
      'Retry uses the persisted envelope',
    );
    const retried = await db.carnetChapter.findUniqueOrThrow({
      where: { id: chapter.id },
    });
    assert.equal(
      retried.publicAt!.getTime(),
      firstCalendar.publicAt!.getTime(),
    );
    assert.equal(
      retried.earlyAccessAt!.getTime(),
      firstCalendar.earlyAccessAt!.getTime(),
    );
    assert.match(envelopes[0]!.html, /EXTRAIT_CANONIQUE_QA/);
    assert.doesNotMatch(
      envelopes[0]!.html,
      /RECIT_RESERVE_QA|NE_JAMAIS_ENVOYER_CETTE_COPIE/,
    );
    assert.match(envelopes[0]!.text, /Continuer l’expédition/);
    const link = envelopes[0]!.text.match(
      /https?:\/\/[^\s]+\?access=[^\s]+/,
    )![0]!;
    const frozen = await db.carnetChapter.findUniqueOrThrow({
      where: { id: chapter.id },
    });
    assert.ok(
      verifyCarnetAccess(frozen, new URL(link).searchParams.get('access')),
    );
    await assert.rejects(
      saveCarnetChapter(
        admin.id,
        form({ ...fields, id: chapter.id, revision: String(frozen.revision) }),
      ),
      /diffusion/,
    );
    assert.equal(
      (await readCarnet(
        chapter.slug,
        undefined,
        new Date(frozen.publicAt!.getTime() - 1),
      ))!.content,
      null,
    );
    assert.ok(
      (await readCarnet(chapter.slug, undefined, frozen.publicAt!))!.content,
    );
    assert.ok(
      (await readCarnet(chapter.slug, 'ancien-token', frozen.publicAt!))!
        .content,
    );
    assert.ok(
      (await listPublicCarnets(frozen.publicAt!)).some(
        (c) => c.id === chapter.id,
      ),
    );
    const pastEarly = new Date(Date.now() - 30 * 86400000);
    await db.carnetChapter.update({
      where: { id: chapter.id },
      data: { earlyAccessAt: pastEarly, publicAt: carnetPublicDate(pastEarly) },
    });
    assert.ok(
      (await getContentUrls()).some((c) => c.loc.endsWith(chapter.slug)),
    );
    const repeat = await saveNewsletterCampaign(
      admin.id,
      form({
        internalName: 'Rappel',
        subject: 'Rappel',
        heading: 'Rappel',
        bodyMarkdown: '',
        chapterId: chapter.id,
      }),
    );
    const previous = await db.carnetChapter.findUniqueOrThrow({
      where: { id: chapter.id },
    });
    await queueNewsletterCampaign(
      admin.id,
      form({ id: repeat.id, scheduledAt: schedule.toISOString() }),
    );
    await cancelNewsletterCampaign(admin.id, form({ id: repeat.id }));
    const afterRepeat = await db.carnetChapter.findUniqueOrThrow({
      where: { id: chapter.id },
    });
    assert.equal(afterRepeat.publicAt!.getTime(), previous.publicAt!.getTime());
    assert.equal(afterRepeat.releaseCampaignId, previous.releaseCampaignId);
    await db.carnetChapter.update({
      where: { id: chapter.id },
      data: { status: 'ARCHIVED' },
    });
    assert.equal(await readCarnet(chapter.slug, token), null);
  } finally {
    await db.newsletterCampaignDelivery.deleteMany({
      where: { campaign: { createdById: admin.id } },
    });
    await db.newsletterCampaign.deleteMany({
      where: { createdById: admin.id },
    });
    await db.carnetChapter.deleteMany({ where: { createdById: admin.id } });
    await db.adminAuditLog.deleteMany({ where: { adminUserId: admin.id } });
    await db.adminUser.delete({ where: { id: admin.id } });
    await db.newsletterSubscriber.delete({ where: { id: sub.id } });
  }
});
