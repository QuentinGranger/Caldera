import 'dotenv/config';
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { getPrisma } from '../src/lib/db/prisma';
import { getCatalogProducts } from '../src/lib/catalog/getCatalogProducts';
import { getCatalogFacets } from '../src/lib/catalog/facets';
import { getCategory, getExtension } from '../src/lib/catalog/taxonomy';
import {
  parseCatalogParams,
  CATALOG_PAGE_SIZE,
  type SearchParams,
} from '../src/lib/catalog/params';
import { Prisma } from '../src/generated/prisma/client';
const db = getPrisma();
after(() => db.$disconnect());
const catalog = (params: SearchParams = {}) =>
  getCatalogProducts(parseCatalogParams(params));
const etb = 'dev-etb-terres-de-braise';
test('mêmes variantes pour langue, prix, stock et représentation publique', async () => {
  const fr = await catalog({ category: 'etb', language: 'FR' });
  assert.equal(fr.total, 1);
  assert.equal(fr.products[0]?.price, '59.90');
  assert.equal(fr.products[0]?.priceFrom, false);
  const en = await catalog({ category: 'etb', language: 'EN' });
  assert.equal(en.products[0]?.price, '54.90');
  assert.equal(en.products[0]?.availability, 'LOW_STOCK');
  const both = await catalog({ category: 'etb', language: 'FR,EN' });
  assert.equal(both.products[0]?.priceFrom, true);
  assert.equal(
    (await catalog({ category: 'etb', language: 'FR', maxPrice: '55' })).total,
    0,
  );
  assert.equal(
    (
      await catalog({
        category: 'etb',
        language: 'EN',
        availability: 'low-stock',
      })
    ).total,
    1,
  );
  assert.equal(
    (
      await catalog({
        category: 'etb',
        language: 'FR',
        availability: 'low-stock',
      })
    ).total,
    0,
  );
  assert.equal((await catalog({ category: 'etb', language: 'JP' })).total, 0);
  const json = JSON.stringify(fr);
  assert.ok(!/costPrice|stockQuantity|lowStockThreshold/.test(json));
});
test('filtres combinés, périmètres, hiérarchie et recherche littérale', async () => {
  assert.equal(
    (
      await catalog({
        type: 'ETB',
        set: 'dev-terres-de-braise',
        language: 'FR',
        minPrice: '20',
        maxPrice: '80',
        availability: 'in-stock',
      })
    ).products[0]?.slug,
    etb,
  );
  const parent = await getCatalogProducts(parseCatalogParams({}), {
    category: 'pokemon',
  });
  assert.ok(parent.total > 1);
  assert.equal(
    (
      await getCatalogProducts(
        parseCatalogParams({ category: 'accessoires' }),
        { category: 'scelles' },
      )
    ).total,
    0,
  );
  assert.equal((await catalog({ category: 'inconnue' })).total, 0);
  assert.equal((await catalog({ set: 'inconnue' })).total, 0);
  const preorder = await getCatalogProducts(parseCatalogParams({}), {
    preorder: true,
  });
  assert.ok(preorder.products.every((p) => p.availability === 'PREORDER'));
  assert.equal(preorder.total, 2);
  const newProducts = await getCatalogProducts(parseCatalogParams({}), {
    newArrival: true,
  });
  assert.equal(newProducts.total, 4);
  assert.equal(
    (await catalog({ search: 'DEV-ETB-TERRES-DE-BRAISE' })).products[0]?.slug,
    etb,
  );
  assert.equal((await catalog({ search: 'non commercialisé' })).total, 17);
  assert.equal((await catalog({ search: '%' })).total, 0);
  assert.equal(await getCategory('inconnue'), null);
  assert.equal(await getExtension('inconnue'), null);
  assert.deepEqual(
    (await getCategory('etb'))?.ancestors.map((c) => c.slug),
    ['pokemon', 'scelles'],
  );
});
test('pagination PostgreSQL, bornage, stabilité et tris par MIN du prix pertinent', async () => {
  const first = await catalog();
  const second = await catalog({ page: '2' });
  assert.equal(first.total, 17);
  assert.equal(first.products.length, CATALOG_PAGE_SIZE);
  assert.equal(second.products.length, 5);
  assert.equal(first.pageCount, 2);
  assert.equal(
    new Set([...first.products, ...second.products].map((p) => p.id)).size,
    17,
  );
  assert.equal((await catalog({ page: '9999' })).page, 2);
  for (const sort of ['price-asc', 'price-desc']) {
    const a = await catalog({ sort, language: 'FR' }),
      b = await catalog({ sort, language: 'FR', page: '2' });
    const products = [...a.products, ...(a.pageCount > 1 ? b.products : [])];
    for (let i = 1; i < products.length; i++) {
      const comparison = new Prisma.Decimal(products[i - 1]!.price!).comparedTo(
        products[i]!.price!,
      );
      assert.ok(sort === 'price-asc' ? comparison <= 0 : comparison >= 0);
    }
    assert.equal(products.find((p) => p.slug === etb)?.price, '59.90');
  }
  for (const sort of ['recommended', 'newest', 'name-asc'])
    assert.equal((await catalog({ sort })).products.length, 12);
});
test('facettes dérivées des produits actifs et du contexte', async () => {
  const facets = await getCatalogFacets({ category: 'etb' });
  assert.deepEqual(facets.languages, ['FR', 'EN']);
  assert.deepEqual(facets.types, ['ETB']);
  assert.equal(facets.sets.length, 1);
  const all = await getCatalogFacets({});
  assert.ok(all.languages.includes('JP'));
});
