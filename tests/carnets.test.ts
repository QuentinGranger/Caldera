import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  carnetCta,
  carnetEditorialWarnings,
  carnetWordCount,
  deriveCarnet,
  emptyCarnetContent,
  moveCarnetCut,
  parseCarnetContent,
  removeCarnetCut,
  suggestCarnetSlug,
  type CarnetContent,
} from '../src/lib/carnets/content';
import { carnetInput } from '../src/lib/carnets/input';
const paragraph = (text: string) => ({
  type: 'paragraph' as const,
  content: [{ type: 'text' as const, text }],
});
const sample = (): CarnetContent => ({
  version: 1,
  document: {
    type: 'doc',
    content: [
      paragraph('A'),
      paragraph('B'),
      paragraph('C'),
      { type: 'newsletterCut' },
      paragraph('D'),
      paragraph('E'),
    ],
  },
});
function form(overrides: Record<string, string> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    revision: '0',
    number: '1',
    title: 'Quand le lac recula',
    slug: '',
    arcTitle: 'La route noyée',
    arcPosition: '1',
    arcTotal: '6',
    status: 'DRAFT',
    content: JSON.stringify(sample()),
    ...overrides,
  }))
    data.set(key, value);
  return data;
}

test('Carnets : source unique, chapitre et extrait sans marqueur', () => {
  const content = sample();
  const derived = deriveCarnet(parseCarnetContent(JSON.stringify(content)));
  assert.equal(derived.full.text, 'A\n\nB\n\nC\n\nD\n\nE');
  assert.equal(derived.excerpt?.text, 'A\n\nB\n\nC');
  assert.equal(derived.full.words, 5);
  assert.equal(derived.excerpt?.words, 3);
  assert.doesNotMatch(
    derived.full.html + derived.excerpt?.html,
    /newsletterCut|FIN DE|CUT|✂/,
  );
  assert.deepEqual(parseCarnetContent(JSON.stringify(content)), content);
});
test('Carnets : modifier avant ou après la coupure actualise seulement les rendus concernés', () => {
  const initial = deriveCarnet(sample());
  const before = sample();
  before.document.content[1] = paragraph('B modifié');
  const first = deriveCarnet(before);
  assert.notEqual(first.full.text, initial.full.text);
  assert.notEqual(first.excerpt?.text, initial.excerpt?.text);
  const after = sample();
  after.document.content[5] = paragraph('E modifié');
  const second = deriveCarnet(after);
  assert.notEqual(second.full.text, initial.full.text);
  assert.equal(second.excerpt?.text, initial.excerpt?.text);
  assert.equal(first.cutIndex, initial.cutIndex);
  assert.equal(second.cutIndex, initial.cutIndex);
});
test('Carnets : déplacer, retirer et refuser une deuxième coupure', () => {
  const moved = moveCarnetCut(sample(), 3);
  assert.equal(deriveCarnet(moved).excerpt?.text, 'A\n\nB\n\nC\n\nD');
  assert.equal(
    moved.document.content.filter((b) => b.type === 'newsletterCut').length,
    1,
  );
  const removed = removeCarnetCut(moved);
  assert.equal(deriveCarnet(removed).excerpt, null);
  assert.equal(
    deriveCarnet(removed).full.text,
    deriveCarnet(sample()).full.text,
  );
  assert.throws(() => moveCarnetCut(sample(), 99), /paragraphe/);
  const duplicate = sample();
  duplicate.document.content.push({ type: 'newsletterCut' });
  assert.throws(() => parseCarnetContent(duplicate), /seule coupure/);
  assert.throws(
    () =>
      parseCarnetContent({
        version: 1,
        document: {
          type: 'doc',
          content: [
            { type: 'blockquote', content: [{ type: 'newsletterCut' }] },
          ],
        },
      }),
    /paragraphes/,
  );
});
test('Carnets : compteurs, apostrophes françaises, titres et paragraphes vides', () => {
  assert.equal(
    carnetWordCount('L’expédition du lac.\n\n— Cœurlac attend 3 voyageurs !'),
    7,
  );
  const content = parseCarnetContent({
    version: 1,
    document: {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Le lac' }],
        },
        { type: 'paragraph' },
        { type: 'blockquote', content: [paragraph('Un silence profond.')] },
        { type: 'newsletterCut' },
        paragraph('La suite.'),
      ],
    },
  });
  assert.equal(deriveCarnet(content).full.words, 7);
  assert.equal(deriveCarnet(content).excerpt?.words, 5);
  assert.match(deriveCarnet(content).full.html, /<h2>Le lac<\/h2>/);
});
test('Carnets : slug proposé et CTA dérivés sans saisie séparée', () => {
  assert.equal(
    suggestCarnetSlug(1, 'Quand le lac recula'),
    '001-quand-le-lac-recula',
  );
  assert.equal(
    suggestCarnetSlug(7, 'Cœurlac et l’éclipse'),
    '007-coeurlac-et-l-eclipse',
  );
  assert.equal(suggestCarnetSlug(1, ''), '');
  assert.deepEqual(carnetCta('001-quand-le-lac-recula'), {
    label: 'Continuer l’expédition',
    href: '/univers/carnets/001-quand-le-lac-recula',
  });
  assert.equal(carnetInput(form()).data.slug, '001-quand-le-lac-recula');
  assert.equal(
    carnetInput(form({ slug: '001-un-autre-titre' })).data.slug,
    '001-un-autre-titre',
  );
});
test('Carnets : un ancien chapitre sans coupure n’expose pas le récit complet comme extrait', () => {
  const content = parseCarnetContent({
    version: 1,
    document: {
      type: 'doc',
      content: [paragraph('Ancien chapitre sans coupure.')],
    },
  });
  assert.equal(deriveCarnet(content).excerpt, null);
  assert.equal(deriveCarnet(content).full.words, 4);
  assert.ok(
    carnetEditorialWarnings(content).some((w) => w.includes('aucun extrait')),
  );
  assert.equal(deriveCarnet(emptyCarnetContent()).full.words, 0);
});
test('Carnets : validation serveur des métadonnées et absence de deux textes éditables', () => {
  assert.equal(carnetInput(form({ status: 'READY' })).data.status, 'READY'); // Word targets are recommendations only.
  assert.ok(carnetEditorialWarnings(sample()).length >= 2);
  const invalidCases: Record<string, string>[] = [
    { number: '0' },
    { number: '1.2' },
    { title: '' },
    { slug: '../../secret' },
    { arcPosition: '7' },
    { arcTotal: '' },
    { arcTitle: '' },
    { status: 'PUBLISHED' },
    { revision: '3' },
    { newsletterExcerpt: 'copie' },
    { fullChapter: 'copie' },
  ];
  for (const overrides of invalidCases)
    assert.throws(() => carnetInput(form(overrides)));
  assert.throws(
    () =>
      carnetInput(
        form({
          status: 'READY',
          content: JSON.stringify(removeCarnetCut(sample())),
        }),
      ),
    /coupure/,
  );
  assert.throws(
    () =>
      carnetInput(
        form({
          status: 'READY',
          content: JSON.stringify(moveCarnetCut(sample(), 4)),
        }),
      ),
    /avant et après/,
  );
});
test('Carnets : HTML échappé, schéma borné et nœuds non narratifs interdits', () => {
  const content = parseCarnetContent({
    version: 1,
    document: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: '<script>alert(1)</script>',
              marks: [{ type: 'bold' }],
            },
          ],
        },
      ],
    },
  });
  assert.doesNotMatch(deriveCarnet(content).full.html, /<script>/);
  assert.match(deriveCarnet(content).full.html, /&lt;script&gt;/);
  for (const node of [
    { type: 'image', attrs: { src: 'https://evil.example/pixel' } },
    { type: 'html', text: '<script>' },
    { type: 'heading', attrs: { level: 1 } },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'Piège',
          marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
        },
      ],
    },
  ])
    assert.throws(() =>
      parseCarnetContent({
        version: 1,
        document: { type: 'doc', content: [node] },
      }),
    );
  assert.throws(() => parseCarnetContent('{broken'), /illisible/);
  assert.throws(() => parseCarnetContent(' '.repeat(100001)), /100 000/);
  assert.throws(
    () =>
      parseCarnetContent({
        version: 1,
        document: {
          type: 'doc',
          content: Array.from({ length: 501 }, () => paragraph('a')),
        },
      }),
    /500 blocs/,
  );
});

