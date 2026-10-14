import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { getPrisma } from '../src/lib/db/prisma';
import { saveCarnetChapter } from '../src/lib/carnets/admin';
import {
  customizeCarnetEdition,
  restoreAutomaticCarnetEdition,
} from '../src/lib/carnets/edition';
import { chapterComptoir } from '../src/lib/carnets/comptoir';
import {
  queueNewsletterCampaign,
  cancelNewsletterCampaign,
  saveNewsletterCampaign,
  sendNewsletterCampaignTest,
} from '../src/lib/newsletter/campaigns';
import { renderCarnetCampaign } from '../src/lib/carnets/campaign';
import { carnetPublicDate, formatCarnetDate } from '../src/lib/carnets/dates';
import { processNewsletterDeliveries } from '../src/lib/newsletter/processor';
import type { EmailEnvelope } from '../src/lib/email/provider';
if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1'].includes(
    new URL(process.env.DATABASE_URL ?? 'invalid:').hostname,
  )
)
  throw new Error('Local database only');
const db = getPrisma();
function form(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}
const content = {
  version: 1,
  document: {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'EXTRAIT_INITIAL' }],
      },
      { type: 'newsletterCut' },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'RECIT_CANONIQUE_RESERVE' }],
      },
    ],
  },
};
test('Workflow complet Carnet : références, sauvegarde, test, Studio et moteur existant', async (t) => {
  const key = randomUUID(),
    admin = await db.adminUser.create({
      data: { name: 'Carnet edition QA', email: `edition-${key}@example.com` },
    }),
    category = await db.category.create({
      data: { name: 'Edition QA', slug: `edition-${key}` },
    });
  const products = await Promise.all(
    [1, 2, 3, 4].map((i) =>
      db.product.create({
        data: {
          name: `Produit réel ${i}`,
          slug: `edition-${key}-${i}`,
          status: 'ACTIVE',
          productType: 'ETB',
          categoryId: category.id,
          variants: {
            create: {
              sku: `edition-${key}-${i}`,
              price: 10 + i,
              stockQuantity: 8,
            },
          },
        },
      }),
    ),
  );
  const date = new Date(Date.now() + 3600000),
    fields = {
      revision: '0',
      number: '678903',
      title: 'Quand le lac recula',
      slug: `edition-${key}`,
      content: JSON.stringify(content),
      status: 'READY',
      illustrationUrl: '/assets/brand/logo-header-no-bg.png',
      illustrationAlt: 'Caldera',
      emailSubject: 'Le lac — Carnet',
      emailPreheader: 'La route apparaît',
      earlyAccessAt: formatCarnetDate(date),
      productIds: JSON.stringify(products.slice(0, 3).map((p) => p.id)),
    };
  let chapter = await saveCarnetChapter(admin.id, form(fields));
  let campaign = await db.newsletterCampaign.findUniqueOrThrow({
    where: { id: chapter.editionCampaignId! },
  });
  const refs = () => ({
    id: chapter.id,
    revision: String(chapter.revision),
    campaignUpdatedAt: campaign.updatedAt.toISOString(),
  });
  try {
    await t.test(
      'Une seule campagne principale, trois références Product et données réelles',
      async () => {
        assert.equal(campaign.chapterId, chapter.id);
        assert.equal(campaign.subject, fields.emailSubject);
        assert.equal(campaign.preheader, fields.emailPreheader);
        assert.equal(
          campaign.scheduledAt?.getTime(),
          chapter.earlyAccessAt?.getTime(),
        );
        const p = await chapterComptoir(db, chapter.id);
        assert.equal(p.length, 3);
        assert.equal(p[0]?.name, products[0]?.name);
        assert.equal(p[0]?.stock, 8);
        assert.match(p[0]!.price, /11,00/);
        assert.deepEqual(
          chapter.publicAt,
          carnetPublicDate(chapter.earlyAccessAt!),
        );
      },
    );
    await t.test(
      'Quatrième produit, doublon, référence absente et produit indisponible refusés côté serveur',
      async () => {
        for (const [ids, pattern] of [
          [products.map((p) => p.id), /trois/],
          [[products[0]!.id, products[0]!.id], /qu’une fois/],
          [[randomUUID()], /introuvable/],
        ] as const)
          await assert.rejects(
            saveCarnetChapter(
              admin.id,
              form({ ...fields, ...refs(), productIds: JSON.stringify(ids) }),
            ),
            pattern,
          );
        await db.product.update({
          where: { id: products[3]!.id },
          data: { isDemonstration: true },
        });
        await assert.rejects(
          saveCarnetChapter(
            admin.id,
            form({
              ...fields,
              ...refs(),
              productIds: JSON.stringify([products[3]!.id]),
            }),
          ),
          /indisponible/,
        );
        await assert.rejects(
          db.carnetComptoirProduct.create({
            data: {
              chapterId: chapter.id,
              productId: products[3]!.id,
              position: 3,
            },
          }),
        );
      },
    );
    await t.test(
      'Suppression/réorganisation, nouvel extrait et métadonnées email sauvegardés sans deuxième campagne',
      async () => {
        chapter = await saveCarnetChapter(
          admin.id,
          form({
            ...fields,
            ...refs(),
            emailSubject: 'Dernier objet sauvegardé',
            content: JSON.stringify({
              ...content,
              document: {
                ...content.document,
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      { type: 'text', text: 'DERNIER_EXTRAIT_SAUVEGARDE' },
                    ],
                  },
                  ...content.document.content.slice(1),
                ],
              },
            }),
            productIds: JSON.stringify([products[2]!.id, products[0]!.id]),
          }),
        );
        campaign = await db.newsletterCampaign.findUniqueOrThrow({
          where: { id: chapter.editionCampaignId! },
        });
        assert.equal(
          await db.newsletterCampaign.count({
            where: { chapterId: chapter.id },
          }),
          1,
        );
        assert.deepEqual(
          (await chapterComptoir(db, chapter.id)).map((p) => p.id),
          [products[2]!.id, products[0]!.id],
        );
      },
    );
    await t.test(
      'Test utilise la dernière version enregistrée, sans appel réel à Resend',
      async () => {
        const names = [
            'EMAILS_ENABLED',
            'EMAIL_PROVIDER_API_KEY',
            'EMAIL_FROM',
            'EMAIL_TEST_RECIPIENT',
            'EMAIL_REPLY_TO',
            'MARKETING_EMAIL_PROVIDER_API_KEY',
          ] as const,
          prior = Object.fromEntries(names.map((n) => [n, process.env[n]])),
          original = globalThis.fetch;
        let envelope: EmailEnvelope | undefined;
        Object.assign(process.env, {
          EMAILS_ENABLED: 'true',
          EMAIL_PROVIDER_API_KEY: 'fake_test_key',
          EMAIL_FROM: 'QA <qa@example.com>',
          EMAIL_TEST_RECIPIENT: 'qa@example.com',
          EMAIL_REPLY_TO: '',
          MARKETING_EMAIL_PROVIDER_API_KEY: '',
        });
        globalThis.fetch = async (input, init) => {
          assert.equal(String(input), 'https://api.resend.com/emails');
          envelope = JSON.parse(String(init?.body));
          return Response.json({ id: 'mock-test' });
        };
        try {
          await sendNewsletterCampaignTest(
            admin,
            form({
              id: campaign.id,
              chapterRevision: String(chapter.revision),
              campaignUpdatedAt: campaign.updatedAt.toISOString(),
            }),
          );
          assert.match(envelope!.subject, /Dernier objet sauvegardé/);
          assert.match(envelope!.html, /DERNIER_EXTRAIT_SAUVEGARDE/);
          assert.doesNotMatch(envelope!.html, /RECIT_CANONIQUE_RESERVE/);
          assert.match(envelope!.html, /Le Comptoir/);
          const audit = await db.adminAuditLog.findFirstOrThrow({
            where: {
              entityId: campaign.id,
              action: 'NEWSLETTER_CAMPAIGN_TEST_SENT',
            },
            orderBy: { createdAt: 'desc' },
          });
          assert.deepEqual(audit.metadata, {
            chapterRevision: chapter.revision,
            campaignUpdatedAt: campaign.updatedAt.toISOString(),
          });
        } finally {
          globalThis.fetch = original;
          for (const n of names) {
            if (prior[n] === undefined) delete process.env[n];
            else process.env[n] = prior[n];
          }
        }
      },
    );
    await t.test(
      'Mode avancé : snapshot sans modification du récit et relation protégée',
      async () => {
        const before = chapter.content;
        campaign = await customizeCarnetEdition(admin.id, form(refs()));
        assert.equal(campaign.carnetCustomized, true);
        assert.match(
          renderCarnetCampaign(campaign, chapter, { logo: '' }).html,
          /DERNIER_EXTRAIT_SAUVEGARDE/,
        );
        assert.doesNotMatch(campaign.bodyMarkdown, /RECIT_CANONIQUE_RESERVE/);
        assert.deepEqual(
          (
            await db.carnetChapter.findUniqueOrThrow({
              where: { id: chapter.id },
            })
          ).content,
          before,
        );
        await assert.rejects(
          saveNewsletterCampaign(
            admin.id,
            form({
              id: campaign.id,
              internalName: campaign.internalName,
              subject: campaign.subject,
              heading: campaign.heading,
              bodyMarkdown: campaign.bodyMarkdown,
              chapterId: '',
            }),
          ),
          /rester associée/,
        );
        const body = campaign.bodyMarkdown;
        chapter = await saveCarnetChapter(
          admin.id,
          form({
            ...fields,
            ...refs(),
            title: 'Titre web modifié',
            productIds: '[]',
          }),
        );
        campaign = await db.newsletterCampaign.findUniqueOrThrow({
          where: { id: campaign.id },
        });
        assert.equal(campaign.bodyMarkdown, body);
        assert.equal(campaign.heading, 'Quand le lac recula');
        await restoreAutomaticCarnetEdition(admin.id, form(refs()));
        campaign = await db.newsletterCampaign.findUniqueOrThrow({
          where: { id: campaign.id },
        });
        assert.equal(campaign.carnetCustomized, false);
      },
    );
    await t.test(
      'Conflit entre Studio et Carnet : objet récent conservé',
      async () => {
        const stale = refs();
        await db.newsletterCampaign.update({
          where: { id: campaign.id },
          data: { subject: 'Objet récent' },
        });
        await assert.rejects(
          saveCarnetChapter(admin.id, form({ ...fields, ...stale })),
          /autre onglet/,
        );
        campaign = await db.newsletterCampaign.findUniqueOrThrow({
          where: { id: campaign.id },
        });
        assert.equal(campaign.subject, 'Objet récent');
      },
    );
    await t.test(
      'Programmation refuse une édition incomplète et laisse le calendrier inactif',
      async () => {
        chapter = await saveCarnetChapter(
          admin.id,
          form({
            ...fields,
            ...refs(),
            illustrationUrl: '',
            illustrationAlt: '',
            productIds: '[]',
          }),
        );
        campaign = await db.newsletterCampaign.findUniqueOrThrow({
          where: { id: campaign.id },
        });
        await assert.rejects(
          queueNewsletterCampaign(admin.id, form({ id: campaign.id })),
          /image principale/,
        );
        assert.equal(
          (
            await db.carnetChapter.findUniqueOrThrow({
              where: { id: chapter.id },
            })
          ).releaseCampaignId,
          null,
        );
        chapter = await saveCarnetChapter(
          admin.id,
          form({
            ...fields,
            ...refs(),
            productIds: JSON.stringify([products[0]!.id]),
          }),
        );
        campaign = await db.newsletterCampaign.findUniqueOrThrow({
          where: { id: campaign.id },
        });
      },
    );
    const sub = await db.newsletterSubscriber.create({
      data: {
        email: `edition-${key}@example.com`,
        status: 'ACTIVE',
        consentAt: new Date(),
        consentSource: 'test',
        consentVersion: 'test',
        confirmedAt: new Date(),
        lastInterestAt: new Date(),
      },
    });
    try {
      await t.test(
        'Programmation existante : J+14, produits figés et annulation réversible',
        async () => {
          await queueNewsletterCampaign(
            admin.id,
            form({
              id: campaign.id,
              scheduledAt: date.toISOString(),
              campaignUpdatedAt: campaign.updatedAt.toISOString(),
              chapterRevision: String(chapter.revision),
            }),
          );
          campaign = await db.newsletterCampaign.findUniqueOrThrow({
            where: { id: campaign.id },
          });
          chapter = await db.carnetChapter.findUniqueOrThrow({
            where: { id: chapter.id },
          });
          assert.equal(chapter.releaseCampaignId, campaign.id);
          assert.deepEqual(chapter.publicAt, carnetPublicDate(date));
          const rendered = renderCarnetCampaign(campaign, chapter, {
            logo: '',
          });
          assert.match(rendered.html, /11,00/);
          await db.productVariant.updateMany({
            where: { productId: products[0]!.id },
            data: { price: 99 },
          });
          assert.match(
            renderCarnetCampaign(campaign, chapter, { logo: '' }).html,
            /11,00/,
          );
          await assert.rejects(
            saveCarnetChapter(admin.id, form({ ...fields, ...refs() })),
            /diffusion/,
          );
          await cancelNewsletterCampaign(admin.id, form({ id: campaign.id }));
          chapter = await db.carnetChapter.findUniqueOrThrow({
            where: { id: chapter.id },
          });
          campaign = await db.newsletterCampaign.findUniqueOrThrow({
            where: { id: campaign.id },
          });
        },
      );
      await t.test(
        'Snapshot avancé envoyé par le worker avec lien signé et récit réservé absent',
        async () => {
          campaign = await customizeCarnetEdition(admin.id, form(refs()));
          await queueNewsletterCampaign(
            admin.id,
            form({ id: campaign.id, sendMode: 'now' }),
          );
          const messages: EmailEnvelope[] = [];
          await processNewsletterDeliveries({
            limit: 1,
            provider: {
              name: 'mock',
              async send(envelope) {
                messages.push(envelope);
                return { id: 'mock-delivery' };
              },
            },
            settings: {
              from: 'qa@example.com',
              replyTo: undefined,
              testRecipient: undefined,
            },
          });
          assert.equal(messages.length, 1);
          assert.match(messages[0]!.html, /access=v1/);
          assert.doesNotMatch(messages[0]!.html, /RECIT_CANONIQUE_RESERVE/);
          assert.ok(
            (
              await db.carnetChapter.findUniqueOrThrow({
                where: { id: chapter.id },
              })
            ).publishedAt,
          );
        },
      );
    } finally {
      await db.newsletterCampaignDelivery.deleteMany({
        where: { campaignId: campaign.id },
      });
      await db.newsletterSubscriber.delete({ where: { id: sub.id } });
    }
  } finally {
    await db.carnetChapter.deleteMany({ where: { createdById: admin.id } });
    await db.newsletterCampaign.deleteMany({
      where: { createdById: admin.id },
    });
    await db.adminAuditLog.deleteMany({ where: { adminUserId: admin.id } });
    await db.productVariant.deleteMany({
      where: { productId: { in: products.map((p) => p.id) } },
    });
    await db.product.deleteMany({
      where: { id: { in: products.map((p) => p.id) } },
    });
    await db.category.delete({ where: { id: category.id } });
    await db.adminUser.delete({ where: { id: admin.id } });
    await db.$disconnect();
  }
});
