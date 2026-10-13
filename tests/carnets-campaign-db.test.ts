import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import sharp from 'sharp';
import { getPrisma } from '../src/lib/db/prisma';
import {
  saveCarnetChapter,
  archiveCarnetChapter,
} from '../src/lib/carnets/admin';
import {
  saveNewsletterCampaign,
  duplicateNewsletterCampaign,
} from '../src/lib/newsletter/campaigns';
import { imageStorage } from '../src/lib/storage/images';
if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1'].includes(
    new URL(process.env.DATABASE_URL ?? 'invalid:').hostname,
  ) ||
  process.env.BLOB_STORE_ID ||
  process.env.BLOB_READ_WRITE_TOKEN
)
  throw new Error('Tests Carnets réservés à PostgreSQL et au stockage locaux.');
const db = getPrisma();
function form(data: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(data)) f.set(k, v);
  return f;
}
const content = {
  version: 1,
  document: {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Le lac se tut.' }],
      },
      { type: 'newsletterCut' },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'La route reparut.' }],
      },
    ],
  },
};
test('Carnet canonique : métadonnées, campagnes facultatives, duplication et indépendance des suppressions', async () => {
  const key = randomUUID();
  const admin = await db.adminUser.create({
    data: {
      email: `carnet-reference-${key}@example.com`,
      name: 'Carnets relation QA',
    },
  });
  const chapterFields = {
    number: '678901',
    title: 'Quand le lac recula',
    slug: `678901-${key}`,
    revision: '0',
    status: 'READY',
    content: JSON.stringify(content),
  };
  const campaignFields = {
    internalName: 'Carnet QA',
    subject: 'Le lac',
    heading: 'Le lac',
    bodyMarkdown: 'Message marketing indépendant.',
  };
  let uploaded: string | undefined;
  try {
    const chapter = await saveCarnetChapter(
      admin.id,
      form({
        ...chapterFields,
        location: 'Cœurlac',
        earlyAccessAt: '2026-10-20T09:00',
        publicAt: '2026-11-03T09:00',
      }),
    );
    assert.equal(
      await db.newsletterCampaign.count({ where: { chapterId: chapter.id } }),
      0,
    );
    assert.equal(chapter.location, 'Cœurlac');
    assert.equal(
      chapter.earlyAccessAt?.toISOString(),
      '2026-10-20T07:00:00.000Z',
    );
    assert.equal(chapter.publishedAt, null);
    const normal = await saveNewsletterCampaign(admin.id, form(campaignFields));
    assert.equal(normal.chapterId, null);
    const linked = await saveNewsletterCampaign(
      admin.id,
      form({ ...campaignFields, chapterId: chapter.id }),
    );
    assert.equal(linked.chapterId, chapter.id);
    const edited = await saveNewsletterCampaign(
      admin.id,
      form({ ...campaignFields, id: linked.id, subject: 'Un autre objet' }),
    );
    assert.equal(
      edited.chapterId,
      chapter.id,
      'ancien formulaire : conserver la référence absente',
    );
    const copy = await duplicateNewsletterCampaign(
      admin.id,
      form({ id: linked.id }),
    );
    assert.equal(copy.chapterId, chapter.id);
    assert.equal(
      await db.carnetChapter.count({ where: { createdById: admin.id } }),
      1,
    );
    assert.deepEqual(
      (await db.carnetChapter.findUniqueOrThrow({ where: { id: chapter.id } }))
        .content,
      content,
    );
    const detached = await saveNewsletterCampaign(
      admin.id,
      form({ ...campaignFields, id: copy.id, chapterId: '' }),
    );
    assert.equal(detached.chapterId, null);
    await assert.rejects(
      saveNewsletterCampaign(
        admin.id,
        form({ ...campaignFields, chapterId: randomUUID() }),
      ),
      /Carnet introuvable/,
    );
    await assert.rejects(
      saveNewsletterCampaign(
        admin.id,
        form({ ...campaignFields, chapterId: 'bad' }),
      ),
      /invalide/,
    );
    await db.adminAuditLog.deleteMany({
      where: { adminUserId: admin.id, entityId: linked.id },
    });
    await db.newsletterCampaign.delete({ where: { id: linked.id } });
    assert.ok(
      await db.carnetChapter.findUnique({ where: { id: chapter.id } }),
      'supprimer une campagne conserve le chapitre',
    );
    const linkedAgain = await saveNewsletterCampaign(
      admin.id,
      form({ ...campaignFields, chapterId: chapter.id }),
    );
    const legacySaved = await saveCarnetChapter(
      admin.id,
      form({ ...chapterFields, id: chapter.id, title: 'Titre corrigé' }),
    );
    assert.equal(legacySaved.location, 'Cœurlac');
    assert.equal(
      legacySaved.publicAt?.toISOString(),
      '2026-11-03T08:00:00.000Z',
    );
    await assert.rejects(
      saveCarnetChapter(
        admin.id,
        form({
          ...chapterFields,
          id: chapter.id,
          revision: String(legacySaved.revision),
          publicAt: '2026-10-10T09:00',
        }),
      ),
      /postérieure/,
    );
    await assert.rejects(
      saveCarnetChapter(
        admin.id,
        form({
          ...chapterFields,
          id: chapter.id,
          revision: String(legacySaved.revision),
          illustrationUrl: '/assets/example.webp',
        }),
      ),
      /alternatif/,
    );
    const imageForm = form({
      ...chapterFields,
      id: chapter.id,
      revision: String(legacySaved.revision),
      illustrationAlt: 'Une rive de lac',
    });
    imageForm.set(
      'illustrationFile',
      new File(
        [
          new Uint8Array(
            await sharp({
              create: {
                width: 16,
                height: 16,
                channels: 3,
                background: '#35604c',
              },
            })
              .png()
              .toBuffer(),
          ),
        ],
        'lake.png',
        { type: 'image/png' },
      ),
    );
    const illustrated = await saveCarnetChapter(admin.id, imageForm);
    uploaded = illustrated.illustrationUrl!;
    assert.match(uploaded, /^\/media\/.*\.webp$/);
    assert.equal(illustrated.illustrationAlt, 'Une rive de lac');
    await db.carnetChapter.update({
      where: { id: chapter.id },
      data: { status: 'PUBLIC', publishedAt: new Date('2026-10-01T07:00:00Z') },
    });
    await assert.rejects(
      saveCarnetChapter(
        admin.id,
        form({
          ...chapterFields,
          id: chapter.id,
          revision: String(illustrated.revision),
        }),
      ),
      /chapitres publiés/,
    );
    const archived = await archiveCarnetChapter(
      admin.id,
      form({ id: chapter.id, revision: String(illustrated.revision) }),
    );
    assert.equal(
      (
        await db.newsletterCampaign.findUniqueOrThrow({
          where: { id: linkedAgain.id },
        })
      ).chapterId,
      chapter.id,
    );
    assert.ok(archived.earlyAccessAt);
    const restored = await archiveCarnetChapter(
      admin.id,
      form({ id: chapter.id, revision: String(archived.revision) }),
      true,
    );
    assert.ok(restored.publishedAt);
    assert.equal(restored.status, 'READY');
    await assert.rejects(
      saveCarnetChapter(
        admin.id,
        form({
          ...chapterFields,
          id: chapter.id,
          revision: String(restored.revision),
          slug: 'adresse-modifiee',
        }),
      ),
      /adresse.*stable/,
    );
    await db.carnetChapter.delete({ where: { id: chapter.id } });
    assert.equal(
      (
        await db.newsletterCampaign.findUniqueOrThrow({
          where: { id: linkedAgain.id },
        })
      ).chapterId,
      null,
      'suppression technique : SET NULL',
    );
  } finally {
    if (uploaded) await imageStorage.delete(uploaded);
    await db.newsletterCampaign.deleteMany({
      where: { createdById: admin.id },
    });
    await db.carnetChapter.deleteMany({ where: { createdById: admin.id } });
    await db.adminAuditLog.deleteMany({ where: { adminUserId: admin.id } });
    await db.adminUser.delete({ where: { id: admin.id } });
    await db.$disconnect();
  }
});
