import assert from 'node:assert/strict';
import { test } from 'node:test';
const base = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
const strip = (html: string) =>
  html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/gu, ' ');
async function page(path: string, status = 200) {
  const response = await fetch(`${base}${path}`);
  assert.equal(response.status, status, path);
  const html = await response.text();
  assert.ok(!html.includes('costPrice'));
  return { html, url: response.url };
}
test('HTTP : six routes, hiérarchie, extensions et 404', async () => {
  for (const path of [
    '/catalogue',
    '/categorie/scelles',
    '/categorie/etb?language=FR&sort=price-asc',
    '/extensions',
    '/extensions/dev-terres-de-braise',
    '/nouveautes',
    '/precommandes',
  ]) {
    const { html } = await page(path);
    assert.ok(html.includes('<h1>'));
  }
  for (const path of ['/categorie/inexistante', '/extensions/inexistante'])
    await page(path, 404);
  assert.ok(
    (await page('/categorie/scelles')).html.includes('href="/categorie/etb"'),
  );
  assert.ok(
    (await page('/extensions')).html.includes(
      'href="/extensions/dev-terres-de-braise"',
    ),
  );
});
test('HTTP : filtre FR cohérent, cases synchronisées, URL nettoyée et SEO', async () => {
  const { html } = await page('/catalogue?category=etb&language=FR');
  assert.ok(strip(html).includes('59,90 €'));
  assert.ok(!strip(html).includes('54,90 €'));
  assert.match(html, /type="checkbox"[^>]*checked=""/);
  assert.match(html, /<meta name="robots" content="noindex, follow"/);
  assert.ok(html.includes('Retirer le filtre Français'));
  assert.ok(html.includes('Tout effacer'));
  assert.ok(
    !(await page('/catalogue')).html.includes('content="noindex, follow"'),
  );
  const cleaned = await page(
    '/catalogue?page=bonjour&language=INVALID&type=INVALID&sort=inconnu&search=',
  );
  assert.equal(new URL(cleaned.url).search, '');
  const range = await page('/catalogue?minPrice=80&maxPrice=20');
  const params = new URL(range.url).searchParams;
  assert.equal(params.get('minPrice'), '20.00');
  assert.equal(params.get('maxPrice'), '80.00');
});
test('HTTP : pagination réelle, filtres conservés et page hors limite', async () => {
  const first = await page('/catalogue?language=FR&sort=price-asc');
  assert.equal((first.html.match(/<article\b/g) ?? []).length, 12);
  assert.ok(
    first.html.includes(
      'language=FR&amp;sort=price-asc&amp;page=2#catalogue-resultats',
    ),
  );
  const second = await page('/catalogue?language=FR&sort=price-asc&page=2');
  assert.ok((second.html.match(/<article\b/g) ?? []).length > 0);
  const last = await page('/catalogue?page=9999');
  assert.equal(new URL(last.url).searchParams.get('page'), '2');
});
test('HTTP : aucun résultat et filtres mobile / recherche accessibles', async () => {
  const empty = await page('/catalogue?search=introuvable-caldera');
  assert.ok(
    strip(empty.html).includes('Aucun résultat pour « introuvable-caldera »'),
  );
  assert.ok(empty.html.includes('Réinitialiser la recherche'));
  assert.equal(
    (await page('/catalogue?category=inconnue')).html.match(/<article\b/g),
    null,
  );
  const { html } = await page('/catalogue');
  assert.ok(html.includes('aria-haspopup="dialog"'));
  assert.ok(html.includes('Fermer les filtres'));
  assert.ok(html.includes('Rechercher dans ce catalogue'));
  assert.match(html, /<fieldset\b/);
});
