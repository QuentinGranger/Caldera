import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { getPrisma } from '../src/lib/db/prisma';
import { readCarnetArcs } from '../src/lib/carnets/arcs';
import { emptyCarnetContent } from '../src/lib/carnets/content';
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
        content: [{ type: 'text', text: 'Un extrait prêt.' }],
      },
      { type: 'newsletterCut' },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'La suite complète.' }],
      },
    ],
  },
};
test('Arcs PostgreSQL : 240 chapitres, pagination par arc, progression complète et filtres', async (t) => {
  const key = randomUUID(),
    now = new Date('2026-10-15T08:00:00Z');
  const admin = await db.adminUser.create({
    data: { name: 'Arcs QA', email: `arcs-${key}@example.com` },
  });
  await db.carnetChapter.createMany({
    data: Array.from({ length: 240 }, (_, i) => ({
      number: 780001 + i,
      title: `Épisode ${i + 1}`,
      slug: `arcs-${key}-${i}`,
      arcTitle: `Arc de QA ${Math.floor(i / 6) + 1}`,
      arcPosition: (i % 6) + 1,
      arcTotal: 6,
      createdById: admin.id,
      status:
        i % 6 === 5
          ? ('ARCHIVED' as const)
          : i % 6 < 3
            ? ('READY' as const)
            : ('DRAFT' as const),
      content: i % 6 === 4 ? emptyCarnetContent() : content,
      ...(i % 6 === 2
        ? {
            earlyAccessAt: new Date('2026-09-17T06:00:00Z'),
            publicAt: new Date('2026-10-01T06:00:00Z'),
            publishedAt: new Date('2026-09-17T06:00:00Z'),
          }
        : {}),
    })),
  });
  try {
    await t.test(
      'Huit arcs entiers par page ; le neuvième commence la suivante',
      async () => {
        const first = await readCarnetArcs(db, {}, now),
          next = await readCarnetArcs(db, { page: '2' }, now);
        assert.equal(first.total, 40);
        assert.equal(first.pages, 5);
        assert.equal(first.matchingChapters, 200);
        assert.equal(first.arcs.length, 8);
        assert.deepEqual(
          first.arcs.map((a) => a.number),
          [1, 2, 3, 4, 5, 6, 7, 8],
        );
        assert.equal(next.arcs[0]!.number, 9);
        assert.ok(first.arcs.every((a) => a.chapters.length === 5));
        const arc = first.arcs[0]!;
        assert.deepEqual(arc.counts, {
          ready: 2,
          public: 1,
          early: 0,
          working: 1,
          empty: 1,
          archived: 1,
        });
        assert.equal(arc.complete, 3);
        assert.equal(arc.total, 6);
        assert.deepEqual(arc.missing, []);
      },
    );
    await t.test(
      'Filtrer un épisode ne modifie ni le numéro de l’arc ni sa progression',
      async () => {
        const data = await readCarnetArcs(db, { search: 'Épisode 211' }, now);
        assert.equal(data.total, 1);
        assert.equal(data.arcs[0]!.number, 36);
        assert.equal(data.arcs[0]!.chapters.length, 1);
        assert.equal(data.arcs[0]!.complete, 3);
        assert.equal(data.arcs[0]!.chapterCount, 6);
        const drafts = await readCarnetArcs(db, { status: 'DRAFT' }, now);
        assert.equal(drafts.arcs[0]!.chapters.length, 2);
        assert.equal(drafts.arcs[0]!.complete, 3);
        const archived = await readCarnetArcs(db, { status: 'ARCHIVED' }, now);
        assert.equal(archived.matchingChapters, 40);
        assert.equal(archived.arcs[0]!.chapters[0]!.kind, 'ARCHIVED');
      },
    );
    await t.test(
      'Casse/espaces réunissent les titres, positions et totaux incohérents restent visibles',
      async () => {
        await db.carnetChapter.update({
          where: { number: 780002 },
          data: { arcTitle: ' ARC  DE QA 1 ', arcPosition: 1, arcTotal: 5 },
        });
        const data = await readCarnetArcs(db, {}, now);
        assert.equal(data.total, 40);
        assert.equal(data.arcs[0]!.chapterCount, 6);
        assert.equal(data.arcs[0]!.warnings.length, 2);
        assert.deepEqual(data.arcs[0]!.missing, []);
      },
    );
    await t.test(
      'Ordre par modification et pagination hors limites conservent la numérotation globale',
      async () => {
        await db.carnetChapter.update({
          where: { number: 780235 },
          data: { updatedAt: new Date('2090-01-01T00:00:00Z') },
        });
        const modified = await readCarnetArcs(db, { sort: 'modified' }, now);
        assert.equal(modified.arcs[0]!.number, 40);
        const last = await readCarnetArcs(db, { page: '999' }, now);
        assert.equal(last.page, 5);
        assert.equal(last.arcs.at(-1)!.number, 40);
      },
    );
    await t.test(
      'Sans arc, positions manquantes et recherche vide',
      async () => {
        await db.carnetChapter.createMany({
          data: [
            {
              number: 780241,
              title: 'Sans arc QA',
              slug: `arcs-${key}-none`,
              createdById: admin.id,
              status: 'DRAFT',
              content: emptyCarnetContent(),
            },
            {
              number: 780242,
              title: 'Arc incomplet QA',
              slug: `arcs-${key}-gap`,
              createdById: admin.id,
              status: 'DRAFT',
              content: emptyCarnetContent(),
              arcTitle: 'Arc incomplet',
              arcPosition: 1,
              arcTotal: 6,
            },
          ],
        });
        const data = await readCarnetArcs(db, { search: 'Arc incomplet' }, now);
        assert.equal(data.arcs[0]!.number, 41);
        assert.deepEqual(data.arcs[0]!.missing, [2, 3, 4, 5, 6]);
        const none = await readCarnetArcs(db, { search: 'Sans arc QA' }, now);
        assert.equal(none.arcs[0]!.number, null);
        assert.equal(none.arcs[0]!.total, 1);
        assert.deepEqual(none.arcs[0]!.missing, []);
        const empty = await readCarnetArcs(db, { search: key }, now);
        assert.equal(empty.total, 0);
        assert.equal(empty.page, 1);
        assert.deepEqual(empty.arcs, []);
      },
    );
  } finally {
    await db.carnetChapter.deleteMany({ where: { createdById: admin.id } });
    await db.adminUser.delete({ where: { id: admin.id } });
    await db.$disconnect();
  }
});
