import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { getPrisma } from '../src/lib/db/prisma';
import { getCatalogProducts } from '../src/lib/catalog/getCatalogProducts';
import { getCatalogFacets } from '../src/lib/catalog/facets';
import { parseCatalogParams } from '../src/lib/catalog/params';

if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1'].includes(
    new URL(process.env.DATABASE_URL ?? 'invalid:').hostname,
  )
)
  throw new Error('Tests réservés à PostgreSQL local de développement.');
const db = getPrisma();
after(() => db.$disconnect());

test('catalogue : ventes payées, pagination stable et disponibilité réelle', async (t) => {
  const key = `qa-catalog-${randomUUID().slice(0, 8)}`;
  const category = await db.category.create({
    data: { name: key, slug: key, isActive: true },
  });
  const cartIds: string[] = [],
    checkoutIds: string[] = [],
    orderIds: string[] = [];
  const products: { id: string; slug: string }[] = [];
  const scope = { category: key };
  const catalog = (params: Record<string, string> = {}) =>
    getCatalogProducts(parseCatalogParams(params), scope);
  try {
    for (let index = 0; index < 16; index++) {
      products.push(
        await db.product.create({
          data: {
            name: `${key}-${index}`,
            slug: `${key}-${index}`,
            categoryId: category.id,
            status: 'ACTIVE',
            productType: index % 2 ? 'ETB' : 'BOOSTER',
            publishedAt: new Date(Date.UTC(2026, 0, index + 1)),
            isDemonstration: index === 15,
            variants: {
              create: [
                {
                  sku: `${key}-${index}-FR`,
                  language: 'FR',
                  price: '10',
                  stockQuantity: index === 14 ? 0 : index === 13 ? 2 : 10,
                  lowStockThreshold: 2,
                },
                {
                  sku: `${key}-${index}-EN`,
                  language: 'EN',
                  price: '20',
                  stockQuantity: 0,
                },
              ],
            },
          },
          select: { id: true, slug: true },
        }),
      );
    }
    assert.equal((await getCatalogFacets(scope)).hasSales, false);
    const order = async (
      status: 'PAID' | 'PENDING_PAYMENT',
      entries: [number, number][],
    ) => {
      const cart = await db.cart.create({
        data: {
          tokenHash: randomUUID().replaceAll('-', '').repeat(2),
          expiresAt: new Date(Date.now() + 86400000),
        },
      });
      cartIds.push(cart.id);
      const checkout = await db.checkoutSession.create({
        data: { cartId: cart.id, expiresAt: new Date(Date.now() + 86400000) },
      });
      checkoutIds.push(checkout.id);
      const result = await db.order.create({
        data: {
          checkoutSessionId: checkout.id,
          publicId: randomUUID().replaceAll('-', '').repeat(2),
          orderNumber: `${key}-${randomUUID()}`,
          status,
          email: `${key}@example.com`,
          currency: 'EUR',
          subtotalAmount: '100',
          shippingAmount: '0',
          totalAmount: '100',
          shippingMethodCode: 'QA',
          shippingMethodName: 'Test local',
          items: {
            create: entries.map(([index, quantity]) => ({
              productId: products[index]!.id,
              productSlug: products[index]!.slug,
              productName: `${key}-${index}`,
              sku: `${key}-${index}-FR`,
              language: 'FR',
              unitPrice: '10',
              quantity,
              lineTotal: String(quantity * 10),
              imageUrl: '/images/placeholder.svg',
            })),
          },
        },
      });
      orderIds.push(result.id);
    };
    await order('PAID', [
      [0, 2],
      [1, 9],
      [2, 5],
      [3, 5],
      [15, 1000],
    ]);
    await order('PAID', [[0, 10]]);
    await order('PENDING_PAYMENT', [[4, 5000]]);
    await t.test(
      'popularité : quantités payées cumulées, égalités stables, exemples exclus',
      async () => {
        const result = await catalog({ sort: 'popular' });
        assert.equal(result.total, 16);
        assert.equal(result.products.length, 12);
        const tied = [products[2]!.id, products[3]!.id].sort();
        assert.deepEqual(
          result.products.slice(0, 4).map((p) => p.id),
          [products[0]!.id, products[1]!.id, ...tied],
        );
        assert.equal(result.products[4]?.id, products[15]!.id); // newest unsold, never ranked by fabricated sales
        assert.equal((await getCatalogFacets(scope)).hasSales, true);
        const second = await catalog({ sort: 'popular', page: '2' });
        const ids = [...result.products, ...second.products].map((p) => p.id);
        assert.equal(ids.length, 16);
        assert.equal(new Set(ids).size, 16);
        assert.deepEqual(
          (await catalog({ sort: 'popular', page: '99' })).products,
          second.products,
        );
      },
    );
    await t.test(
      'popularité : les filtres et la page sont appliqués en base',
      async () => {
        const filtered = await catalog({
          sort: 'popular',
          type: 'ETB',
          language: 'FR',
          maxPrice: '15',
        });
        assert.equal(filtered.total, 8);
        assert.equal(filtered.products[0]?.id, products[1]!.id);
        assert.equal(filtered.products[1]?.id, products[3]!.id);
        assert.ok(
          filtered.products.every(
            (p) => p.languages.length === 1 && p.languages[0] === 'FR',
          ),
        );
        assert.equal(
          (await catalog({ sort: 'popular', minPrice: '30' })).total,
          0,
        );
      },
    );
    await t.test(
      'popularité : une page de ventes pleine suivie des invendus',
      async () => {
        await order(
          'PAID',
          Array.from({ length: 9 }, (_, index): [number, number] => [
            index + 4,
            1,
          ]),
        );
        const first = await catalog({ sort: 'popular' });
        const second = await catalog({ sort: 'popular', page: '2' });
        assert.equal(first.products.length, 12);
        assert.equal(second.products.length, 4);
        const ids = [...first.products, ...second.products].map((p) => p.id);
        assert.equal(new Set(ids).size, 16);
        assert.ok(first.products.every((p) => !p.isDemonstration));
        assert.equal(second.products[1]?.id, products[15]!.id);
      },
    );
    await t.test(
      'épuisé : pas de faux épuisement sur un produit multivariante, stock réservé déduit',
      async () => {
        const exhausted = await catalog({ availability: 'out-of-stock' });
        assert.deepEqual(
          exhausted.products.map((p) => p.id),
          [products[14]!.id],
        );
        assert.equal(exhausted.products[0]?.availability, 'OUT_OF_STOCK');
        assert.equal(
          (await catalog({ availability: 'out-of-stock', language: 'EN' }))
            .total,
          16,
        );
        assert.equal(
          (await catalog({ availability: 'out-of-stock', maxPrice: '15' }))
            .total,
          1,
        );
        await db.productVariant.updateMany({
          where: { productId: products[12]!.id, language: 'FR' },
          data: { reservedQuantity: 10 },
        });
        assert.equal(
          (await catalog({ availability: 'out-of-stock' })).total,
          2,
        );
        const low = await catalog({ availability: 'low-stock' });
        assert.deepEqual(
          low.products.map((p) => p.id),
          [products[13]!.id],
        );
        assert.equal(low.products[0]?.availability, 'LOW_STOCK');
        const facets = await getCatalogFacets(scope);
        assert.equal(
          facets.availability.find((f) => f.value === 'out-of-stock')?.count,
          2,
        );
      },
    );
  } finally {
    await db.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await db.order.deleteMany({ where: { id: { in: orderIds } } });
    await db.checkoutSession.deleteMany({ where: { id: { in: checkoutIds } } });
    await db.cart.deleteMany({ where: { id: { in: cartIds } } });
    await db.productVariant.deleteMany({
      where: { product: { categoryId: category.id } },
    });
    await db.product.deleteMany({ where: { categoryId: category.id } });
    await db.category.delete({ where: { id: category.id } });
  }
});
