import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  analyticsLocation,
  analyticsPageContext,
  safeAnalyticsPath,
} from '../src/lib/analytics/client';
import {
  classifyChannel,
  publicCampaign,
  measurementCampaign,
} from '../src/lib/analytics/attribution';
import { campaignUrl } from '../src/lib/analytics/campaign';
import { measurementId, measurementToken } from '../src/lib/analytics/server';

test('SEO attribution: preserve public product URLs and internal navigation without private referrers', () => {
  const landing = analyticsPageContext(
    'https://lesterresdecaldera.fr/guides/proteger-ses-cartes?access=secret',
    'https://www.google.fr/search?q=private',
  );
  assert.deepEqual(landing, {
    page_location: 'https://lesterresdecaldera.fr/guides/proteger-ses-cartes',
    page_title: '/guides/proteger-ses-cartes',
    page_referrer: 'https://www.google.fr',
  });
  const product = analyticsPageContext(
    'https://lesterresdecaldera.fr/produit/etb?email=private#token',
    '',
    landing!.page_location,
  );
  assert.equal(
    product?.page_location,
    'https://lesterresdecaldera.fr/produit/etb',
  );
  assert.equal(product?.page_referrer, landing!.page_location);
  assert.equal(
    analyticsPageContext(product!.page_location, '', product)?.page_referrer,
    landing!.page_location,
    'Later product/cart events keep the page referrer instead of referring to themselves',
  );
  const directProduct = analyticsPageContext(
    'https://lesterresdecaldera.fr/produit/etb',
    'https://www.google.fr/search?q=private',
  );
  assert.equal(
    directProduct?.page_referrer,
    'https://www.google.fr',
    'The first product hit retains organic attribution even before page_view',
  );
  assert.equal(
    analyticsPageContext(
      'https://lesterresdecaldera.fr/commande/private-token',
    ),
    null,
  );
  assert.equal(
    analyticsPageContext(
      'https://lesterresdecaldera.fr/catalogue',
      '',
      'https://lesterresdecaldera.fr/compte/private',
    )?.page_referrer,
    '',
  );
  assert.equal(analyticsPageContext('invalid'), null);
});
test('mesure : aucun jeton, recherche, espace privé ou fragment transmis', () => {
  assert.equal(
    analyticsLocation(
      'https://lesterresdecaldera.fr/catalogue?q=email%40example.com&access=secret&utm_source=discord&utm_campaign=lancement#token=private',
    ),
    'https://lesterresdecaldera.fr/catalogue?utm_source=discord&utm_campaign=lancement',
  );
  for (const path of [
    '/admin',
    '/admin/clients',
    '/commande/secret',
    '/compte/profil',
    '/paiement/x',
    '/checkout/paiement/secret',
    '/newsletter/desinscription',
    '/panier/reprendre',
    '/api/measurement',
  ])
    assert.equal(safeAnalyticsPath(path), null);
  assert.equal(publicCampaign('email@example.com'), null);
  assert.equal(publicCampaign('campagne_2026'), 'campagne_2026');
});
test('attribution : canaux contrôlés et UTM sans destinataire', () => {
  assert.equal(classifyChannel('discord', 'community', '').channel, 'discord');
  assert.equal(
    classifyChannel('newsletter', 'email', '').channel,
    'newsletter',
  );
  assert.equal(
    classifyChannel(null, null, 'https://www.google.fr/search?q=private')
      .channel,
    'google',
  );
  assert.equal(
    classifyChannel(null, null, 'https://lesterresdecaldera.fr/catalogue')
      .channel,
    'direct',
  );
  assert.equal(
    campaignUrl('https://example.com/x', 'campagne'),
    'https://example.com/x',
  );
  const url = new URL(
    campaignUrl('https://lesterresdecaldera.fr/catalogue', 'campaign_123'),
  );
  assert.equal(url.searchParams.get('utm_campaign'), 'campaign_123');
  assert.equal(url.searchParams.get('utm_medium'), 'email');
});
test('cookie d’attribution : signature obligatoire, expiration et absence de secret', () => {
  const saved = process.env.BETTER_AUTH_SECRET;
  process.env.BETTER_AUTH_SECRET = 'measurement-test-only-secret-long-enough';
  try {
    const id = 'f1234567-1234-4234-8234-123456789abc';
    const signed = measurementToken(id);
    assert.equal(measurementId(signed), id);
    assert.equal(
      measurementId(signed.replace(id, 'a1234567-1234-4234-8234-123456789abc')),
      null,
    );
    assert.equal(measurementId(id), null);
    assert.equal(measurementId(signed + '.extra'), null);
  } finally {
    if (saved === undefined) delete process.env.BETTER_AUTH_SECRET;
    else process.env.BETTER_AUTH_SECRET = saved;
  }
});

test('attribution Carnets : libellé GA4 lisible, ID précis par envoi, legacy et ID invalide', () => {
  const campaign = 'campaign_12345678-1234-4234-8234-123456789abc';
  assert.equal(measurementCampaign('carnet_001', campaign), campaign);
  assert.equal(
    measurementCampaign('carnet_001', 'email@example.com'),
    'carnet_001',
  );
  assert.equal(measurementCampaign(campaign, null), campaign);
  assert.equal(measurementCampaign('autre', campaign), 'autre');
  assert.equal(
    analyticsLocation(
      `https://lesterresdecaldera.fr/univers/carnets/lac?access=secret&utm_campaign=carnet_001&utm_content=continuer_expedition&utm_id=${campaign}`,
    ),
    `https://lesterresdecaldera.fr/univers/carnets/lac?utm_campaign=carnet_001&utm_content=continuer_expedition&utm_id=${campaign}`,
  );
});
