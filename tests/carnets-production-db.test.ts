import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { getPrisma } from '../src/lib/db/prisma';
import { readEditorialProduction } from '../src/lib/carnets/production';
import { carnetPublicDate } from '../src/lib/carnets/dates';
if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1'].includes(
    new URL(process.env.DATABASE_URL ?? 'invalid:').hostname,
  )
)
  throw new Error('Local database only');
const db = getPrisma();
const content = {
  version: 1,
  document: {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Les arbres marqués.' }],
      },
      { type: 'newsletterCut' },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Une route se dessine dans la forêt.' },
        ],
      },
    ],
  },
};
test('Production éditoriale : prochaine édition, réserve, stock et preuve de test', async (t) => {
  const key = randomUUID();
  const admin = await db.adminUser.create({
    data: { name: 'Production QA', email: `production-${key}@example.com` },
  });
  const category = await db.category.create({
    data: { name: 'Production QA', slug: `production-${key}` },
  });
  const product = await db.product.create({
    data: {
      name: 'ETB QA',
      slug: `production-${key}`,
      categoryId: category.id,
      status: 'ACTIVE',
      productType: 'ETB',
      variants: {
        create: { sku: key, price: 20, stockQuantity: 2, reservedQuantity: 1 },
      },
    },
    include: { variants: true },
  });
  const chapters = await Promise.all(
    Array.from({ length: 8 }, (_, i) =>
      db.carnetChapter.create({
        data: {
          number: 790001 + i,
          title: `Production QA ${i}`,
          slug: `production-${key}-${i}`,
          content,
          createdById: admin.id,
          status: i < 6 ? 'READY' : i === 6 ? 'DRAFT' : 'ARCHIVED',
          illustrationUrl: '/assets/brand/logo-header-no-bg.png',
          illustrationAlt: 'Illustration QA',
          ...(i === 1
            ? {
                earlyAccessAt: new Date('2001-11-14T07:00:00Z'),
                publicAt: carnetPublicDate(new Date('2001-11-14T07:00:00Z')),
              }
            : {}),
        },
      }),
    ),
  );
  const selected = chapters[1]!;
  const campaign = await db.newsletterCampaign.create({
    data: {
      internalName: 'Production QA',
      subject: 'Les arbres marqués',
      preheader: 'La forêt cadastrée',
      heading: selected.title,
      bodyMarkdown: '',
      createdById: admin.id,
      chapterId: selected.id,
    },
  });
  await db.carnetChapter.update({
    where: { id: selected.id },
    data: { editionCampaignId: campaign.id },
  });
  await db.carnetComptoirProduct.create({
    data: { chapterId: selected.id, productId: product.id, position: 0 },
  });
  let subscriberId: string | undefined;
  try {
    await t.test(
      'Date prévue prioritaire, contenu canonique et six chapitres = trois mois',
      async () => {
        const data = await readEditorialProduction(db);
        assert.equal(data.next?.id, selected.id);
        assert.equal(data.readyCount, 6);
        assert.equal(data.monthsAhead, 3);
        assert.equal(data.next.excerptWords, 3);
        assert.equal(data.next.excerptReady, true);
        assert.equal(data.next.chapterReady, true);
        assert.equal(data.next.illustrationReady, true);
        assert.equal(data.next.productCount, 1);
        assert.deepEqual(data.next.unavailable, []);
        assert.equal(data.next.testCurrent, false);
        assert.equal(data.next.canTest, true);
        assert.equal(
          data.next.newsletterAt?.toISOString(),
          '2001-11-14T07:00:00.000Z',
        );
        assert.equal(
          data.next.publicAt?.toISOString(),
          '2001-11-28T07:00:00.000Z',
        );
      },
    );
    await t.test(
      'Seul un test de la campagne liée valide la checklist',
      async () => {
        const foreign = await db.newsletterCampaign.create({
          data: {
            internalName: 'Autre QA',
            subject: 'Autre',
            heading: 'Autre',
            bodyMarkdown: '',
            createdById: admin.id,
            chapterId: selected.id,
          },
        });
        await db.adminAuditLog.create({
          data: {
            adminUserId: admin.id,
            action: 'NEWSLETTER_CAMPAIGN_TEST_SENT',
            entityType: 'NewsletterCampaign',
            entityId: foreign.id,
            metadata: {},
          },
        });
        assert.equal(
          (await readEditorialProduction(db)).next?.testCurrent,
          false,
        );
        const current = await db.carnetChapter.findUniqueOrThrow({
          where: { id: selected.id },
        });
        await db.adminAuditLog.create({
          data: {
            adminUserId: admin.id,
            action: 'NEWSLETTER_CAMPAIGN_TEST_SENT',
            entityType: 'NewsletterCampaign',
            entityId: campaign.id,
            metadata: {
              chapterRevision: current.revision,
              campaignUpdatedAt: campaign.updatedAt.toISOString(),
            },
          },
        });
        assert.equal(
          (await readEditorialProduction(db)).next?.testCurrent,
          true,
        );
        await db.carnetChapter.update({
          where: { id: selected.id },
          data: { revision: { increment: 1 } },
        });
        assert.equal(
          (await readEditorialProduction(db)).next?.testCurrent,
          false,
        );
      },
    );
    await t.test(
      'Anciennes preuves de test conservées, mais invalidées après modification',
      async () => {
        await db.adminAuditLog.deleteMany({ where: { entityId: campaign.id } });
        await db.adminAuditLog.create({
          data: {
            adminUserId: admin.id,
            action: 'NEWSLETTER_CAMPAIGN_TEST_SENT',
            entityType: 'NewsletterCampaign',
            entityId: campaign.id,
            metadata: {},
          },
        });
        assert.equal(
          (await readEditorialProduction(db)).next?.testCurrent,
          true,
        );
        await db.newsletterCampaign.update({
          where: { id: campaign.id },
          data: {
            subject: 'Objet modifié',
            updatedAt: new Date(Date.now() + 1000),
          },
        });
        assert.equal(
          (await readEditorialProduction(db)).next?.testCurrent,
          false,
        );
      },
    );
    await t.test(
      'Stock net des réservations et variante inactive bloquent le test',
      async () => {
        const variant = product.variants[0]!;
        await db.productVariant.update({
          where: { id: variant.id },
          data: { reservedQuantity: 2 },
        });
        let next = (await readEditorialProduction(db)).next!;
        assert.equal(next.unavailable[0]?.name, 'ETB QA');
        assert.match(next.unavailable[0]!.reason!, /épuisé/);
        assert.equal(next.canTest, false);
        await db.productVariant.update({
          where: { id: variant.id },
          data: { reservedQuantity: 0, isActive: false },
        });
        next = (await readEditorialProduction(db)).next!;
        assert.match(next.unavailable[0]!.reason!, /variante active/);
        await db.carnetComptoirProduct.deleteMany({
          where: { chapterId: selected.id },
        });
        next = (await readEditorialProduction(db)).next!;
        assert.equal(next.productCount, 0);
        assert.deepEqual(next.unavailable, []);
        assert.equal(next.canTest, true);
      },
    );
    await t.test(
      'Document ancien invalide et illustration absente restent lisibles comme tâches',
      async () => {
        await db.carnetChapter.update({
          where: { id: selected.id },
          data: { content: {}, illustrationUrl: null, illustrationAlt: null },
        });
        const next = (await readEditorialProduction(db)).next!;
        assert.equal(next.chapterReady, false);
        assert.equal(next.excerptReady, false);
        assert.equal(next.excerptWords, 0);
        assert.equal(next.illustrationReady, false);
        assert.equal(next.canTest, false);
        await db.carnetChapter.update({
          where: { id: selected.id },
          data: {
            content,
            illustrationUrl: '/assets/brand/logo-header-no-bg.png',
            illustrationAlt: 'Illustration QA',
          },
        });
      },
    );
    await t.test(
      'Une édition programmée reste prochaine ; la première diffusion la retire de la réserve',
      async () => {
        await db.newsletterCampaign.update({
          where: { id: campaign.id },
          data: { status: 'QUEUED' },
        });
        await db.carnetChapter.update({
          where: { id: selected.id },
          data: { releaseCampaignId: campaign.id },
        });
        assert.equal((await readEditorialProduction(db)).next?.id, selected.id);
        await db.carnetChapter.update({
          where: { id: selected.id },
          data: { publishedAt: new Date() },
        });
        const data = await readEditorialProduction(db);
        assert.equal(data.next?.id, chapters[0]!.id);
        assert.equal(data.readyCount, 5);
        assert.equal(data.monthsAhead, 2.5);
      },
    );
    await t.test(
      'Un ancien Carnet ayant une livraison envoyée n’est pas proposé à nouveau',
      async () => {
        await db.carnetChapter.update({
          where: { id: selected.id },
          data: { publishedAt: null },
        });
        const subscriber = await db.newsletterSubscriber.create({
          data: {
            email: `production-${key}@example.com`,
            consentVersion: 'qa',
            lastInterestAt: new Date(),
            consentAt: new Date(),
            status: 'ACTIVE',
            confirmedAt: new Date(),
          },
        });
        subscriberId = subscriber.id;
        await db.newsletterCampaignDelivery.create({
          data: {
            campaignId: campaign.id,
            subscriberId: subscriber.id,
            recipient: subscriber.email,
            status: 'SENT',
            sentAt: new Date(),
          },
        });
        const data = await readEditorialProduction(db);
        assert.equal(data.next?.id, chapters[0]!.id);
        assert.equal(data.readyCount, 5);
      },
    );
    await t.test(
      'Repli par numéro et état vide sans création implicite',
      async () => {
        await db.carnetChapter.updateMany({
          where: { createdById: admin.id, status: 'READY' },
          data: { status: 'ARCHIVED' },
        });
        const data = await readEditorialProduction(db);
        assert.equal(data.next?.id, chapters[6]!.id);
        assert.equal(data.readyCount, 0);
        assert.equal(data.monthsAhead, 0);
        await db.carnetChapter.updateMany({
          where: { createdById: admin.id },
          data: { status: 'ARCHIVED' },
        });
        assert.equal((await readEditorialProduction(db)).next, null);
      },
    );
  } finally {
    await db.newsletterCampaignDelivery.deleteMany({
      where: { campaign: { createdById: admin.id } },
    });
    await db.carnetChapter.deleteMany({ where: { createdById: admin.id } });
    await db.newsletterCampaign.deleteMany({
      where: { createdById: admin.id },
    });
    await db.adminAuditLog.deleteMany({ where: { adminUserId: admin.id } });
    if (subscriberId)
      await db.newsletterSubscriber.delete({ where: { id: subscriberId } });
    await db.productVariant.deleteMany({ where: { productId: product.id } });
    await db.product.delete({ where: { id: product.id } });
    await db.category.delete({ where: { id: category.id } });
    await db.adminUser.delete({ where: { id: admin.id } });
    await db.$disconnect();
  }
});
