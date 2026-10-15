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
  number: 1,
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
    'continuer_expedition',
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
    story.replace('continuer_expedition', 'comptoir_produit_4'),
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
  assert.match(result.html, /utm_content=continuer_expedition/);
  assert.match(result.text, /utm_content=comptoir_produit_1/);
  const generic = renderNewsletterCampaignEmail(
    { ...input, carnetLinks: undefined },
    { logo: '/logo.png' },
  );
  assert.doesNotMatch(generic.html, /utm_content=continuer_expedition/);
});
test('UTM Carnets : format humain, ID de campagne stable, idempotence et paramètres fonctionnels préservés', () => {
  const original =
    links.products[1]!.href +
    '?variant=rouge&utm_source=manuel&utm_source=doublon&utm_campaign=ancien&utm_content=ancien&utm_id=ancien&UTM_MEDIUM=ancien#photos';
  const tagged = carnetLink(original, `campaign_${id}`, links);
  const url = new URL(tagged);
  assert.equal(url.searchParams.get('utm_source'), 'newsletter');
  assert.equal(url.searchParams.get('utm_medium'), 'email');
  assert.equal(url.searchParams.get('utm_campaign'), 'carnet_001');
  assert.equal(url.searchParams.get('utm_content'), 'comptoir_produit_2');
  assert.equal(url.searchParams.get('utm_id'), `campaign_${id}`);
  assert.equal(url.searchParams.getAll('utm_source').length, 1);
  assert.equal(url.searchParams.has('UTM_MEDIUM'), false);
  assert.equal(url.searchParams.get('variant'), 'rouge');
  assert.equal(url.hash, '#photos');
  assert.equal(carnetLink(tagged, `campaign_${id}`, links), tagged);
  assert.equal(
    new URL(
      carnetLink(links.storyPath, `campaign_${id}`, { ...links, number: 14 }),
    ).searchParams.get('utm_campaign'),
    'carnet_014',
  );
  assert.equal(identifyCarnetClick(tagged, randomUUID(), links), null);
});
test('UTM Carnets : refus de suivi, liens non marketing, numéro invalide et aucun identifiant fictif en aperçu', () => {
  const url = new URL(
    carnetLink(
      links.storyPath + '?access=secret&utm_source=ancien&utm_campaign=ancien',
      `campaign_${id}`,
      links,
      false,
    ),
  );
  assert.equal(url.searchParams.get('access'), 'secret');
  assert.equal(
    [...url.searchParams.keys()].some((k) => k.startsWith('utm_')),
    false,
  );
  for (const path of [
    '/confidentialite',
    '/compte',
    '/newsletter/desinscription?token=secret',
  ]) {
    assert.equal(
      new URL(carnetLink(path, `campaign_${id}`, links)).searchParams.has(
        'utm_campaign',
      ),
      false,
    );
  }
  const preview = new URL(carnetLink(links.storyPath, 'newsletter', links));
  assert.equal(preview.searchParams.get('utm_campaign'), 'carnet_001');
  assert.equal(preview.searchParams.has('utm_id'), false);
  assert.equal(
    new URL(
      carnetLink(links.storyPath, `campaign_${id}`, { ...links, number: 0 }),
    ).searchParams.has('utm_campaign'),
    false,
  );
});
test('UTM Carnets : anciens emails toujours reconnus avec les mêmes compteurs', () => {
  const legacy = `https://lesterresdecaldera.fr${links.storyPath}?utm_campaign=campaign_${id}&utm_content=story_continue`;
  assert.deepEqual(identifyCarnetClick(legacy, id, links), {
    linkKey: 'story_continue',
    productId: null,
  });
  const product = links.products[2]!;
  assert.deepEqual(
    identifyCarnetClick(
      `https://lesterresdecaldera.fr${product.href}?utm_campaign=campaign_${id}&utm_content=comptoir_product_3`,
      id,
      links,
    ),
    { linkKey: 'comptoir_product_3', productId: product.id },
  );
});
