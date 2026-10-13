import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderNewsletterCampaignEmail } from '../src/emails/newsletter-campaign';

test('campagne newsletter : HTML sûr, liens absolus et désinscription', () => {
  const unsubscribe =
    'https://lesterresdecaldera.fr/newsletter/desinscription?token=abc';
  const email = renderNewsletterCampaignEmail(
    {
      subject: 'Nouveautés\r\ninjectées',
      preheader: 'Les cartes arrivent <demain>',
      heading: 'Cap sur les nouveautés',
      bodyMarkdown:
        'Bonjour **dresseurs**.\n\n[Voir les nouveautés](/nouveautes)\n\n[Piège](javascript:alert(1))\n\n<script>alert(1)</script>',
      ctaLabel: 'Découvrir',
      ctaUrl: '/nouveautes',
    },
    {
      logo: 'https://lesterresdecaldera.fr/assets/brand/logo.png',
      unsubscribe,
    },
  );
  assert.equal(email.subject, 'Nouveautés injectées');
  assert.match(
    email.html,
    /href="https:\/\/lesterresdecaldera\.fr\/nouveautes\?utm_source=newsletter&amp;utm_medium=email&amp;utm_campaign=newsletter"/,
  );
  assert.match(email.html, /Les cartes arrivent &lt;demain&gt;/);
  assert.ok(email.html.includes(unsubscribe));
  assert.doesNotMatch(email.html, /href="javascript:/i);
  assert.doesNotMatch(email.html, /<script/i);
  assert.match(email.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(email.text, /Se désinscrire : https:\/\//);
  assert.match(email.text, /<script>alert\(1\)<\/script>/);
});

test('campagne newsletter : un test ne contient pas de faux lien de désinscription', () => {
  const email = renderNewsletterCampaignEmail(
    {
      subject: 'Test',
      preheader: null,
      heading: 'Aperçu',
      bodyMarkdown: 'Contenu',
      ctaLabel: null,
      ctaUrl: null,
    },
    { logo: 'https://lesterresdecaldera.fr/logo.png' },
  );
  assert.match(email.html, /aucun abonné ne l’a reçu/);
  assert.doesNotMatch(email.html, /newsletter\/desinscription/);
});

// The visual editor and delivery queue share this validated document format.
import {
  DOCUMENT_PREFIX,
  documentFromLegacy,
  parseNewsletterDocument,
  serializeNewsletterDocument,
  newsletterIssues,
  type NewsletterDocument,
} from '../src/lib/newsletter/document';
import { assertCampaignReady } from '../src/lib/newsletter/campaigns';
import {
  campaignSchedule,
  validatedCampaignSchedule,
  audienceWhere,
} from '../src/lib/newsletter/studio';
const blocks: NewsletterDocument = {
  version: 1,
  theme: 'selection',
  blocks: [
    {
      id: 'text',
      type: 'text',
      text: '## Un conseil\n\nProtégez **vos cartes**.',
    },
    {
      id: 'image',
      type: 'image',
      src: '/assets/brand/logo-header-no-bg.png',
      alt: 'Une image <sûre>',
      caption: 'Légende <script>',
      href: '/pokemon',
    },
    {
      id: 'button',
      type: 'button',
      label: 'Découvrir <Caldera>',
      href: '/catalogue',
    },
    {
      id: 'product',
      type: 'product',
      productId: '12345678-1234-4234-8234-123456789012',
      name: 'Produit <test>',
      image: '/assets/brand/logo-header-no-bg.png',
      price: '59,90 €',
      href: '/produit/test',
      description: 'Description <img onerror="alert(1)">',
    },
    { id: 'divider', type: 'divider' },
    { id: 'spacer', type: 'spacer', height: 32 },
  ],
};
test('studio : compatibilité Markdown et aller-retour de tous les blocs', () => {
  assert.equal(parseNewsletterDocument('Bonjour **vous**'), null);
  assert.equal(documentFromLegacy('Bonjour **vous**').blocks[0]?.type, 'text');
  assert.deepEqual(
    parseNewsletterDocument(serializeNewsletterDocument(blocks)),
    blocks,
  );
  assert.deepEqual(
    parseNewsletterDocument(
      'CALDERA_NEWSLETTER_V1\r\n' + JSON.stringify(blocks),
    ),
    blocks,
  );
  assert.deepEqual(newsletterIssues(blocks), []);
  const email = renderNewsletterCampaignEmail(
    {
      subject: 'La sélection',
      preheader: null,
      heading: 'Caldera',
      bodyMarkdown: serializeNewsletterDocument(blocks),
      ctaLabel: null,
      ctaUrl: null,
      campaignId: 'campaign-test',
    },
    { logo: '/logo.png' },
  );
  assert.match(email.html, /background:#f5f1e7/);
  assert.match(email.html, /src="https:\/\/lesterresdecaldera.fr\/assets/);
  assert.match(email.html, /utm_campaign=campaign_campaign-test/);
  assert.match(email.html, /Une image &lt;sûre&gt;/);
  assert.match(email.html, /Description &lt;img/);
  assert.doesNotMatch(email.html, /<script|<img onerror/);
  assert.match(email.text, /59,90 €/);
  assert.match(email.text, /https:\/\/lesterresdecaldera.fr\/produit\/test/);
  assert.doesNotMatch(email.text, /CALDERA_NEWSLETTER_V1|"blocks"/);
});
test('studio : refuse injections, ressources externes et documents ambigus', () => {
  for (const href of [
    'javascript:alert(1)',
    'data:text/html,a',
    'http://example.com',
    'https://user:secret@example.com',
    '/\\evil.example',
  ]) {
    assert.throws(
      () =>
        parseNewsletterDocument(
          serializeNewsletterDocument({
            ...blocks,
            blocks: [{ id: 'bad', type: 'button', label: 'Piège', href }],
          }),
        ),
      /HTTPS/,
    );
  }
  for (const src of [
    'https://tracking.example/pixel',
    '/assets/../secret',
    '/api/private',
    'data:image/png;base64,a',
  ]) {
    assert.throws(
      () =>
        parseNewsletterDocument(
          serializeNewsletterDocument({
            ...blocks,
            blocks: [
              {
                id: 'bad',
                type: 'image',
                src,
                alt: 'Image',
                caption: '',
                href: '',
              },
            ],
          }),
        ),
      /image/,
    );
  }
  assert.throws(
    () =>
      parseNewsletterDocument(
        serializeNewsletterDocument({
          ...blocks,
          blocks: [blocks.blocks[0]!, blocks.blocks[0]!],
        }),
      ),
    /dupliqué/,
  );
  assert.throws(
    () => parseNewsletterDocument(DOCUMENT_PREFIX + '{broken'),
    /illisible/,
  );
  assert.throws(
    () =>
      parseNewsletterDocument(
        DOCUMENT_PREFIX +
          JSON.stringify({ version: 99, theme: 'journal', blocks: [] }),
      ),
    /Format/,
  );
  assert.throws(
    () =>
      parseNewsletterDocument(
        serializeNewsletterDocument({
          ...blocks,
          blocks: Array.from({ length: 41 }, (_, i) => ({
            id: `d${i}`,
            type: 'divider',
          })),
        }),
      ),
    /40 maximum/,
  );
});
test('studio : lien en cours de saisie ne casse pas l’aperçu, mais bloque l’envoi', () => {
  const source = serializeNewsletterDocument({
    ...blocks,
    blocks: [{ id: 'button', type: 'button', label: 'Voir', href: 'https://' }],
  });
  assert.throws(() => parseNewsletterDocument(source));
  assert.equal(
    parseNewsletterDocument(source, true)?.blocks[0]?.type,
    'button',
  );
  const incomplete = serializeNewsletterDocument({
    ...blocks,
    blocks: [
      { id: 'image', type: 'image', src: '', alt: '', caption: '', href: '' },
    ],
  });
  assert.throws(
    () =>
      assertCampaignReady({
        bodyMarkdown: incomplete,
        ctaLabel: null,
        ctaUrl: null,
      }),
    /Ajoutez un texte/,
  );
});
test('studio : programmation bornée et segments limités aux consentements actifs', () => {
  const now = new Date('2026-10-12T12:00:00.000Z');
  assert.equal(campaignSchedule('', now), now);
  assert.equal(
    campaignSchedule('2026-10-13T12:00:00.000Z', now).toISOString(),
    '2026-10-13T12:00:00.000Z',
  );
  for (const value of [
    'invalid',
    '2026-10-12T11:00:00.000Z',
    '2027-10-13T12:00:00.000Z',
    '2026-10-13T12:00',
  ])
    assert.throws(() => campaignSchedule(value, now));
  assert.equal(audienceWhere('all', now).status, 'ACTIVE');
  assert.equal(audienceWhere('recent', now).status, 'ACTIVE');
  assert.equal(audienceWhere('established', now).status, 'ACTIVE');
  assert.throws(() => audienceWhere('all-users'));
});

test('studio : une programmation incomplète ne peut jamais devenir un envoi immédiat', () => {
  const now = new Date('2026-10-12T12:00:00.000Z');
  const input = {
    mode: 'later',
    scheduledAt: '2026-10-13T08:30:00.000Z',
    local: '2026-10-13T10:30',
    timeZone: 'Europe/Paris',
  };
  assert.equal(
    validatedCampaignSchedule(input, now).toISOString(),
    input.scheduledAt,
  );
  assert.throws(
    () => validatedCampaignSchedule({ ...input, scheduledAt: '' }, now),
    /date et une heure/,
  );
  assert.throws(
    () =>
      validatedCampaignSchedule({ ...input, local: '2026-10-13T09:30' }, now),
    /n’a pas été confirmée/,
  );
  assert.throws(
    () => validatedCampaignSchedule({ ...input, timeZone: 'invalid' }, now),
    /n’a pas été confirmée/,
  );
  assert.throws(
    () => validatedCampaignSchedule({ ...input, mode: 'now' }, now),
    /incohérent/,
  );
});

test('studio visuel : compositions, style borné, version texte et empilement mobile', () => {
  const document: NewsletterDocument = {
    version: 1,
    theme: 'journal',
    design: { font: 'serif', fontSize: 18, accent: 'plum' },
    blocks: [
      {
        id: 'heading',
        type: 'heading',
        text: 'Votre sélection <vérifiée>',
        level: 2,
      },
      {
        id: 'feature',
        type: 'feature',
        src: '/assets/brand/logo-header-no-bg.png',
        alt: 'Caldera',
        title: 'À découvrir',
        text: 'Un **conseil** utile.',
        label: 'Voir les produits',
        href: '/catalogue',
        placement: 'right',
        style: { align: 'center', tone: 'sage', padding: 24, radius: 16 },
      },
      {
        id: 'columns',
        type: 'columns',
        columns: [
          {
            title: 'Pour commencer',
            text: 'Comparez les formats.',
            label: 'Explorer',
            href: '/pokemon',
          },
          {
            title: 'Pour collectionner',
            text: 'Choisissez votre extension.',
            label: 'Extensions',
            href: '/extensions',
          },
        ],
      },
    ],
  };
  assert.deepEqual(
    parseNewsletterDocument(serializeNewsletterDocument(document)),
    document,
  );
  assert.deepEqual(newsletterIssues(document), []);
  const email = renderNewsletterCampaignEmail(
    {
      subject: 'Découvertes',
      preheader: null,
      heading: 'Caldera',
      bodyMarkdown: serializeNewsletterDocument(document),
      ctaLabel: null,
      ctaUrl: null,
    },
    { logo: '/assets/brand/logo-header-no-bg.png' },
  );
  assert.match(email.html, /newsletter-column/);
  assert.match(
    email.html,
    /\.newsletter-column\{display:block!important;width:100%!important/,
  );
  assert.match(
    email.html,
    /background:#e8f0e9;padding:24px;border-radius:16px;font-family:Georgia,Times,serif;font-size:18px/,
  );
  assert.match(email.html, /background:#63395a;color:#fff/);
  assert.match(email.html, /Votre sélection &lt;vérifiée&gt;/);
  assert.match(email.html, /utm_source=newsletter/);
  assert.match(email.text, /Pour commencer/);
  assert.match(email.text, /https:\/\/lesterresdecaldera.fr\/extensions/);
  assert.doesNotMatch(email.text, /"columns"|"design"/);
});

test('studio visuel : interdit le CSS libre, les colonnes malformées et les blocs incomplets', () => {
  const raw = {
    version: 1,
    theme: 'journal',
    blocks: [{ id: 'text', type: 'text', text: 'Message' }],
  };
  for (const style of [
    {
      align: 'left',
      tone: 'url(https://evil.example)',
      padding: 16,
      radius: 8,
    },
    { align: 'left;position:fixed', tone: 'sage', padding: 16, radius: 8 },
    { align: 'left', tone: 'sage', padding: 9999, radius: 8 },
  ])
    assert.throws(
      () =>
        parseNewsletterDocument(
          DOCUMENT_PREFIX +
            JSON.stringify({ ...raw, blocks: [{ ...raw.blocks[0], style }] }),
        ),
      /design/,
    );
  assert.throws(
    () =>
      parseNewsletterDocument(
        DOCUMENT_PREFIX +
          JSON.stringify({
            ...raw,
            design: { font: 'Arial;bad', fontSize: 18, accent: 'forest' },
          }),
      ),
    /design/,
  );
  assert.throws(
    () =>
      parseNewsletterDocument(
        DOCUMENT_PREFIX +
          JSON.stringify({
            ...raw,
            blocks: [{ id: 'columns', type: 'columns', columns: [] }],
          }),
      ),
    /colonnes/,
  );
  const incomplete: NewsletterDocument = {
    version: 1,
    theme: 'journal',
    blocks: [
      {
        id: 'feature',
        type: 'feature',
        src: '',
        alt: '',
        title: '',
        text: '',
        label: 'Voir',
        href: '',
        placement: 'top',
      },
    ],
  };
  assert.ok(newsletterIssues(incomplete).length >= 2);
  assert.throws(
    () =>
      assertCampaignReady({
        bodyMarkdown: serializeNewsletterDocument(incomplete),
        ctaLabel: null,
        ctaUrl: null,
      }),
    /image|texte|contenu/i,
  );
});

import {
  validateNewsletterBackup,
  newsletterRecoverySnapshot,
} from '../src/lib/newsletter/recovery';
test('studio : la copie de secours expire, valide le document et ne restaure que les champs éditoriaux', () => {
  const value = {
    internalName: 'Brouillon',
    subject: 'Votre sélection',
    preheader: 'Aperçu',
    heading: 'Caldera',
  };
  const backup = {
    savedAt: Date.now(),
    value: { ...value, id: 'forged', ctaUrl: 'javascript:alert(1)' },
    doc: blocks,
  };
  const parsed = validateNewsletterBackup(JSON.stringify(backup));
  assert.deepEqual(parsed.value, value);
  assert.deepEqual(parsed.doc, blocks);
  assert.equal(
    newsletterRecoverySnapshot(
      { ...value, subject: ' Votre sélection ' },
      blocks,
    ),
    newsletterRecoverySnapshot(value, blocks),
  );
  assert.throws(
    () =>
      validateNewsletterBackup(
        JSON.stringify({ ...backup, savedAt: Date.now() - 86400001 }),
      ),
    /expired/,
  );
  assert.throws(
    () =>
      validateNewsletterBackup(
        JSON.stringify({
          ...backup,
          doc: {
            ...blocks,
            design: { font: 'evil', fontSize: 16, accent: 'forest' },
          },
        }),
      ),
    /design/,
  );
  assert.throws(
    () =>
      validateNewsletterBackup(
        JSON.stringify({ ...backup, value: { ...value, subject: 12 } }),
      ),
    /invalid/,
  );
});
