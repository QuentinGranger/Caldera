import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  carnetChecklist,
  type DepartureChapter,
} from '../src/lib/carnets/readiness';
import { carnetPublicDate } from '../src/lib/carnets/dates';
import { serializeNewsletterDocument } from '../src/lib/newsletter/document';
const now = new Date('2026-10-15T08:00:00Z'),
  early = new Date('2026-10-20T07:00:00Z');
const content = (words = 300) => ({
  version: 1,
  document: {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'avant '.repeat(words) }],
      },
      { type: 'newsletterCut' },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'suite '.repeat(650) }],
      },
    ],
  },
});
const chapter: DepartureChapter = {
  title: 'Le lac',
  slug: '001-lac',
  status: 'READY',
  revision: 1,
  updatedAt: now,
  content: content(),
  illustrationUrl: '/lac.webp',
  illustrationAlt: 'La rive',
  earlyAccessAt: early,
  publicAt: carnetPublicDate(early),
};
const campaign = {
  subject: 'Le lac',
  preheader: 'La rive',
  updatedAt: now,
  status: 'DRAFT',
  carnetCustomized: false,
  heading: 'Le lac',
  bodyMarkdown: '',
  ctaLabel: null,
  ctaUrl: null,
};
const proof = { testCurrent: true, accessConfigured: true };
test('Checklist : onze contrôles demandés, conformité calculée et départ autorisé', () => {
  const result = carnetChecklist(chapter, campaign, [], proof, now);
  assert.equal(result.canSchedule, true);
  assert.equal(result.checks.length, 12);
  assert.ok(result.checks.every((c) => c.state === 'ok'));
  assert.equal(result.canTest, true);
});
test('Checklist : plage éditoriale inclusive et conseil hors plage, extrait vide bloquant', () => {
  for (const words of [250, 400])
    assert.equal(
      carnetChecklist(
        { ...chapter, content: content(words) },
        campaign,
        [],
        proof,
        now,
      ).checks[0]!.state,
      'ok',
    );
  for (const words of [1, 249, 401]) {
    const r = carnetChecklist(
      { ...chapter, content: content(words) },
      campaign,
      [],
      proof,
      now,
    );
    assert.equal(r.checks[0]!.state, 'warning');
    assert.equal(r.canSchedule, true);
  }
  const zero = carnetChecklist(
    { ...chapter, content: content(0) },
    campaign,
    [],
    proof,
    now,
  );
  assert.equal(zero.canSchedule, false);
});
test('Checklist : brouillon, coupure absente, alt, email, accès ou test manquant empêchent la programmation', () => {
  for (const update of [
    { status: 'DRAFT' as const },
    { illustrationAlt: ' ' },
    { illustrationUrl: null },
    { title: '' },
    { slug: 'invalid path' },
    { publicAt: new Date(early.getTime() + 86400000) },
    {
      content: {
        version: 1,
        document: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'seul texte' }],
            },
          ],
        },
      },
    },
  ])
    assert.equal(
      carnetChecklist({ ...chapter, ...update }, campaign, [], proof, now)
        .canSchedule,
      false,
    );
  assert.equal(
    carnetChecklist(chapter, { ...campaign, preheader: ' ' }, [], proof, now)
      .canSchedule,
    false,
  );
  assert.equal(
    carnetChecklist(
      chapter,
      campaign,
      [],
      { ...proof, testCurrent: false },
      now,
    ).canSchedule,
    false,
  );
  assert.equal(
    carnetChecklist(
      chapter,
      campaign,
      [],
      { ...proof, accessConfigured: false },
      now,
    ).canSchedule,
    false,
  );
  assert.equal(
    carnetChecklist(chapter, campaign, [], { ...proof, dirty: true }, now)
      .canSchedule,
    false,
  );
  assert.equal(
    carnetChecklist(
      chapter,
      campaign,
      [],
      { ...proof, testCurrent: false },
      now,
    ).canTest,
    true,
  );
});
test('Checklist : trois produits, doublons, indisponibilité et actions de correction', () => {
  const products = [1, 2, 3].map((n) => ({
    id: String(n),
    name: `Produit ${n}`,
    eligible: true,
  }));
  assert.equal(
    carnetChecklist(chapter, campaign, products, proof, now).canSchedule,
    true,
  );
  assert.equal(
    carnetChecklist(
      chapter,
      campaign,
      [...products, { id: '4', name: '4', eligible: true }],
      proof,
      now,
    ).canSchedule,
    false,
  );
  assert.equal(
    carnetChecklist(chapter, campaign, [products[0]!, products[0]!], proof, now)
      .canSchedule,
    false,
  );
  const result = carnetChecklist(
    chapter,
    campaign,
    [{ ...products[0]!, eligible: false, unavailableReason: 'épuisé' }],
    proof,
    now,
  );
  assert.match(
    result.blocking.find((c) => c.key === 'products')!.detail,
    /Produit 1.*épuisé/,
  );
  assert.equal(
    result.blocking.find((c) => c.key === 'products')!.action!.target,
    'comptoir',
  );
});
test('Checklist : CTA réel du mode avancé, destination correcte et contrôles génériques', () => {
  const blocks = [
    { id: 'text', type: 'text' as const, text: 'Un extrait' },
    {
      id: 'cta',
      type: 'button' as const,
      label: 'Continuer l’expédition',
      href: '/univers/carnets/001-lac?utm_source=newsletter',
    },
  ];
  const advanced = {
    ...campaign,
    carnetCustomized: true,
    bodyMarkdown: serializeNewsletterDocument({
      version: 1,
      theme: 'journal',
      blocks,
    }),
  };
  assert.equal(
    carnetChecklist(chapter, advanced, [], proof, now).canSchedule,
    true,
  );
  for (const href of [
    '/univers/carnets/autre',
    'https://evil.example/univers/carnets/001-lac',
  ])
    assert.equal(
      carnetChecklist(
        chapter,
        {
          ...advanced,
          bodyMarkdown: serializeNewsletterDocument({
            version: 1,
            theme: 'journal',
            blocks: [
              blocks[0]!,
              {
                id: 'cta',
                type: 'button',
                label: 'Continuer l’expédition',
                href,
              },
            ],
          }),
        },
        [],
        proof,
        now,
      ).canSchedule,
      false,
    );
  assert.equal(
    carnetChecklist(
      chapter,
      {
        ...advanced,
        bodyMarkdown: serializeNewsletterDocument({
          version: 1,
          theme: 'journal',
          blocks: [blocks[0]!],
        }),
      },
      [],
      proof,
      now,
    ).canSchedule,
    false,
  );
});
test('Checklist : J+14 civil à Paris traverse le changement d’heure, sans ouvrir l’accès avant la date', () => {
  assert.equal(chapter.publicAt!.toISOString(), '2026-11-03T08:00:00.000Z');
  assert.equal(
    carnetChecklist(
      { ...chapter, earlyAccessAt: new Date(now.getTime() - 1000) },
      campaign,
      [],
      proof,
      now,
    ).canSchedule,
    false,
  );
});
