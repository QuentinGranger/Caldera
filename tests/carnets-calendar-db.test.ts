import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { getPrisma } from '../src/lib/db/prisma';
import { readCarnetCalendar } from '../src/lib/carnets/calendar';
import { carnetPublicDate } from '../src/lib/carnets/dates';
if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1'].includes(
    new URL(process.env.DATABASE_URL ?? 'invalid:').hostname,
  )
)
  throw Error('Local database only');
const db = getPrisma();
const content = {
  version: 1,
  document: {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Extrait du Carnet.' }],
      },
      { type: 'newsletterCut' },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Suite du récit pour les lecteurs.' }],
      },
    ],
  },
};
test('Calendrier PostgreSQL : mois, états réels, réserve et absence de doublons', async (t) => {
  const key = randomUUID();
  const now = new Date('2026-10-31T12:00:00Z');
  const admin = await db.adminUser.create({
    data: { name: 'Calendar QA', email: `calendar-${key}@example.com` },
  });
  const category = await db.category.create({
    data: { name: 'Calendar QA', slug: `calendar-${key}` },
  });
  const product = await db.product.create({
    data: {
      name: 'ETB calendrier QA',
      slug: `calendar-${key}`,
      categoryId: category.id,
      productType: 'ETB',
      status: 'ACTIVE',
      variants: {
        create: { sku: key, price: 30, stockQuantity: 3, reservedQuantity: 1 },
      },
    },
    include: { variants: true },
  });
  const chapters = await Promise.all(
    Array.from({ length: 10 }, (_, i) => {
      const date =
        i < 4
          ? new Date(`2026-11-${['01', '15', '29', '10'][i]}T07:00:00Z`)
          : i === 5
            ? new Date('2026-11-30T23:30:00Z')
            : i === 6
              ? new Date('2026-10-15T07:00:00Z')
              : i === 7
                ? new Date('2026-11-01T07:00:00Z')
                : null;
      return db.carnetChapter.create({
        data: {
          number: 790101 + i,
          title: `Calendrier QA ${i}`,
          slug: `calendar-${key}-${i}`,
          createdById: admin.id,
          status: i === 3 ? 'DRAFT' : i === 7 ? 'ARCHIVED' : 'READY',
          content: i === 8 ? {} : content,
          illustrationUrl: '/assets/brand/logo-header-no-bg.png',
          illustrationAlt: 'La forêt',
          ...(date
            ? {
                earlyAccessAt: date,
                publicAt: i === 5 ? null : carnetPublicDate(date),
              }
            : {}),
          ...(i === 6 ? { publishedAt: date } : {}),
        },
      });
    }),
  );
  const campaigns = [];
  for (const [i, chapter] of chapters.entries()) {
    const campaign = await db.newsletterCampaign.create({
      data: {
        internalName: `Calendar QA ${i}`,
        subject: 'Objet',
        preheader: 'Extrait',
        heading: chapter.title,
        bodyMarkdown: '',
        createdById: admin.id,
        chapterId: chapter.id,
        status: i === 2 ? 'QUEUED' : 'DRAFT',
        scheduledAt:
          i === 9 ? new Date('2026-11-25T07:00:00Z') : chapter.earlyAccessAt,
      },
    });
    campaigns.push(campaign);
    await db.carnetChapter.update({
      where: { id: chapter.id },
      data: {
        editionCampaignId: campaign.id,
        ...(i === 2 ? { releaseCampaignId: campaign.id } : {}),
      },
    });
  }
  await db.carnetComptoirProduct.create({
    data: { chapterId: chapters[1]!.id, productId: product.id, position: 0 },
  });
  const current = await db.carnetChapter.findUniqueOrThrow({
    where: { id: chapters[1]!.id },
  });
  await db.adminAuditLog.create({
    data: {
      adminUserId: admin.id,
      action: 'NEWSLETTER_CAMPAIGN_TEST_SENT',
      entityType: 'NewsletterCampaign',
      entityId: campaigns[1]!.id,
      metadata: {
        chapterRevision: current.revision,
        campaignUpdatedAt: campaigns[1]!.updatedAt.toISOString(),
      },
    },
  });
  try {
    await t.test(
      'Novembre inclut les deux événements sans dupliquer un Carnet, réserve exacte',
      async () => {
        const data = await readCarnetCalendar(db, '2026-11', now);
        assert.deepEqual(
          data.entries.map((e) => e.id),
          [0, 3, 1, 9, 2].map((i) => chapters[i]!.id),
        );
        assert.equal(
          new Set(data.entries.map((e) => e.id)).size,
          data.entries.length,
        );
        assert.equal(data.newsletterCount, 5);
        assert.equal(data.publicCount, 3);
        assert.equal(data.readyCount, 6);
        assert.equal(data.sendReadyCount, 1);
        assert.equal(
          data.entries.find((e) => e.id === chapters[1]!.id)?.state,
          'Prêt à envoyer',
        );
        assert.equal(
          data.entries.find((e) => e.id === chapters[2]!.id)?.state,
          'Programmé',
        );
        assert.equal(
          data.entries.find((e) => e.id === chapters[3]!.id)?.state,
          'Brouillon',
        );
        assert.equal(
          data.entries.find((e) => e.id === chapters[0]!.id)?.provisional,
          true,
        );
      },
    );
    await t.test(
      'Décembre conserve la newsletter de novembre et sa publication publique',
      async () => {
        const data = await readCarnetCalendar(db, '2026-12', now);
        assert.deepEqual(
          data.entries.map((e) => e.id),
          [chapters[5]!.id, chapters[2]!.id],
        );
        const cross = data.entries.find((e) => e.id === chapters[2]!.id)!;
        assert.equal(cross.newsletterInMonth, false);
        assert.equal(cross.publicInMonth, true);
        assert.equal(
          cross.newsletterAt?.toISOString(),
          '2026-11-29T07:00:00.000Z',
        );
        assert.equal(cross.publicAt?.toISOString(), '2026-12-13T07:00:00.000Z');
        assert.equal(data.newsletterCount, 1);
        assert.equal(data.publicCount, 1);
      },
    );
    await t.test(
      'Sans date : section séparée, campagne datée exclue et archives absentes',
      async () => {
        const data = await readCarnetCalendar(db, '2026-11', now);
        assert.equal(data.unscheduledTotal, 2);
        assert.deepEqual(
          data.unscheduled.map((e) => e.id),
          [chapters[4]!.id, chapters[8]!.id],
        );
        assert.ok(
          ![...data.entries, ...data.unscheduled].some(
            (e) => e.id === chapters[7]!.id,
          ),
        );
        const empty = await readCarnetCalendar(db, '2027-01', now);
        assert.equal(empty.entries.length, 0);
        assert.equal(empty.readyCount, 6);
      },
    );
    await t.test(
      'Date publique seule : présente dans son mois sans doublon À planifier',
      async () => {
        const onlyPublic = await db.carnetChapter.create({
          data: {
            number: 790115,
            title: 'Date publique seule',
            slug: `calendar-${key}-public-only`,
            createdById: admin.id,
            status: 'DRAFT',
            content,
            publicAt: new Date('2026-11-26T07:00:00Z'),
          },
        });
        const data = await readCarnetCalendar(db, '2026-11', now);
        assert.equal(
          data.entries.filter((entry) => entry.id === onlyPublic.id).length,
          1,
        );
        assert.ok(
          !data.unscheduled.some((entry) => entry.id === onlyPublic.id),
        );
        assert.equal(data.unscheduledTotal, 2);
        await db.carnetChapter.delete({ where: { id: onlyPublic.id } });
      },
    );
    await t.test(
      'Stock réservé et produit dépublié retirent Prêt à envoyer sans effacer le texte prêt',
      async () => {
        await db.productVariant.update({
          where: { id: product.variants[0]!.id },
          data: { reservedQuantity: 3 },
        });
        let data = await readCarnetCalendar(db, '2026-11', now);
        assert.equal(data.sendReadyCount, 0);
        assert.equal(data.readyCount, 6);
        assert.equal(
          data.entries.find((e) => e.id === chapters[1]!.id)?.state,
          'Texte prêt',
        );
        assert.match(
          data.entries.find((e) => e.id === chapters[1]!.id)!.tasks.join(' '),
          /épuisé/,
        );
        await db.productVariant.update({
          where: { id: product.variants[0]!.id },
          data: { reservedQuantity: 0 },
        });
        await db.product.update({
          where: { id: product.id },
          data: { status: 'DRAFT' },
        });
        data = await readCarnetCalendar(db, '2026-11', now);
        assert.equal(data.sendReadyCount, 0);
        await db.product.update({
          where: { id: product.id },
          data: { status: 'ACTIVE' },
        });
      },
    );
    await t.test('Modification après test ne valide pas l’envoi', async () => {
      await db.carnetChapter.update({
        where: { id: chapters[1]!.id },
        data: { revision: { increment: 1 } },
      });
      const data = await readCarnetCalendar(db, '2026-11', now);
      assert.equal(data.sendReadyCount, 0);
      assert.match(
        data.entries.find((e) => e.id === chapters[1]!.id)!.tasks.join(' '),
        /test de la version actuelle/,
      );
    });
    await t.test(
      'Passage des dates : accès anticipé puis public selon les règles du site',
      async () => {
        let data = await readCarnetCalendar(
          db,
          '2026-11',
          new Date('2026-11-29T07:00:00Z'),
        );
        assert.equal(
          data.entries.find((e) => e.id === chapters[2]!.id)?.state,
          'Accès anticipé',
        );
        data = await readCarnetCalendar(
          db,
          '2026-12',
          new Date('2026-12-13T07:00:00Z'),
        );
        assert.equal(
          data.entries.find((e) => e.id === chapters[2]!.id)?.state,
          'Public',
        );
        assert.equal(
          data.readyCount,
          5,
          'Une publication déjà ouverte ne compte plus comme avance',
        );
        // The passage of a planned date alone cannot open a draft.
        data = await readCarnetCalendar(
          db,
          '2026-11',
          new Date('2026-12-13T07:00:00Z'),
        );
        assert.equal(
          data.entries.find((e) => e.id === chapters[0]!.id)?.state,
          'Texte prêt',
        );
      },
    );
  } finally {
    await db.carnetChapter.deleteMany({ where: { createdById: admin.id } });
    await db.newsletterCampaign.deleteMany({
      where: { createdById: admin.id },
    });
    await db.adminAuditLog.deleteMany({ where: { adminUserId: admin.id } });
    await db.productVariant.deleteMany({ where: { productId: product.id } });
    await db.product.delete({ where: { id: product.id } });
    await db.category.delete({ where: { id: category.id } });
    await db.adminUser.delete({ where: { id: admin.id } });
    await db.$disconnect();
  }
});
