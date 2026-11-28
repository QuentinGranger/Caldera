import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { getPrisma } from '../src/lib/db/prisma';
import { GET } from '../src/app/api/finance/inventory/route';
test('flux réassort authentifié, disponibilité après réservations et pagination', async () => {
  assert.ok(
    process.env.NODE_ENV !== 'production' &&
      ['localhost', '127.0.0.1'].includes(
        new URL(process.env.DATABASE_URL!).hostname,
      ),
  );
  const db = getPrisma(),
    key = randomUUID(),
    old = process.env.FINANCE_REPORT_SECRET;
  const category = await db.category.create({
    data: { slug: key, name: 'Test Make stock' },
  });
  const product = await db.product.create({
    data: {
      categoryId: category.id,
      slug: key,
      name: 'Booster',
      productType: 'BOOSTER',
      status: 'ACTIVE',
    },
  });
  const url = 'http://localhost/api/finance/inventory?vue=reassort';
  const headers = { authorization: 'Bearer ' + key };
  process.env.FINANCE_REPORT_SECRET = key;
  try {
    assert.equal((await GET(new Request(url))).status, 401);
    assert.equal(
      (await GET(new Request(url + '&after=abc', { headers }))).status,
      400,
    );
    await db.productVariant.createMany({
      data: Array.from({ length: 251 }, (_, i) => ({
        productId: product.id,
        sku: key + '-' + i,
        price: '10',
        stockQuantity: i === 0 ? 3 : 12,
        reservedQuantity: i === 0 ? 3 : 0,
        lowStockThreshold: 4,
      })),
    });
    const variants = [];
    let after = '';
    do {
      const response = await GET(
        new Request(url + '&after=' + after, { headers }),
      );
      assert.equal(response.status, 200);
      const page = await response.json();
      assert.equal(page.scope, 'reassort');
      assert.equal(page.after, after);
      assert.ok(page.variants.length <= 250);
      variants.push(...page.variants);
      if (page.next) assert.ok(page.next > after);
      after = page.next;
    } while (after);
    const ours = variants.filter((v) => v.sku.startsWith(key));
    assert.equal(ours.length, 251);
    assert.equal(new Set(ours.map((v) => v.id)).size, 251);
    const zero = ours.find((v) => v.sku === key + '-0');
    assert.equal(zero.available, 0);
    assert.equal(zero.reserved, 3);
    assert.equal(zero.threshold, 4);
    assert.equal(ours.filter((v) => v.available > v.threshold).length, 250);
    await db.product.update({
      where: { id: product.id },
      data: { preorder: true },
    });
    const skipped = await (await GET(new Request(url, { headers }))).json();
    assert.ok(
      !skipped.variants.some((v: { sku: string }) => v.sku.startsWith(key)),
    );
  } finally {
    if (old === undefined) delete process.env.FINANCE_REPORT_SECRET;
    else process.env.FINANCE_REPORT_SECRET = old;
    await db.productVariant.deleteMany({ where: { productId: product.id } });
    await db.product.delete({ where: { id: product.id } });
    await db.category.delete({ where: { id: category.id } });
    await db.$disconnect();
  }
});