test('Carnets : dates éditoriales de Paris, ordre et transitions réservées', async () => {
  const { parseCarnetDate, formatCarnetDate, assertCarnetCalendar } =
    await import('../src/lib/carnets/dates');
  const early = parseCarnetDate('2026-10-20T09:00', 'Accès anticipé')!;
  const publicAt = parseCarnetDate('2026-11-03T09:00', 'Publication')!;
  assert.equal(early.toISOString(), '2026-10-20T07:00:00.000Z');
  assert.equal(publicAt.toISOString(), '2026-11-03T08:00:00.000Z');
  assert.equal(formatCarnetDate(early), '2026-10-20T09:00');
  assert.equal(parseCarnetDate('', 'Publication'), null);
  assert.doesNotThrow(() => assertCarnetCalendar(early, publicAt));
  assert.throws(() => assertCarnetCalendar(publicAt, early));
  assert.throws(() => assertCarnetCalendar(early, early));
  for (const date of [
    '2026-02-30T10:00',
    '2026-03-29T02:30',
    '2026-10-25T02:30',
    '2026-13-01T10:00',
    '2026-01-01T25:00',
  ])
    assert.throws(() => parseCarnetDate(date, 'Date'));
  for (const status of ['PUBLIC', 'EARLY_ACCESS'])
    assert.throws(() => carnetInput(form({ status })));
  assert.throws(
    () => carnetInput(form({ publishedAt: '2026-10-20T09:00' })),
    /non autorisé/,
  );
  assert.equal(
    carnetInput(
      form({ location: 'Cœurlac', earlyAccessAt: '2026-10-20T09:00' }),
    ).data.location,
    'Cœurlac',
  );
  for (const illustrationUrl of [
    'https://attacker.example/a.png',
    '/assets/../private.png',
    'file:///Users/example/image.png',
  ])
    assert.throws(() => carnetInput(form({ illustrationUrl })));
});
