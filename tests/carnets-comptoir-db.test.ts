import { carnetTestProof } from './helpers/carnet-test-proof';
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { getPrisma } from '../src/lib/db/prisma';
import { saveCarnetChapter } from '../src/lib/carnets/admin';
import { chapterComptoir, loadComptoir } from '../src/lib/carnets/comptoir';
import {
  queueNewsletterCampaign,
  cancelNewsletterCampaign,
} from '../src/lib/newsletter/campaigns';
import { replaceComptoirProduct } from '../src/lib/carnets/comptoir-selection';
if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1'].includes(
    new URL(process.env.DATABASE_URL ?? 'invalid:').hostname,
  )
)
  throw new Error('Local database only');
const db = getPrisma();
function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [k, v] of Object.entries(values)) data.set(k, v);
  return data;
}
test('Comptoir PostgreSQL : références seules et revérification effective du stock avant programmation', async (t) => {
  const key = randomUUID(),
    admin = await db.adminUser.create({
      data: { name: 'Comptoir QA', email: `comptoir-${key}@example.com` },
    }),
    category = await db.category.create({
      data: { name: 'Comptoir QA', slug: `comptoir-${key}` },
    });
  const products = await Promise.all(
    [1, 2, 3, 4].map((n) =>
      db.product.create({
        data: {
          name: `Comptoir QA ${n}`,
          slug: `comptoir-${key}-${n}`,
          categoryId: category.id,
          status: 'ACTIVE',
          productType: 'ETB',
          variants: {
            create: {
              sku: `comptoir-${key}-${n}`,
              price: 10 + n,
              stockQuantity: 4,
              reservedQuantity: 2,
            },
          },
        },
        include: { variants: true },
      }),
    ),
  );
  const ids = products.slice(0, 3).map((p) => p.id),
    variant = products[0]!.variants[0]!;
  const additional = await db.productVariant.create({
    data: {
      productId: products[0]!.id,
      sku: `comptoir-${key}-reserved`,
      price: 20,
      stockQuantity: 3,
      reservedQuantity: 3,
    },
  });
  await db.productVariant.create({
    data: {
      productId: products[0]!.id,
      sku: `comptoir-${key}-inactive`,
      price: 1,
      stockQuantity: 50,
      isActive: false,
    },
  });
  const fields = {
    revision: '0',
    number: '678904',
    title: 'Comptoir QA',
    slug: `comptoir-${key}`,
    status: 'READY',
    content: JSON.stringify({
      version: 1,
      document: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Extrait du récit.' }],
          },
          { type: 'newsletterCut' },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Suite réservée du récit.' }],
          },
        ],
      },
    }),
    illustrationUrl: '/assets/brand/logo-header-no-bg.png',
    illustrationAlt: 'Caldera',
    emailSubject: 'Comptoir QA',
    emailPreheader: 'Sélection QA',
    productIds: JSON.stringify(ids),
  };
  let chapter = await saveCarnetChapter(admin.id, form(fields));
  const campaignId = chapter.editionCampaignId!;
  try {
    await t.test(
      'Stock disponible = stock moins réservations des variantes actives ; prix de la variante disponible',
      async () => {
        const [p] = await chapterComptoir(db, chapter.id);
        assert.equal(p?.stock, 2);
        assert.equal(p?.eligible, true);
        assert.match(p!.price, /11,00/);
        await assert.rejects(
          loadComptoir(
            db,
            products.map((p) => p.id),
          ),
          /trois/,
        );
      },
    );
    await t.test(
      'Remplacement complet persisté en conservant les autres références et leur ordre',
      async () => {
        const next = replaceComptoirProduct(ids, ids[0]!, products[3]!.id);
        chapter = await saveCarnetChapter(
          admin.id,
          form({
            ...fields,
            id: chapter.id,
            revision: String(chapter.revision),
            productIds: JSON.stringify(next),
          }),
        );
        assert.deepEqual(
          (await chapterComptoir(db, chapter.id)).map((p) => p.id),
          next,
        );
        chapter = await saveCarnetChapter(
          admin.id,
          form({
            ...fields,
            id: chapter.id,
            revision: String(chapter.revision),
          }),
        );
        const references = await db.carnetComptoirProduct.findMany({
          where: { chapterId: chapter.id },
        });
        assert.deepEqual(Object.keys(references[0]!).sort(), [
          'chapterId',
          'position',
          'productId',
        ]);
      },
    );
    const cases = [
      {
        name: 'produit désactivé après sauvegarde',
        set: () =>
          db.product.update({
            where: { id: ids[0]! },
            data: { status: 'DRAFT' },
          }),
        restore: () =>
          db.product.update({
            where: { id: ids[0]! },
            data: { status: 'ACTIVE' },
          }),
        reason: /non publié/,
      },
      {
        name: 'aucune variante active après sauvegarde',
        set: () =>
          db.productVariant.updateMany({
            where: { productId: ids[0]! },
            data: { isActive: false },
          }),
        restore: () =>
          db.productVariant.updateMany({
            where: { id: { in: [variant.id, additional.id] } },
            data: { isActive: true },
          }),
        reason: /variante active/,
      },
      {
        name: 'produit épuisé après sauvegarde',
        set: () =>
          db.productVariant.update({
            where: { id: variant.id },
            data: { stockQuantity: 2 },
          }),
        restore: () =>
          db.productVariant.update({
            where: { id: variant.id },
            data: { stockQuantity: 4 },
          }),
        reason: /épuisé/,
      },
      {
        name: 'tout le stock disponible réservé après sauvegarde',
        set: () =>
          db.productVariant.update({
            where: { id: variant.id },
            data: { reservedQuantity: 4 },
          }),
        restore: () =>
          db.productVariant.update({
            where: { id: variant.id },
            data: { reservedQuantity: 2 },
          }),
        reason: /épuisé/,
      },
    ];
    for (const c of cases)
      await t.test(`Programmation bloquée : ${c.name}`, async () => {
        await c.set();
        try {
          const [p] = await chapterComptoir(db, chapter.id, false);
          assert.equal(p?.eligible, false);
          assert.match(p!.unavailableReason!, c.reason);
          await assert.rejects(
            queueNewsletterCampaign(admin.id, form({ id: campaignId })),
            (e) =>
              Boolean(
                e instanceof Error &&
                /Envoi bloqué/.test(e.message) &&
                e.message.includes(products[0]!.name) &&
                c.reason.test(e.message),
              ),
          );
          assert.equal(
            await db.newsletterCampaignDelivery.count({
              where: { campaignId },
            }),
            0,
          );
          assert.equal(
            (
              await db.newsletterCampaign.findUniqueOrThrow({
                where: { id: campaignId },
              })
            ).status,
            'DRAFT',
          );
          assert.equal(
            (
              await db.carnetChapter.findUniqueOrThrow({
                where: { id: chapter.id },
              })
            ).releaseCampaignId,
            null,
          );
        } finally {
          await c.restore();
        }
      });
    await t.test(
      'Comptoir vide : programmation autorisée avec le même moteur newsletter',
      async () => {
        chapter = await saveCarnetChapter(
          admin.id,
          form({
            ...fields,
            id: chapter.id,
            revision: String(chapter.revision),
            productIds: '[]',
          }),
        );
        assert.deepEqual(await chapterComptoir(db, chapter.id), []);
        const sub = await db.newsletterSubscriber.create({
          data: {
            email: `comptoir-${key}@example.com`,
            status: 'ACTIVE',
            consentAt: new Date(),
            consentSource: 'test',
            consentVersion: 'test',
            confirmedAt: new Date(),
            lastInterestAt: new Date(),
          },
        });
        try {
          await carnetTestProof(admin.id, campaignId);
          const queued = await queueNewsletterCampaign(
            admin.id,
            form({ id: campaignId }),
          );
          assert.equal(queued.status, 'QUEUED');
          assert.equal(
            await db.newsletterCampaignDelivery.count({
              where: { campaignId },
            }),
            1,
          );
          await cancelNewsletterCampaign(admin.id, form({ id: campaignId }));
        } finally {
          await db.newsletterCampaignDelivery.deleteMany({
            where: { campaignId },
          });
          await db.newsletterSubscriber.delete({ where: { id: sub.id } });
        }
      },
    );
  } finally {
    await db.newsletterCampaignDelivery.deleteMany({ where: { campaignId } });
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
