import assert from 'node:assert/strict';
import { test } from 'node:test';

const base = process.env.TEST_BASE_URL ?? 'http://localhost:3001';

test('fidélisation : inscription explicite, Discord public et liens utiles accessibles', async () => {
  const response = await fetch(base + '/newsletter');
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.equal((html.match(/<h1(?:\s|>)/g) ?? []).length, 1);
  assert.match(html, /name="robots" content="noindex, nofollow"/);
  assert.match(html, /name="consent"/);
  assert.doesNotMatch(html, /<input[^>]*name="consent"[^>]*checked/);
  assert.equal((html.match(/id="newsletter-email"/g) ?? []).length, 1);
  assert.match(html, /https:\/\/discord\.gg\/RQ8AMYaGVq/);
  assert.match(html, /M’avertir du retour en stock/);
  assert.match(html, /sans inscription à la newsletter/);
  assert.doesNotMatch(html, /discord(?:app)?\.com\/api\/webhooks/);
  for (const path of [
    '/nouveautes',
    '/selections/retour-en-stock',
    '/calendrier-des-sorties',
  ]) {
    if (!html.includes('href="' + path + '"')) continue;
    const destination = await fetch(base + path, { redirect: 'manual' });
    assert.equal(
      destination.status,
      200,
      path + ' ne doit pas être vide ou rediriger',
    );
  }
});
