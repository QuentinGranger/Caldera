import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test, after } from 'node:test';
import { getPrisma } from '../src/lib/db/prisma';
import { recordCarnetReading } from '../src/lib/carnets/analytics-record';
import { recordEmailEngagement } from '../src/lib/email/engagement-webhook';
import {
  clearSubscriberEngagement,
  purgeEmailEngagement,
} from '../src/lib/email/engagement';
import { readCarnetAnalytics } from '../src/lib/carnets/analytics';
import { carnetAccessToken } from '../src/lib/carnets/access';
import { carnetLink } from '../src/lib/carnets/analytics-links';
import { purgeMeasurement } from '../src/lib/analytics/server';
if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1'].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  )
)
  throw Error('PostgreSQL local uniquement');
const db = getPrisma();
after(() => db.$disconnect());
test('Carnets analytics : accès, lecteurs uniques, last touch 24 h, cohorte chronologique et retrait', async (t) => {
  const key = randomUUID(),
    now = new Date(),
    day = 86400000;
  const admin = await db.adminUser.create({
    data: { name: 'QA analytics', email: `reading-${key}@example.com` },
  });
  const category = await db.category.create({
    data: { name: 'QA', slug: `reading-${key}` },
  });
  const product = await db.product.create({
    data: {
      name: 'QA ETB',
      slug: `reading-${key}`,
      categoryId: category.id,
      status: 'ACTIVE',
      productType: 'ETB',
      variants: {
        create: { sku: `reading-${key}`, price: 50, stockQuantity: 4 },
      },
    },
    include: { variants: true },
  });
  const chapters = await Promise.all(
    [1, 2, 3, 4, 6].map((n) =>
      db.carnetChapter.create({
        data: {
          number: 820000 + n,
          title: `QA ${n}`,
          slug: `reading-${key}-${n}`,
          createdById: admin.id,
          status: n === 4 ? 'DRAFT' : 'READY',
          earlyAccessAt: new Date(now.getTime() - 20 * day),
          publicAt: new Date(now.getTime() + (n === 3 ? day : -day)),
          publishedAt: new Date(now.getTime() - 20 * day),
          content: { version: 1, document: { type: 'doc', content: [] } },
        },
      }),
    ),
  );
  const sessions = await Promise.all(
    ['a', 'b', 'a', 'c'].map((letter) =>
      db.measurementSession.create({
        data: {
          visitorHash: letter + key.replaceAll('-', ''),
          source: 'direct',
          channel: 'direct',
        },
      }),
    ),
  );
  const view = (s: number, c: number, at: Date, access?: string) =>
    recordCarnetReading(
      sessions[s]!.id,
      { event: 'carnet_view', chapterId: chapters[c]!.id, access },
      at,
    );
  const at = (seconds: number) => new Date(now.getTime() + seconds * 1000);
  try {
    await t.test(
      'chapitres privés exclus ; avant-première seulement avec lien signé',
      async () => {
        await view(3, 3, at(-300));
        await view(3, 2, at(-300), 'invalid');
        assert.equal(
          await db.carnetReading.count({
            where: { sessionId: sessions[3]!.id },
          }),
          0,
        );
        await view(3, 2, at(-300), carnetAccessToken(chapters[2]!));
        assert.equal(
          await db.carnetReading.count({
            where: { sessionId: sessions[3]!.id },
          }),
          1,
        );
      },
    );
    await t.test(
      'lecture et fin dédoublonnées ; la fin requiert une lecture préalable de 20 s',
      async () => {
        await recordCarnetReading(
          sessions[0]!.id,
          { event: 'carnet_complete', chapterId: chapters[0]!.id },
          at(-400),
        );
        await view(0, 0, at(-300));
        await view(0, 0, at(-290));
        await recordCarnetReading(
          sessions[0]!.id,
          { event: 'carnet_complete', chapterId: chapters[0]!.id },
          at(-290),
        );
        let row = await db.carnetReading.findFirstOrThrow({
          where: { sessionId: sessions[0]!.id },
        });
        assert.equal(row.viewedAt.getTime(), at(-300).getTime());
        assert.equal(row.completedAt, null);
        await recordCarnetReading(
          sessions[0]!.id,
          { event: 'carnet_complete', chapterId: chapters[0]!.id },
          at(-270),
        );
        row = await db.carnetReading.findUniqueOrThrow({
          where: { id: row.id },
        });
        assert.equal(row.completedAt!.getTime(), at(-270).getTime());
      },
    );
    await t.test(
      'rétention : même navigateur sur deux sessions, ordre réel de lecture et dénominateur unique',
      async () => {
        await view(1, 1, at(-400));
        await view(1, 0, at(-300)); // wrong order does not count
        await view(2, 0, at(-280));
        await view(2, 1, at(-250));
        await view(2, 4, at(-240));
        const data = await db.$transaction((tx) =>
          readCarnetAnalytics(tx, chapters[0]!.id, now),
        );
        assert.equal(data!.readers, 2);
        assert.equal(data!.completed, 1);
        assert.equal(
          data!.retention.find((r) => r.id === chapters[1]!.id)!.readers,
          1,
        );
        assert.equal(
          data!.retention.find((r) => r.id === chapters[4]!.id)!.rate,
          0.5,
        );
        assert.equal(
          data!.retention.find((r) => r.id === chapters[3]!.id)!.state,
          'hidden',
        );
      },
    );
    await t.test(
      'produit après lecture : dernière lecture seulement, variante valide et dédoublonnage',
      async () => {
        await recordCarnetReading(
          sessions[2]!.id,
          { event: 'view_item', variantId: randomUUID() },
          at(-200),
        );
        assert.equal(
          await db.carnetReading.count({
            where: {
              productViewedAt: { not: null },
              chapterId: { in: chapters.map((c) => c.id) },
            },
          }),
          0,
        );
        await recordCarnetReading(
          sessions[2]!.id,
          { event: 'view_item', variantId: product.variants[0]!.id },
          at(-200),
        );
        await recordCarnetReading(
          sessions[0]!.id,
          { event: 'view_item', variantId: product.variants[0]!.id },
          at(-100),
        );
        const marked = await db.carnetReading.findMany({
          where: {
            productViewedAt: { not: null },
            chapterId: { in: chapters.map((c) => c.id) },
          },
        });
        assert.equal(marked.length, 1);
        assert.equal(marked[0]!.chapterId, chapters[4]!.id);
        assert.equal(marked[0]!.productViewedAt!.getTime(), at(-200).getTime());
        await db.carnetReading.update({
          where: { id: marked[0]!.id },
          data: {
            viewedAt: new Date(now.getTime() - day - 1),
            productViewedAt: null,
          },
        });
        await db.carnetReading.updateMany({
          where: { session: { visitorHash: sessions[0]!.visitorHash } },
          data: {
            viewedAt: new Date(now.getTime() - day - 1),
            completedAt: null,
          },
        });
        await recordCarnetReading(
          sessions[2]!.id,
          { event: 'view_item', variantId: product.variants[0]!.id },
          now,
        );
        assert.equal(
          await db.carnetReading.count({
            where: {
              chapterId: { in: chapters.map((c) => c.id) },
              productViewedAt: { not: null },
            },
          }),
          0,
        );
      },
    );
    await t.test(
      'suppression de session et purge 90 jours effacent les lectures en cascade',
      async () => {
        await db.measurementSession.update({
          where: { id: sessions[3]!.id },
          data: { startedAt: new Date(now.getTime() - 91 * day) },
        });
        await purgeMeasurement();
        assert.equal(
          await db.carnetReading.count({
            where: { sessionId: sessions[3]!.id },
          }),
          0,
        );
      },
    );
  } finally {
    await db.measurementSession.deleteMany({
      where: { id: { in: sessions.map((s) => s.id) } },
    });
    await db.carnetChapter.deleteMany({ where: { createdById: admin.id } });
    await db.productVariant.deleteMany({ where: { productId: product.id } });
    await db.product.delete({ where: { id: product.id } });
    await db.category.delete({ where: { id: category.id } });
    await db.adminUser.delete({ where: { id: admin.id } });
  }
});
test('Carnets clics : chaque lien après le clic global, replays, consentement, suppression et purge', async () => {
  const key = randomUUID(),
    now = new Date(),
    day = 86400000;
  const admin = await db.adminUser.create({
    data: { name: 'QA clics', email: `click-${key}@example.com` },
  });
  const chapter = await db.carnetChapter.create({
    data: {
      number: 820099,
      title: 'QA clics',
      content: {},
      slug: `click-${key}`,
      createdById: admin.id,
    },
  });
  const links = {
    number: chapter.number,
    storyPath: `/univers/carnets/${chapter.slug}`,
    products: [1, 2, 3].map((n) => ({
      id: randomUUID(),
      href: `/produit/qa-${n}`,
    })),
  };
  const campaign = await db.newsletterCampaign.create({
    data: {
      createdById: admin.id,
      chapterId: chapter.id,
      internalName: 'QA',
      subject: 'QA',
      heading: 'QA',
      bodyMarkdown: 'QA',
      carnetProducts: links.products,
    },
  });
  const sub = await db.newsletterSubscriber.create({
    data: {
      email: `click-${key}@example.com`,
      status: 'ACTIVE',
      consentAt: now,
      consentVersion: 'qa',
      lastInterestAt: now,
      emailTracking: true,
      emailTrackingConsentAt: now,
    },
  });
  const delivery = await db.newsletterCampaignDelivery.create({
    data: {
      campaignId: campaign.id,
      subscriberId: sub.id,
      recipient: sub.email,
      status: 'SENT',
      sentAt: now,
      firstAttemptAt: now,
      trackingEnabled: true,
      trackingConsentAt: now,
      providerMessageId: randomUUID(),
    },
  });
  const event = (
    link: string,
    at = now,
    provider = delivery.providerMessageId,
  ) =>
    recordEmailEngagement({
      type: 'email.clicked',
      created_at: at.toISOString(),
      data: {
        email_id: provider,
        tags: { caldera_delivery: delivery.id, caldera_kind: 'campaign' },
        click: { link, ipAddress: 'NEVER_STORED', userAgent: 'NEVER_STORED' },
      },
    });
  const story = carnetLink(links.storyPath, `campaign_${campaign.id}`, links);
  try {
    await event(story);
    await event(story);
    for (const p of links.products)
      await event(carnetLink(p.href, `campaign_${campaign.id}`, links));
    assert.equal(
      await db.carnetEmailClick.count({ where: { deliveryId: delivery.id } }),
      4,
    );
    await event(story, now, randomUUID());
    await event(story, new Date(now.getTime() - day));
    let stats = await db.$transaction((tx) =>
      readCarnetAnalytics(tx, chapter.id, now),
    );
    assert.equal(stats!.storyClicks, 1);
    assert.equal(stats!.products.length, 3);
    assert.equal(stats!.email.clickedAt, 1);
    assert.equal(stats!.readers, 0);
    const stored = JSON.stringify(
      await db.carnetEmailClick.findMany({
        where: { deliveryId: delivery.id },
      }),
    );
    assert.doesNotMatch(stored, /NEVER_STORED|https|example.com/);
    await db.newsletterSubscriber.update({
      where: { id: sub.id },
      data: { emailTracking: false },
    });
    await clearSubscriberEngagement(sub.id);
    await event(story);
    assert.equal(
      await db.carnetEmailClick.count({ where: { deliveryId: delivery.id } }),
      0,
    );
    await db.newsletterSubscriber.update({
      where: { id: sub.id },
      data: {
        emailTracking: true,
        emailTrackingConsentAt: new Date(now.getTime() + 1),
      },
    });
    await db.newsletterCampaignDelivery.update({
      where: { id: delivery.id },
      data: { trackingEnabled: true, trackingConsentAt: now },
    });
    await event(story);
    assert.equal(
      await db.carnetEmailClick.count({ where: { deliveryId: delivery.id } }),
      0,
    );
    await db.carnetEmailClick.create({
      data: {
        deliveryId: delivery.id,
        linkKey: 'story_continue',
        clickedAt: new Date(now.getTime() - 91 * day),
      },
    });
    await purgeEmailEngagement();
    assert.equal(
      await db.carnetEmailClick.count({ where: { deliveryId: delivery.id } }),
      0,
    );
    stats = await db.$transaction((tx) => readCarnetAnalytics(tx, chapter.id));
    assert.equal(stats!.storyClicks, 0);
  } finally {
    await db.newsletterCampaignDelivery.delete({ where: { id: delivery.id } });
    await db.newsletterCampaign.delete({ where: { id: campaign.id } });
    await db.carnetChapter.delete({ where: { id: chapter.id } });
    await db.newsletterSubscriber.delete({ where: { id: sub.id } });
    await db.adminUser.delete({ where: { id: admin.id } });
  }
});
