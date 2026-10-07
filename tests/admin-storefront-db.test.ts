import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { getPrisma } from '../src/lib/db/prisma';
import {
  hiddenPublishedWhere,
  readStorefrontStatus,
} from '../src/lib/admin/storefront';
import { saveShippingMethod } from '../src/lib/admin/shipping';

if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1'].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  )
)
  throw new Error('Tests réservés à la base de développement.');
const db = getPrisma();

function form(values: Record<string, string | boolean>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values))
    if (value !== false) data.set(key, value === true ? 'on' : value);
  return data;
}

test('admin ↔ boutique : visibilité des produits et livraison', async (t) => {
  const key = randomUUID().slice(0, 8);
  const admin = await db.adminUser.create({
    data: { name: 'Test boutique', email: `storefront-${key}@example.com` },
  });
  const category = await db.category.create({
    data: { name: `Visibilité ${key}`, slug: `visibilite-${key}` },
  });
  const product = await db.product.create({
    data: {
      name: `Coffret visibilité ${key}`,
      slug: `coffret-visibilite-${key}`,
      categoryId: category.id,
      status: 'ACTIVE',
      productType: 'ETB',
      variants: {
        create: { sku: `VIS-${key}`, price: '49.90', stockQuantity: 3 },
      },
    },
    include: { variants: true },
  });
  const country = await db.shippingCountry.findFirstOrThrow();
  const method = await db.shippingMethod.create({
    data: {
      code: `VIS-${key}`,
      name: 'Livraison visibilité',
      price: '4.90',
      isActive: false,
      countries: { connect: { code: country.code } },
    },
  });
  const hidden = async () =>
    (
      await db.product.findMany({
        where: { id: product.id, ...hiddenPublishedWhere },
        select: { id: true },
      })
    ).length === 1;
  const blocks = async () =>
    (await readStorefrontStatus(product.id)).checks
      .filter((check) => check.state === 'block')
      .map((check) => check.label);
  try {
    await t.test('publié, parents actifs : en ligne', async () => {
      const status = await readStorefrontStatus(product.id);
      assert.equal(status.listed, true);
      assert.deepEqual(await blocks(), []);
      // No image: shown with the generic visual, flagged but not blocking.
      assert.equal(
        status.checks.find((check) => check.label === 'Images')?.state,
        'warn',
      );
      assert.equal(await hidden(), false);
    });

    await t.test(
      'catégorie désactivée : invisible, et dit pourquoi',
      async () => {
        await db.category.update({
          where: { id: category.id },
          data: { isActive: false },
        });
        assert.equal((await readStorefrontStatus(product.id)).listed, false);
        assert.deepEqual(await blocks(), ['Catégorie']);
        assert.equal(await hidden(), true);
        await db.category.update({
          where: { id: category.id },
          data: { isActive: true },
        });
      },
    );

    await t.test('variante désactivée puis prix à 0', async () => {
      const variant = product.variants[0]!;
      await db.productVariant.update({
        where: { id: variant.id },
        data: { isActive: false },
      });
      assert.deepEqual(await blocks(), ['Variantes']);
      assert.equal(await hidden(), true);
      await db.productVariant.update({
        where: { id: variant.id },
        data: { isActive: true, price: '0' },
      });
      assert.deepEqual(await blocks(), ['Prix']);
      await db.productVariant.update({
        where: { id: variant.id },
        data: { price: '49.90' },
      });
    });

    await t.test('brouillon : hors boutique, pas une anomalie', async () => {
      await db.product.update({
        where: { id: product.id },
        data: { status: 'DRAFT' },
      });
      assert.deepEqual(await blocks(), ['Publication']);
      // Only published products count as "published but invisible".
      assert.equal(await hidden(), false);
    });

    await t.test('livraison : tarif, gratuité, délais et pays', async () => {
      const saved = await saveShippingMethod(
        admin.id,
        form({
          id: method.id,
          name: 'Point relais',
          description: '',
          price: '5,40',
          freeFromAmount: '100',
          estimatedMinDays: '2',
          estimatedMaxDays: '4',
          sortOrder: '3',
          isActive: true,
          [`country:${country.code}`]: true,
        }),
      );
      assert.equal(saved.price.toFixed(2), '5.40');
      assert.equal(saved.freeFromAmount?.toFixed(2), '100.00');
      assert.equal(saved.isActive, true);
      const audit = await db.adminAuditLog.findFirstOrThrow({
        where: { adminUserId: admin.id, action: 'SHIPPING_METHOD_UPDATED' },
      });
      assert.deepEqual((audit.metadata as { price: unknown }).price, {
        before: '4.90',
        after: '5.40',
      });
      const base = {
        id: method.id,
        name: 'Point relais',
        price: '5.40',
        sortOrder: '3',
      };
      await assert.rejects(
        saveShippingMethod(
          admin.id,
          form({ ...base, estimatedMinDays: '5', estimatedMaxDays: '2' }),
        ),
        /minimum dépasse/,
      );
      await assert.rejects(
        saveShippingMethod(admin.id, form({ ...base, isActive: true })),
        /au moins un pays/,
      );
      await assert.rejects(
        saveShippingMethod(admin.id, form({ ...base, freeFromAmount: '0' })),
        /gratuité/,
      );
      await assert.rejects(
        saveShippingMethod(admin.id, form({ ...base, code: 'AUTRE' })),
        /non autorisé/,
      );
    });
  } finally {
    await db.adminAuditLog.deleteMany({ where: { adminUserId: admin.id } });
    await db.adminUser.delete({ where: { id: admin.id } });
    await db.shippingMethod.delete({ where: { id: method.id } });
    await db.productVariant.deleteMany({ where: { productId: product.id } });
    await db.product.delete({ where: { id: product.id } });
    await db.category.delete({ where: { id: category.id } });
    await db.$disconnect();
  }
});
