import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { getPrisma } from '../src/lib/db/prisma';
import {
  getMerchandisingProducts,
  getShoppingIntentLinks,
} from '../src/lib/catalog/queries';
import { getCatalogProducts } from '../src/lib/catalog/getCatalogProducts';
import { getCatalogFacets } from '../src/lib/catalog/facets';
import { parseCatalogParams } from '../src/lib/catalog/params';
import { saveProduct } from '../src/lib/admin/products';
import type { MerchandisingKey } from '../src/lib/catalog/merchandising';

if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1'].includes(
    new URL(process.env.DATABASE_URL ?? 'invalid:').hostname,
  )
)
  throw new Error('Tests réservés à PostgreSQL local.');
const db = getPrisma();
after(() => db.$disconnect());
const daysAgo = (days: number) => new Date(Date.now() - days * 86400000);

test('merchandising : conseils éditoriaux et preuves de disponibilité', async (t) => {
  const key = randomUUID();
  const category = await db.category.create({
    data: { name: 'Merchandising QA', slug: `merch-${key}` },
  });
  const admin = await db.adminUser.create({
    data: { name: 'Merchandising QA', email: `merch-${key}@example.com` },
  });
  const ids: string[] = [];
  const make = async (
    name: string,
    extra: Record<string, unknown> = {},
    stock = 8,
  ) => {
    const product = await db.product.create({
      data: {
        name,
        slug: `merch-${name}-${key}`,
        categoryId: category.id,
        productType: 'ETB',
        status: 'ACTIVE',
        newArrival: true,
        publishedAt: daysAgo(2),
        ...extra,
        variants: {
          create: {
            sku: `MERCH-${name}-${key}`,
            price: '40',
            stockQuantity: stock,
            isDefault: true,
          },
        },
      },
      include: { variants: true },
    });
    ids.push(product.id);
    return product;
  };
  const selected = async (selection: MerchandisingKey) =>
    (
      await getMerchandisingProducts(selection, 100, {
        categoryId: category.id,
      })
    ).map((p) => p.id);
  try {
    const fresh = await make('fresh');
    await db.productVariant.create({
      data: {
        productId: fresh.id,
        sku: `MERCH-fresh-EN-${key}`,
        language: 'EN',
        price: '1',
        stockQuantity: 0,
      },
    });
    const old = await make('old', { publishedAt: daysAgo(8) });
    await make('future', { publishedAt: daysAgo(-2) });
    await make('undated', { publishedAt: null });
    await make('sold-out', {}, 0);
    await make('preorder', { preorder: true });
    await make('example', { isDemonstration: true }, 1);
    await make('free', {}, 2).then((p) =>
      db.productVariant.update({
        where: { id: p.variants[0]!.id },
        data: { price: '0' },
      }),
    );
    const low = await make('low', { newArrival: false }, 2);
    const mixed = await make('mixed', { newArrival: false }, 1);
    await db.productVariant.create({
      data: {
        productId: mixed.id,
        sku: `MERCH-mixed-high-${key}`,
        price: '40',
        stockQuantity: 8,
      },
    });
    await t.test(
      'nouveauté : sept jours, date réelle, prix positif et stock ; aucun exemple',
      async () => {
        assert.deepEqual(await selected('nouveaute-de-la-semaine'), [fresh.id]);
        assert.deepEqual(await selected('derniers-exemplaires'), [low.id]);
        const scope = {
          merchandising: 'nouveaute-de-la-semaine' as const,
          category: category.slug,
        };
        assert.equal(
          (
            await getCatalogProducts(
              parseCatalogParams({ language: 'EN' }),
              scope,
            )
          ).total,
          0,
        );
        const weekly = await getMerchandisingProducts(
          'nouveaute-de-la-semaine',
          4,
          { categoryId: category.id },
        );
        assert.equal(weekly[0]?.price, '40.00');
        assert.deepEqual(weekly[0]?.languages, ['FR']);
      },
    );
    await t.test(
      'retour : historique nécessaire, premier stock et ancien réassort exclus',
      async () => {
        const variant = old.variants[0]!;
        const adjustment = (
          previousQuantity: number,
          newQuantity: number,
          age: number,
        ) =>
          db.inventoryAdjustment.create({
            data: {
              variantId: variant.id,
              adminUserId: admin.id,
              type: 'RESTOCK',
              previousQuantity,
              newQuantity,
              quantityDelta: newQuantity - previousQuantity,
              reason: 'QA',
              createdAt: daysAgo(age),
            },
          });
        await adjustment(0, 8, 6); // First stock alone does not prove a return.
        assert.deepEqual(await selected('retour-en-stock'), []);
        await adjustment(0, 8, 1);
        assert.deepEqual(await selected('retour-en-stock'), [old.id]);
        await db.inventoryAdjustment.updateMany({
          where: { variantId: variant.id },
          data: { createdAt: daysAgo(40) },
        });
        assert.deepEqual(await selected('retour-en-stock'), []);
      },
    );
    await t.test(
      'admin : créer, modifier et retirer les choix, préserver les tags libres',
      async () => {
        const edit = async (
          choices: Record<string, string> = {},
          type = 'ETB',
        ) => {
          const product = await db.product.findUniqueOrThrow({
            where: { id: fresh.id },
          });
          const form = new FormData();
          for (const [name, value] of Object.entries({
            id: product.id,
            version: product.updatedAt.toISOString(),
            name: product.name,
            slug: product.slug,
            categoryId: category.id,
            productType: type,
            tags: 'QA libre',
            merchandisingConfigured: 'on',
            ...choices,
          }))
            form.set(name, value);
          return saveProduct(admin.id, form);
        };
        await edit({
          'pour-commencer': 'on',
          'pour-collectionner': 'on',
          featured: 'on',
        });
        assert.deepEqual(await selected('pour-commencer'), [fresh.id]);
        assert.deepEqual(await selected('pour-collectionner'), [fresh.id]);
        assert.deepEqual(await selected('du-moment'), [fresh.id]);
        const scope = { merchandising: 'pour-commencer' as const };
        const result = await getCatalogProducts(parseCatalogParams({}), scope);
        const facets = await getCatalogFacets(scope);
        assert.ok(result.products.some((p) => p.id === fresh.id));
        assert.equal(result.total, facets.total);
        assert.ok(
          (await getShoppingIntentLinks()).find(
            (i) => i.slug === 'pour-commencer',
          )?.href,
        );
        await edit({ 'a-garder-scelle': 'on' });
        assert.deepEqual(await selected('pour-commencer'), []);
        assert.deepEqual(await selected('a-garder-scelle'), [fresh.id]);
        await assert.rejects(
          edit({ 'a-garder-scelle': 'on' }, 'SINGLE_CARD'),
          /réservé aux produits scellés/,
        );
        await edit();
        assert.deepEqual(await selected('a-garder-scelle'), []);
        const tags = await db.tag.findMany({
          where: { products: { some: { id: fresh.id } } },
        });
        assert.deepEqual(
          tags.map((tag) => tag.slug),
          ['qa-libre'],
        );
      },
    );
    await t.test(
      'mode démo : aucune urgence même si la base contient du vrai stock',
      async () => {
        const previous = process.env.CATALOG_DEMO_MODE;
        try {
          process.env.CATALOG_DEMO_MODE = '1';
          for (const selection of [
            'nouveaute-de-la-semaine',
            'derniers-exemplaires',
            'retour-en-stock',
          ] as const)
            assert.deepEqual(await selected(selection), []);
        } finally {
          if (previous === undefined) delete process.env.CATALOG_DEMO_MODE;
          else process.env.CATALOG_DEMO_MODE = previous;
        }
      },
    );
  } finally {
    await db.inventoryAdjustment.deleteMany({
      where: { adminUserId: admin.id },
    });
    await db.adminAuditLog.deleteMany({ where: { adminUserId: admin.id } });
    await db.productVariant.deleteMany({ where: { productId: { in: ids } } });
    await db.product.deleteMany({ where: { id: { in: ids } } });
    await db.category.delete({ where: { id: category.id } });
    await db.adminUser.delete({ where: { id: admin.id } });
    await db.tag.deleteMany({
      where: { slug: 'qa-libre', products: { none: {} } },
    });
  }
});
