import 'dotenv/config';
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { getPrisma } from '../src/lib/db/prisma';
import { formatPrice } from '../src/utils/formatPrice';

if (process.env.NODE_ENV === 'production')
  throw new Error('Ces tests sont réservés à une base de développement.');
const db = getPrisma();
const base = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
after(() => db.$disconnect());

async function page(path: string, status = 200) {
  const response = await fetch(`${base}${path}`);
  assert.equal(response.status, status, path);
  const html = await response.text();
  assert.ok(
    !/costPrice|DATABASE_URL/.test(html),
    'Aucune donnée interne publique',
  );
  return html;
}
function text(html: string) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/gu, ' ');
}
function cards(html: string, slug: string) {
  return [...html.matchAll(/<article\b[^>]*>[\s\S]*?<\/article>/g)]
    .map(([article]) => article)
    .filter((article) => article.includes(`/produit/${slug}`));
}

test('HTTP : pages PostgreSQL, metadata, SKU, images et véritables 404', async () => {
  assert.deepEqual(await (await fetch(`${base}/api/health`)).json(), {
    status: 'ok',
    database: 'connected',
  });
  for (const path of ['/', '/catalogue']) {
    const html = await page(path);
    assert.ok(html.includes('/produit/dev-etb-terres-de-braise'));
    assert.ok(!html.includes('/produit/dev-brouillon'));
  }
  const detail = await page('/produit/dev-etb-terres-de-braise');
  assert.match(detail, /<title>\[Démo\] ETB — Terres de Braise/);
  assert.ok(detail.includes('DEV-ETB-BRAISE-FR'));
  assert.ok(detail.includes('DEV-ETB-BRAISE-EN'));
  assert.ok(!detail.includes('DEV-ETB-BRAISE-JP-INACTIF'));
  for (const slug of ['inexistant', 'dev-brouillon', 'dev-archive'])
    await page(`/produit/${slug}`, 404);
  const image = await fetch(`${base}/assets/products/placeholder-product.png`);
  assert.equal(image.status, 200);
  assert.equal(image.headers.get('content-type'), 'image/png');
});

test('HTTP : un changement de prix et de stock apparaît au rafraîchissement', async () => {
  const sku = 'DEV-BST-BRAISE-FR';
  const slug = 'dev-booster-terres-de-braise';
  const original = await db.productVariant.findUniqueOrThrow({
    where: { sku },
  });
  try {
    await db.productVariant.update({
      where: { sku },
      data: { price: '6.37', stockQuantity: 0 },
    });
    for (const path of [
      '/',
      '/catalogue?search=dev-booster-terres-de-braise',
    ]) {
      const matches = cards(await page(path), slug);
      assert.equal(
        matches.length,
        1,
        'Le produit en rupture quitte les réassorts',
      );
      assert.ok(text(matches[0]!).includes(text(formatPrice('6.37'))));
      assert.ok(text(matches[0]!).includes('Rupture'));
    }
    const detail = text(await page(`/produit/${slug}`));
    assert.ok(detail.includes(text(formatPrice('6.37'))));
    assert.ok(detail.includes('Rupture'));
  } finally {
    await db.productVariant.update({
      where: { sku },
      data: {
        price: original.price,
        stockQuantity: original.stockQuantity,
        updatedAt: original.updatedAt,
      },
    });
  }
  const restored = await db.productVariant.findUniqueOrThrow({
    where: { sku },
  });
  assert.ok(restored.price.equals(original.price));
  assert.equal(restored.stockQuantity, original.stockQuantity);
});
