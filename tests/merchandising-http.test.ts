import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { getPrisma } from '../src/lib/db/prisma';
const base = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
if (
  !['localhost', '127.0.0.1'].includes(new URL(base).hostname) ||
  !['localhost', '127.0.0.1'].includes(
    new URL(process.env.DATABASE_URL ?? 'invalid:').hostname,
  )
)
  throw new Error('Tests réservés au serveur et à la base locaux.');
const db = getPrisma();
after(() => db.$disconnect());
const read = async (path: string) => {
  const response = await fetch(`${base}${path}`, { redirect: 'manual' });
  return {
    response,
    html: (await response.text()).replace(
      /<script\b[^>]*>[\s\S]*?<\/script>/gi,
      '',
    ),
  };
};
test('HTTP merchandising : parcours réels, sélection persistée et aucune coquille vide', async () => {
  const { html: home, response } = await read('/');
  assert.equal(response.status, 200);
  for (const text of [
    'Pour commencer',
    'Pour collectionner',
    'À garder scellé',
  ])
    assert.ok(home.includes(text));
  for (const guide of [
    'etb-display-ou-booster',
    'debuter-collection-cartes-pokemon',
    'conserver-produits-scelles',
  ]) {
    assert.ok(home.includes(`/guides/${guide}`));
    assert.equal((await read(`/guides/${guide}`)).response.status, 200);
  }
  assert.equal((await read('/selections/inconnue')).response.status, 404);
  const key = randomUUID();
  const category = await db.category.create({
    data: { name: 'HTTP merchandising', slug: `merch-http-${key}` },
  });
  const tag = await db.tag.upsert({
    where: { slug: 'pour-commencer' },
    create: { name: 'Pour commencer', slug: 'pour-commencer' },
    update: {},
  });
  const product = await db.product.create({
    data: {
      name: 'Produit sélectionné HTTP',
      slug: `merch-http-${key}`,
      categoryId: category.id,
      status: 'ACTIVE',
      featured: true,
      newArrival: true,
      publishedAt: new Date(),
      productType: 'ACCESSORY', // No game: same scope as the homepage, not lost on the selection page.
      variants: {
        create: { sku: `MERCH-HTTP-${key}`, stockQuantity: 1, price: '20' },
      },
      tags: { connect: { id: tag.id } },
    },
  });
  try {
    const { response: selected, html } = await read(
      '/selections/pour-commencer',
    );
    assert.equal(selected.status, 200);
    const { html: curatedHome } = await read('/');
    assert.ok(curatedHome.includes('href="/selections/pour-commencer"'));
    const cards =
      curatedHome.match(/<article\b[^>]*>[\s\S]*?<\/article>/g) ?? [];
    assert.equal(
      cards.filter((card) => card.includes(`/produit/${product.slug}`)).length,
      1,
      'Un produit choisi ne se répète pas dans les rayons automatiques',
    );

    assert.ok(html.includes(`/produit/${product.slug}`));
    assert.match(html, /<meta name="robots" content="noindex, follow"/);
    assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1);
    assert.ok(html.includes('productType') === false);
    const { html: filtered } = await read(
      '/selections/pour-commencer?type=BOOSTER',
    );
    assert.ok(!filtered.includes(`/produit/${product.slug}`));
    await db.product.update({
      where: { id: product.id },
      data: { tags: { disconnect: { id: tag.id } } },
    });
    const empty = await read('/selections/pour-commencer');
    assert.equal(empty.response.status, 307);
    assert.equal(
      new URL(empty.response.headers.get('location') ?? '', base).pathname,
      '/catalogue',
    );
  } finally {
    await db.productVariant.deleteMany({ where: { productId: product.id } });
    await db.product.delete({ where: { id: product.id } });
    await db.category.delete({ where: { id: category.id } });
  }
});
