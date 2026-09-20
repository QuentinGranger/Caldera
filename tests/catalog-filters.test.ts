import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  parseCatalogParams,
  catalogQuery,
  catalogUrl,
  paginationPages,
} from '../src/lib/catalog/params';
test('paramètres invalides, bornes de prix et valeurs multiples', () => {
  const f = parseCatalogParams({
    page: 'bonjour',
    sort: 'inconnu',
    language: 'FR,EN,XX,FR',
    type: ['ETB', 'INVALID'],
    search: '  Évoli  ',
    minPrice: '80',
    maxPrice: '20',
  });
  assert.equal(f.page, 1);
  assert.equal(f.sort, 'recommended');
  assert.deepEqual(f.language, ['EN', 'FR']);
  assert.deepEqual(f.type, ['ETB']);
  assert.equal(f.search, 'Évoli');
  assert.equal(f.minPrice, '20.00');
  assert.equal(f.maxPrice, '80.00');
  assert.equal(
    parseCatalogParams({ minPrice: '-4', maxPrice: 'Infinity', page: '-1' })
      .minPrice,
    undefined,
  );
  assert.equal(parseCatalogParams({ page: '1.3', search: '  ' }).page, 1);
  assert.equal(parseCatalogParams({ minPrice: '10.001' }).minPrice, undefined);
  assert.equal(
    parseCatalogParams({ maxPrice: '99999999.99' }).maxPrice,
    '99999999.99',
  );
});
test('URL partageable, suppression et retour automatique à la première page', () => {
  const f = parseCatalogParams({
    language: 'FR,EN',
    page: '6',
    sort: 'price-asc',
    search: 'coffret',
  });
  const href = catalogUrl('/catalogue', f, { language: ['FR'] });
  assert.ok(!href.includes('page='));
  assert.ok(href.includes('language=FR'));
  assert.ok(href.includes('search=coffret'));
  assert.ok(catalogUrl('/catalogue', f, { page: 2 }).includes('page=2'));
  assert.equal(
    catalogQuery(
      parseCatalogParams({ page: '1', language: '', sort: 'recommended' }),
    ),
    '',
  );
  const raw = Object.fromEntries(new URLSearchParams(catalogQuery(f)));
  assert.deepEqual(parseCatalogParams(raw), f);
  assert.equal(
    catalogUrl('/catalogue', parseCatalogParams({ language: 'FR' }), {
      language: [],
    }),
    '/catalogue',
  );
});
test('pagination compacte, sans doublons ni pages inexistantes', () => {
  assert.deepEqual(paginationPages(6, 12), [1, 'gap', 5, 6, 7, 'gap', 12]);
  assert.deepEqual(paginationPages(1, 2), [1, 2]);
  assert.deepEqual(paginationPages(1, 1), [1]);
});
