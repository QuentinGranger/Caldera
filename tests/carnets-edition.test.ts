import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  carnetEmailContent,
  carnetEmailSnapshot,
} from '../src/lib/carnets/email';
import { deriveCarnet, parseCarnetContent } from '../src/lib/carnets/content';
import { renderNewsletterCampaignEmail } from '../src/emails/newsletter-campaign';
import { parseNewsletterDocument } from '../src/lib/newsletter/document';
const source = {
  title: 'Quand le lac recula',
  slug: '001-lac',
  illustrationUrl: '/assets/lac.webp',
  illustrationAlt: 'La rive du lac',
  content: parseCarnetContent({
    version: 1,
    document: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Avant <script> & lumière',
              marks: [{ type: 'bold' }],
            },
          ],
        },
        { type: 'newsletterCut' },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'SECRET_APRES_COUPURE' }],
        },
      ],
    },
  }),
};
test('Email automatique : renderer réel, image, coupure, CTA, texte et Comptoir', () => {
  const p = {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'ETB <test>',
    href: '/produit/etb',
    image: '/assets/etb.webp',
    price: '54,90 €',
    stock: 3,
    eligible: true,
  };
  const result = renderNewsletterCampaignEmail(
    carnetEmailContent(source, [p], {
      subject: 'Le lac',
      preheader: 'La rive',
    }),
    { logo: '' },
  );
  assert.match(result.html, /lac.webp/);
  assert.match(result.html, /La rive du lac/);
  assert.match(result.html, /&lt;script&gt;/);
  assert.doesNotMatch(
    result.html,
    /<script>|SECRET_APRES_COUPURE|newsletterCut/,
  );
  assert.match(result.html, /Continuer l’expédition/);
  assert.match(result.html, /univers\/carnets\/001-lac/);
  assert.match(result.html, /Le Comptoir/);
  assert.match(result.text, /54,90/);
  assert.match(result.html, /ETB &lt;test&gt;/);
  assert.equal(deriveCarnet(source.content).excerpt?.words, 3);
});
test('Sans coupure : aucun chapitre complet utilisé dans l’email', () => {
  const content = parseCarnetContent({
    ...source.content,
    document: {
      type: 'doc',
      content: source.content.document.content.filter(
        (b) => b.type !== 'newsletterCut',
      ),
    },
  });
  const result = renderNewsletterCampaignEmail(
    carnetEmailContent({ ...source, content }, [], { subject: 'Test' }),
    { logo: '' },
  );
  assert.doesNotMatch(result.html, /SECRET_APRES_COUPURE/);
  assert.doesNotMatch(result.html, /Le Comptoir/);
});
test('Snapshot avancé : schéma Studio existant, mise en forme conservée, récit inchangé', () => {
  const before = JSON.stringify(source.content),
    snapshot = carnetEmailSnapshot(source, []),
    doc = parseNewsletterDocument(snapshot)!;
  assert.equal(JSON.stringify(source.content), before);
  assert.deepEqual(
    doc.blocks.map((b) => b.type),
    ['image', 'text', 'button'],
  );
  assert.doesNotMatch(snapshot, /SECRET_APRES_COUPURE/);
  const result = renderNewsletterCampaignEmail(
    {
      subject: 'Test',
      preheader: null,
      heading: source.title,
      bodyMarkdown: snapshot,
      ctaLabel: null,
      ctaUrl: null,
    },
    { logo: '' },
  );
  assert.match(result.html, /<strong>/);
  assert.doesNotMatch(result.html, /<script>/);
  assert.match(result.html, /Continuer l’expédition/);
});
