import assert from 'node:assert/strict';
import { test } from 'node:test';

const base = process.env.TEST_BASE_URL ?? 'http://localhost:3001';
const withoutScripts = (html: string) =>
  html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');

test('HTTP guides : CTA contextualisés, disponibles et listes cohérentes', async () => {
  for (const [slug, categories] of [
    ['etb-display-ou-booster', ['boosters', 'displays', 'etb']],
    ['proteger-ses-cartes', ['accessoires']],
    ['extensions-et-series-pokemon', ['scelles']],
  ] as const) {
    const response = await fetch(`${base}/guides/${slug}`);
    assert.equal(response.status, 200);
    const html = withoutScripts(await response.text());
    const links = [
      ...html.matchAll(
        /<a\b[^>]*href="([^"]+)"[^>]*>Voir les produits disponibles<\/a>/g,
      ),
    ];
    assert.equal(links.length, 2, slug); // Near the lead and beside the recommendations.
    assert.equal(links[0]?.[1], links[1]?.[1]);
    const target = new URL(links[0]![1]!.replaceAll('&amp;', '&'), base);
    assert.deepEqual(
      target.searchParams.get('category')?.split(',').sort(),
      [...categories].sort(),
    );
    assert.equal(target.searchParams.get('availability'), 'in-stock');
    assert.equal(target.hash, '#catalogue-resultats');
    const catalog = await fetch(target);
    assert.equal(catalog.status, 200);
    const results = withoutScripts(await catalog.text());
    assert.ok(results.includes('<article'), target.href);
    assert.doesNotMatch(results, /Aucun produit disponible|Aucun résultat/);
    const shop = html.slice(
      html.indexOf('aria-labelledby="guide-boutique-titre"'),
    );
    assert.ok(shop.includes('<article'), slug);
    assert.doesNotMatch(shop.slice(0, shop.indexOf('</section>')), />Épuisé</);
    assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1);
  }
});
