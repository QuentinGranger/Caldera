import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  analyticsLocation,
  safeAnalyticsPath,
} from '../src/lib/analytics/client';
import {
  classifyChannel,
  publicCampaign,
} from '../src/lib/analytics/attribution';
import { campaignUrl } from '../src/lib/analytics/campaign';
import { measurementId, measurementToken } from '../src/lib/analytics/server';
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
