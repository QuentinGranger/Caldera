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
    /href="https:\/\/lesterresdecaldera\.fr\/nouveautes"/,
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
