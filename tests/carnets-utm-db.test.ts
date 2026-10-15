import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test, after } from 'node:test';
import { getPrisma } from '../src/lib/db/prisma';
import { processNewsletterDeliveries } from '../src/lib/newsletter/processor';
import { renderCarnetCampaign } from '../src/lib/carnets/campaign';
import { carnetEmailSnapshot } from '../src/lib/carnets/email';
import { parseCarnetContent } from '../src/lib/carnets/content';
import { verifyCarnetAccess } from '../src/lib/carnets/access';
if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1'].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  )
)
  throw Error('PostgreSQL local uniquement');
const db = getPrisma();
after(() => db.$disconnect());
const urls = (html: string) =>
  [...html.matchAll(/href="([^"]+)"/g)]
    .map((m) => m[1]!.replaceAll('&amp;', '&'))
    .filter((v) => v.startsWith('https://lesterresdecaldera.fr'))
    .map((v) => new URL(v));
test('Carnets UTM : envoi réel du worker avec fournisseur simulé, consentement, aperçu/test/avancé et accès signé', async () => {
  const saved = {
    APP_URL: process.env.APP_URL,
    EMAIL_ENGAGEMENT_ENABLED: process.env.EMAIL_ENGAGEMENT_ENABLED,
    MARKETING_EMAIL_FROM: process.env.MARKETING_EMAIL_FROM,
  };
  process.env.APP_URL = 'https://lesterresdecaldera.fr';
  process.env.EMAIL_ENGAGEMENT_ENABLED = 'true';
  process.env.MARKETING_EMAIL_FROM =
    'Caldera <lettre@news.lesterresdecaldera.fr>';
  const key = randomUUID(),
    now = new Date();
  const admin = await db.adminUser.create({
    data: { name: 'QA UTM', email: `utm-${key}@example.com` },
  });
  const product = {
    id: randomUUID(),
    name: 'ETB QA',
    href: '/produit/etb-qa',
    image: '/assets/brand/logo-header-no-bg.png',
    price: '50 €',
    stock: 2,
    eligible: true,
  };
  const content = parseCarnetContent({
    version: 1,
    document: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Un extrait du récit.' }],
        },
        { type: 'newsletterCut' },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'La suite du récit.' }],
        },
      ],
    },
  });
  const chapter = await db.carnetChapter.create({
    data: {
      number: 820100,
      title: 'QA UTM',
      slug: `utm-${key}`,
      createdById: admin.id,
      status: 'READY',
      content,
      earlyAccessAt: new Date(now.getTime() - 1000),
      publicAt: new Date(now.getTime() + 86400000),
      publishedAt: now,
    },
  });
  const campaign = await db.newsletterCampaign.create({
    data: {
      createdById: admin.id,
      chapterId: chapter.id,
      internalName: 'QA UTM',
      subject: 'QA UTM',
      heading: 'QA UTM',
      bodyMarkdown: 'QA',
      status: 'QUEUED',
      carnetProducts: [product],
    },
  });
  const subscribers = await Promise.all(
    [true, false].map((tracked) =>
      db.newsletterSubscriber.create({
        data: {
          email: `utm-${tracked}-${key}@example.com`,
          status: 'ACTIVE',
          consentAt: now,
          consentVersion: 'qa',
          lastInterestAt: now,
          emailTracking: tracked,
          emailTrackingConsentAt: tracked ? now : null,
        },
      }),
    ),
  );
  await db.newsletterCampaignDelivery.createMany({
    data: subscribers.map((s) => ({
      campaignId: campaign.id,
      subscriberId: s.id,
      recipient: s.email,
    })),
  });
  try {
    const preview = renderCarnetCampaign(campaign, chapter, { logo: '' });
    const story = urls(preview.html).find(
      (u) => u.pathname === `/univers/carnets/${chapter.slug}`,
    )!;
    assert.equal(story.searchParams.get('utm_campaign'), 'carnet_820100');
    assert.equal(story.searchParams.get('utm_id'), `campaign_${campaign.id}`);
    assert.equal(story.searchParams.get('utm_content'), 'continuer_expedition');
    assert.ok(verifyCarnetAccess(chapter, story.searchParams.get('access')));
    const advanced = renderCarnetCampaign(
      {
        ...campaign,
        carnetCustomized: true,
        bodyMarkdown: carnetEmailSnapshot({ ...chapter, content }, [
          product,
        ]).replace(
          `/univers/carnets/${chapter.slug}`,
          `/univers/carnets/${chapter.slug}?utm_source=manuel&utm_source=doublon`,
        ),
        ctaLabel: 'Continuer',
        ctaUrl: `/univers/carnets/${chapter.slug}?utm_content=manuel`,
      },
      chapter,
      { logo: '' },
    );
    const advancedStories = urls(advanced.html).filter(
      (u) => u.pathname === story.pathname,
    );
    assert.ok(advancedStories.length >= 1);
    for (const u of advancedStories) {
      assert.equal(u.searchParams.getAll('utm_source').length, 1);
      assert.equal(u.searchParams.get('utm_content'), 'continuer_expedition');
      assert.ok(verifyCarnetAccess(chapter, u.searchParams.get('access')));
    }
    let sent = 0;
    const result = await processNewsletterDeliveries({
      limit: 2,
      settings: {
        from: 'Caldera <contact@lesterresdecaldera.fr>',
        replyTo: undefined,
        testRecipient: undefined,
      },
      provider: {
        name: 'qa',
        async send(envelope) {
          sent++;
          const tracked = subscribers.find(
            (s) => s.email === envelope.to[0],
          )!.emailTracking;
          const links = urls(envelope.html).filter(
            (u) => u.pathname === story.pathname || u.pathname === product.href,
          );
          assert.ok(links.length >= 2);
          for (const u of links) {
            assert.equal(u.searchParams.has('utm_campaign'), tracked);
            if (tracked) {
              assert.equal(u.searchParams.get('utm_campaign'), 'carnet_820100');
              assert.equal(
                u.searchParams.get('utm_id'),
                `campaign_${campaign.id}`,
              );
            }
            if (u.pathname === story.pathname)
              assert.ok(
                verifyCarnetAccess(chapter, u.searchParams.get('access')),
              );
          }
          assert.equal(envelope.from.includes('@news.'), tracked);
          return { id: randomUUID() };
        },
      },
    });
    assert.equal(sent, 2);
    assert.equal(result.sent, 2);
    const deliveries = await db.newsletterCampaignDelivery.findMany({
      where: { campaignId: campaign.id },
      include: { subscriber: true },
    });
    for (const d of deliveries)
      assert.equal(d.trackingEnabled, d.subscriber.emailTracking);
  } finally {
    await db.newsletterCampaignDelivery.deleteMany({
      where: { campaignId: campaign.id },
    });
    await db.newsletterCampaign.delete({ where: { id: campaign.id } });
    await db.carnetChapter.delete({ where: { id: chapter.id } });
    await db.newsletterSubscriber.deleteMany({
      where: { id: { in: subscribers.map((s) => s.id) } },
    });
    await db.adminUser.delete({ where: { id: admin.id } });
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});
