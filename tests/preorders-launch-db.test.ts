import 'dotenv/config';
import assert from 'node:assert/strict';
import { after, test } from 'node:test';

if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1'].includes(
    new URL(process.env.DATABASE_URL ?? 'invalid:').hostname,
  )
)
  throw new Error('Ces tests sont réservés à une base de développement.');
process.env.NEXT_PUBLIC_PREORDERS_ENABLED = 'false';
const { getPrisma } = await import('../src/lib/db/prisma');
const { getProductRoute } = await import('../src/lib/catalog/queries');
const { getCatalogProducts } =
  await import('../src/lib/catalog/getCatalogProducts');
const { parseCatalogParams } = await import('../src/lib/catalog/params');
const { getCatalogFacets } = await import('../src/lib/catalog/facets');
const { getScopeStats, loadLandingIndex } =
  await import('../src/lib/seo/registry');
const { getIndexableListings } =
  await import('../src/components/catalog/listingHub');
const { assertPurchasable } = await import('../src/lib/cart/validation');
const { cartVariantSelect } = await import('../src/lib/cart/queries');
const { mutateCart } = await import('../src/lib/cart/service');
const db = getPrisma();
after(() => db.$disconnect());

test('base : produit précommande conservé mais absent des pages, facettes et index publics', async () => {
  const product = await db.product.findFirst({
    where: { status: 'ACTIVE', preorder: true },
  });
  assert.ok(
    product,
    'Le seed doit contenir une vraie précommande pour tester la fermeture',
  );
  assert.equal((await getProductRoute(product.slug)).state, 'missing');
  const listing = await getCatalogProducts(parseCatalogParams({}), {
    status: 'precommandes',
  });
  assert.equal(listing.total, 0);
  const stats = await getScopeStats({});
  assert.equal(stats.preorderCount, 0);
  assert.ok(stats.productCount > 0);
  const facets = await getCatalogFacets({});
  assert.ok(!facets.availability.some((option) => option.value === 'preorder'));
  const index = await loadLandingIndex();
  assert.ok(
    index.landings.every((page) => !page.path.includes('/precommandes')),
  );
  assert.ok(!(await getIndexableListings()).has('precommandes'));
  const variant = await db.productVariant.findFirst({
    where: {
      productId: product.id,
      isActive: true,
      availableQuantity: { gt: 0 },
    },
    select: cartVariantSelect,
  });
  assert.ok(variant);
  assert.throws(() => assertPurchasable(variant, 1), /plus disponible/);
  const cartsBefore = await db.cart.count();
  await assert.rejects(
    mutateCart(undefined, { kind: 'add', variantId: variant.id, quantity: 1 }),
    /plus disponible/,
  );
  assert.equal(
    await db.cart.count(),
    cartsBefore,
    'Aucun panier orphelin après le refus',
  );
  assert.equal(
    (await db.product.findUniqueOrThrow({ where: { id: product.id } }))
      .preorder,
    true,
  );
});
