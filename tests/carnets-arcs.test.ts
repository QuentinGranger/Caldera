import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import {
  groupCarnetArcs,
  arcChapterState,
  arcDraftDefaults,
  type ArcChapter,
} from '../src/lib/carnets/arcs-model';
import { emptyCarnetContent } from '../src/lib/carnets/content';
const content = {
  version: 1,
  document: {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Le début du récit.' }],
      },
      { type: 'newsletterCut' },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'La suite du récit.' }],
      },
    ],
  },
};
const chapter = (number: number, overrides: Partial<ArcChapter> = {}) => ({
  id: randomUUID(),
  number,
  title: `Chapitre ${number}`,
  arcTitle: 'La chaussée',
  arcPosition: number,
  arcTotal: 6,
  status: 'DRAFT' as const,
  updatedAt: new Date('2026-10-01T08:00:00Z'),
  earlyAccessAt: null,
  publicAt: null,
  publishedAt: null,
  releaseCampaignId: null,
  ...overrides,
});
test('Arcs : casse/espaces normalisés, titre conservé et numéros chronologiques', () => {
  const groups = groupCarnetArcs([
    chapter(8, { arcTitle: 'LA FORÊT  CADASTRÉE', arcPosition: 2 }),
    chapter(1),
    chapter(7, { arcTitle: ' La forêt cadastrée ', arcPosition: 1 }),
    chapter(2, { arcTitle: 'LA CHAUSSÉE ' }),
    chapter(9, { arcTitle: null, arcPosition: null, arcTotal: null }),
  ]);
  assert.equal(groups.length, 3);
  assert.equal(groups[0]!.number, 1);
  assert.equal(groups[0]!.chapters.length, 2);
  assert.equal(groups[1]!.number, 2);
  assert.equal(groups[1]!.title, 'La forêt cadastrée');
  assert.equal(groups[2]!.number, null);
});
test('Arcs : ordre des positions, puis numéro et positions réellement vacantes', () => {
  const group = groupCarnetArcs([
    chapter(12, { arcPosition: 6 }),
    chapter(9, { arcPosition: 3 }),
    chapter(7, { arcPosition: 1 }),
  ])[0]!;
  assert.deepEqual(
    group.chapters.map((c) => c.number),
    [7, 9, 12],
  );
  assert.deepEqual(group.missing, [2, 4, 5]);
  assert.equal(group.total, 6);
  assert.deepEqual(group.warnings, []);
});
test('Arcs : totaux incohérents, positions dupliquées et non renseignées signalés sans faux emplacements', () => {
  const group = groupCarnetArcs([
    chapter(1),
    chapter(2, { arcPosition: 1, arcTotal: 5 }),
    chapter(3, { arcPosition: null, arcTotal: null }),
  ])[0]!;
  assert.equal(group.warnings.length, 3);
  assert.deepEqual(group.missing, []);
  assert.equal(group.total, 6);
  const overflow = groupCarnetArcs([
    chapter(1, { arcTotal: 1 }),
    chapter(2, { arcPosition: 1, arcTotal: 1 }),
  ])[0]!;
  assert.equal(overflow.total, 2);
  assert.ok(overflow.warnings.some((w) => w.includes('dépasse')));
});
test('Chapitre : vide, entamé, texte prêt et READY incomplet', () => {
  assert.equal(
    arcChapterState({ ...chapter(1), content: emptyCarnetContent() }).kind,
    'EMPTY',
  );
  assert.equal(arcChapterState({ ...chapter(1), content }).kind, 'WORKING');
  assert.equal(
    arcChapterState({ ...chapter(1, { status: 'READY' }), content }).kind,
    'READY',
  );
  assert.equal(
    arcChapterState({
      ...chapter(1, { status: 'READY' }),
      content: emptyCarnetContent(),
    }).kind,
    'EMPTY',
  );
  assert.equal(
    arcChapterState({ ...chapter(1), content: {} }).label,
    'À compléter',
  );
});
test('Publication : premier envoi ≠ public, dates seules ≠ publication, archives exclues de la progression', () => {
  const dated = chapter(1, {
    status: 'READY',
    earlyAccessAt: new Date('2026-10-10T06:00:00Z'),
    publicAt: new Date('2026-10-24T06:00:00Z'),
    publishedAt: new Date('2026-10-10T06:00:00Z'),
  });
  assert.equal(
    arcChapterState({ ...dated, content }, new Date('2026-10-15T08:00:00Z'))
      .kind,
    'EARLY',
  );
  assert.equal(
    arcChapterState({ ...dated, content }, new Date('2026-10-24T06:00:00Z'))
      .kind,
    'PUBLIC',
  );
  assert.equal(
    arcChapterState(
      { ...dated, publishedAt: null, content },
      new Date('2026-10-25T08:00:00Z'),
    ).kind,
    'READY',
  );
  assert.equal(
    arcChapterState(
      { ...dated, status: 'ARCHIVED', content },
      new Date('2026-10-25T08:00:00Z'),
    ).kind,
    'ARCHIVED',
  );
});
test('Préparation d’une position : champs bornés, aucun numéro global inventé', () => {
  assert.deepEqual(
    arcDraftDefaults({
      arcTitle: ' La forêt  cadastrée ',
      arcPosition: '004',
      arcTotal: '6',
    }),
    { arcTitle: 'La forêt cadastrée', arcPosition: '4', arcTotal: '6' },
  );
  assert.deepEqual(
    arcDraftDefaults({ arcTitle: ['x'], arcPosition: '1001', arcTotal: '-2' }),
    { arcTitle: '', arcPosition: '', arcTotal: '' },
  );
  assert.equal(
    arcDraftDefaults({ arcPosition: '5', arcTotal: '3' }).arcTotal,
    '',
  );
});
