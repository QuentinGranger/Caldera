import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import {
  carnetLink,
  identifyCarnetClick,
} from '../src/lib/carnets/analytics-links';
import { renderNewsletterCampaignEmail } from '../src/emails/newsletter-campaign';
const id = randomUUID();
const links = {
  storyPath: '/univers/carnets/recit',
  products: [1, 2, 3].map((n) => ({
    id: randomUUID(),
    href: `/produit/selection-${n}`,
  })),
};
test('Carnets liens : récit signé et trois produits distincts, aucun identifiant abonné', () => {
  const story = carnetLink(
    links.storyPath + '?access=secret',
    `campaign_${id}`,
    links,
  );
  assert.equal(new URL(story).searchParams.get('access'), 'secret');
  assert.equal(
    new URL(story).searchParams.get('utm_content'),
    'story_continue',
  );
  assert.deepEqual(identifyCarnetClick(story, id, links), {
    linkKey: 'story_continue',
    productId: null,
  });
  links.products.forEach((p, i) =>
    assert.deepEqual(
      identifyCarnetClick(
        carnetLink(p.href, `campaign_${id}`, links),
        id,
        links,
      ),
      { linkKey: `comptoir_product_${i + 1}`, productId: p.id },
    ),
  );
  for (const url of [
    'https://evil.example' + links.products[0]!.href,
    'https://lesterresdecaldera.fr/produit/autre?utm_content=comptoir_product_1',
    story.replace(id, randomUUID()),
    story.replace('story_continue', 'comptoir_product_4'),
  ])
    assert.equal(identifyCarnetClick(url, id, links), null);
  assert.equal(
    carnetLink('https://discord.gg/example', `campaign_${id}`, links),
    'https://discord.gg/example',
  );
});
test('Carnets rendu email : contenu identifié dans HTML et texte, newsletter générique inchangée', () => {
  const input = {
    campaignId: id,
    subject: 'Recette',
    preheader: null,
    heading: 'Recette',
    bodyMarkdown: `[Continuer](${links.storyPath})\n\n[Produit](${links.products[0]!.href})`,
    ctaLabel: 'Continuer l’expédition',
    ctaUrl: links.storyPath + '?access=secret',
    carnetLinks: links,
    carnetComptoir: links.products.map((p) => ({
      ...p,
      name: 'ETB',
      image: '/assets/brand/logo-header-no-bg.png',
      price: '50 €',
    })),
  };
  const result = renderNewsletterCampaignEmail(input, { logo: '/logo.png' });
  assert.match(result.html, /utm_content=story_continue/);
  assert.match(result.text, /utm_content=comptoir_product_1/);
  const generic = renderNewsletterCampaignEmail(
    { ...input, carnetLinks: undefined },
    { logo: '/logo.png' },
  );
  assert.doesNotMatch(generic.html, /utm_content=story_continue/);
});
