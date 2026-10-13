import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { getPrisma } from '../src/lib/db/prisma';
import {
  archiveCarnetChapter,
  saveCarnetChapter,
} from '../src/lib/carnets/admin';
import { deriveCarnet, parseCarnetContent } from '../src/lib/carnets/content';
if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1'].includes(
    new URL(process.env.DATABASE_URL ?? 'invalid:').hostname,
  )
)
  throw new Error('Carnets : tests réservés à PostgreSQL local.');
const db = getPrisma();
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
        content: [{ type: 'text', text: 'Puis la route reparut.' }],
      },
    ],
  },
};
function form(values: Record<string, string> = {}) {
  const f = new FormData();
  for (const [k, v] of Object.entries({
    revision: '0',
    number: '543210',
    title: 'Quand le lac recula',
    slug: '543210-qa-carnet',
    arcTitle: 'La route noyée',
    arcPosition: '1',
    arcTotal: '6',
    content: JSON.stringify(content),
    status: 'DRAFT',
    ...values,
  }))
    f.set(k, v);
  return f;
}
test('Carnets PostgreSQL : création, rechargement, unicité, conflit, archivage et audit', async () => {
  const admin = await db.adminUser.create({
    data: { email: `carnets-${randomUUID()}@example.com`, name: 'Carnets QA' },
  });
  try {
    const first = await saveCarnetChapter(admin.id, form());
    assert.equal(first.number, 543210);
    assert.equal(first.revision, 0);
    const saved = await db.carnetChapter.findUniqueOrThrow({
      where: { id: first.id },
    });
    assert.deepEqual(parseCarnetContent(saved.content), content);
    assert.equal(
      deriveCarnet(parseCarnetContent(saved.content)).excerpt?.text,
      'Le lac se tut.',
    );
    await assert.rejects(
      saveCarnetChapter(admin.id, form({ slug: '543210-duplicate-number' })),
      (e) =>
        Boolean(
          e && typeof e === 'object' && 'code' in e && e.code === 'P2002',
        ),
    );
    await assert.rejects(
      saveCarnetChapter(admin.id, form({ number: '543211' })),
      (e) =>
        Boolean(
          e && typeof e === 'object' && 'code' in e && e.code === 'P2002',
        ),
    );
    const updated = await saveCarnetChapter(
      admin.id,
      form({ id: first.id, status: 'READY', title: 'Un titre modifié' }),
    );
    assert.equal(updated.revision, 1);
    assert.equal(updated.slug, first.slug);
    await assert.rejects(
      saveCarnetChapter(admin.id, form({ id: first.id })),
      /autre onglet/,
    );
    const archiveForm = new FormData();
    archiveForm.set('id', first.id);
    archiveForm.set('revision', '1');
    const archived = await archiveCarnetChapter(admin.id, archiveForm);
    assert.equal(archived.status, 'ARCHIVED');
    await assert.rejects(
      saveCarnetChapter(admin.id, form({ id: first.id, revision: '2' })),
      /Restaurez/,
    );
    archiveForm.set('revision', '2');
    const restored = await archiveCarnetChapter(admin.id, archiveForm, true);
    assert.equal(restored.status, 'DRAFT');
    assert.deepEqual(restored.content, content);
    const concurrent = await Promise.allSettled([
      saveCarnetChapter(
        admin.id,
        form({ id: first.id, revision: '3', title: 'Version A' }),
      ),
      saveCarnetChapter(
        admin.id,
        form({ id: first.id, revision: '3', title: 'Version B' }),
      ),
    ]);
    assert.equal(concurrent.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(concurrent.filter((r) => r.status === 'rejected').length, 1);
    assert.equal(
      await db.adminAuditLog.count({
        where: { adminUserId: admin.id, entityType: 'CarnetChapter' },
      }),
      5,
    );
    await db.adminUser.update({
      where: { id: admin.id },
      data: { isActive: false },
    });
    await assert.rejects(
      saveCarnetChapter(
        admin.id,
        form({ number: '543212', slug: '543212-qa' }),
      ),
      /Session administrateur/,
    );
  } finally {
    await db.carnetChapter.deleteMany({ where: { createdById: admin.id } });
    await db.adminAuditLog.deleteMany({ where: { adminUserId: admin.id } });
    await db.adminUser.delete({ where: { id: admin.id } });
    await db.$disconnect();
  }
});
