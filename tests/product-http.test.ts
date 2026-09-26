import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { getPrisma } from '../src/lib/db/prisma';
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
if (process.env.NODE_ENV === 'production')
  throw new Error('Tests réservés à une base de développement.');
const db = getPrisma();
after(() => db.$disconnect());
const base = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
async function page(slug: string, status = 200) {
  const res = await fetch(`${base}/produit/${slug}`);
  assert.equal(res.status, status, slug);
  const html = await res.text();
  assert.ok(!html.includes('costPrice'));
  return html;
}
/** Status and target of a redirect, without following it. */
async function redirection(slug: string) {
  const res = await fetch(`${base}/produit/${slug}`, { redirect: 'manual' });
  const location = res.headers.get('location');
  return {
    status: res.status,
    target: location ? new URL(location, base).pathname : null,
  };
}
function text(html: string) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/gu, ' ');
}
type Node = Record<string, unknown> & { '@type'?: string };
/** Every JSON-LD node of the page, @graph flattened. */
function jsonLd(html: string): Node[] {
  return [
    ...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs),
  ].flatMap(([, body]) => {
    const data = JSON.parse(body ?? '{}') as Node & { '@graph'?: Node[] };
    return data['@graph'] ?? [data];
  });
}
const productOf = (html: string) =>
  jsonLd(html).find((node) => node['@type'] === 'Product') as
    (Node & { offers: Node | Node[] }) | undefined;
const offersOf = (html: string) => {
  const offers = productOf(html)?.offers;
  return offers === undefined ? [] : Array.isArray(offers) ? offers : [offers];
};
test('HTTP : sélection FR / EN par URL, quantités et SKU', async () => {
  const fr = text(await page('dev-etb-terres-de-braise'));
  assert.ok(fr.includes('59,90 €'));
  assert.ok(fr.includes('SKU : DEV-ETB-BRAISE-FR'));
  assert.ok(fr.includes('Français'));
  assert.ok(fr.includes('69,90 €'));
  const en = await page('dev-etb-terres-de-braise?variant=DEV-ETB-BRAISE-EN');
  const copy = text(en);
  assert.ok(copy.includes('SKU : DEV-ETB-BRAISE-EN'));
  assert.ok(copy.includes('Plus que 2 en stock'));
  assert.match(en, /<input[^>]*type="number"[^>]*max="2"/);
  const invalid = text(await page('dev-etb-terres-de-braise?variant=inconnue'));
  assert.ok(invalid.includes('SKU : DEV-ETB-BRAISE-FR'));
});
test('HTTP : galerie, fil d’Ariane indexable, metadata et JSON-LD', async () => {
  const html = await page('dev-etb-terres-de-braise');
  assert.ok(html.includes('Voir l’image 3'));
  assert.ok(html.includes('Fermer la vue agrandie'));
  // Silo links only: never the /extensions/{slug} redirect nor the old tree.
  assert.ok(html.includes('href="/pokemon"'));
  assert.ok(html.includes('href="/pokemon/dev-terres-de-braise"'));
  assert.ok(!html.includes('href="/extensions/dev-terres-de-braise"'));
  assert.match(
    html,
    /<link rel="canonical" href="[^"]*\/produit\/dev-etb-terres-de-braise"/,
  );
  assert.match(html, /<title>[^<]*\| Caldera<\/title>/);
  assert.ok(!/<title>[^<]*Les Terres de Caldera/.test(html));
  assert.ok(!/<meta name="robots" content="noindex/.test(html));
  assert.ok(html.includes('property="og:title"'));
  const nodes = jsonLd(html);
  const product = productOf(html);
  assert.ok(product);
  assert.deepEqual(
    offersOf(html).map((offer) => [offer.sku, offer.price]),
    [
      ['DEV-ETB-BRAISE-FR', '59.90'],
      ['DEV-ETB-BRAISE-EN', '54.90'],
    ],
  );
  assert.ok(nodes.some((node) => node['@type'] === 'Organization'));
  assert.ok(!('review' in product) && !('aggregateRating' in product));
  const breadcrumb = nodes.find((node) => node['@type'] === 'BreadcrumbList');
  const items = (breadcrumb?.itemListElement ?? []) as { item: string }[];
  assert.match(
    items.at(-1)?.item ?? '',
    /\/produit\/dev-etb-terres-de-braise$/,
  );
  // « Voir aussi »: landings, glossary term of the type and related guides.
  const copy = text(html);
  assert.ok(copy.includes('Voir aussi'));
  assert.ok(html.includes('href="/glossaire/etb"'));
  assert.ok(html.includes('href="/guides/etb-display-ou-booster"'));
  assert.ok(copy.includes('Retours'));
});
test('HTTP : rupture indexable avec alternatives, précommande, sans extension et sans variante', async () => {
  const sold = await page('dev-display-vallees');
  assert.match(sold, /<button[^>]*disabled=""[^>]*>[\s\S]*?Rupture de stock/);
  assert.ok(text(sold).includes('Rupture de stock'));
  assert.ok(text(sold).includes('Produit épuisé.'));
  assert.ok(text(sold).includes('Alternatives disponibles'));
  assert.ok(sold.includes('href="#alternatives-title"'));
  assert.ok(!/<meta name="robots" content="noindex/.test(sold));
  assert.deepEqual(
    offersOf(sold).map((offer) => offer.availability),
    ['https://schema.org/OutOfStock'],
  );
  const preorder = await page('dev-coffret-aurores?variant=DEV-COF-AURORES-EN');
  assert.ok(text(preorder).includes('Précommander'));
  assert.ok(text(preorder).includes('Sortie prévue le'));
  assert.match(preorder, /<input[^>]*type="number"[^>]*max="3"/);
  assert.ok(
    offersOf(preorder).every(
      (offer) =>
        offer.availability === 'https://schema.org/PreOrder' &&
        typeof offer.availabilityStarts === 'string',
    ),
  );
  assert.ok(
    !text(await page('dev-classeur-foret')).includes('Dans l’extension'),
  );
  const inactive = await page('dev-variante-inactive');
  assert.ok(text(inactive).includes('Produit momentanément indisponible'));
  assert.match(inactive, /<meta name="robots" content="noindex, follow"/);
  assert.equal(productOf(inactive), undefined);
  for (const slug of ['inexistant', 'dev-brouillon']) await page(slug, 404);
});
test('HTTP : produit archivé et ancien slug en 308', async () => {
  assert.deepEqual(await redirection('dev-archive'), {
    status: 308,
    target: '/pokemon/boosters',
  });
  const product = await db.product.findUniqueOrThrow({
    where: { slug: 'dev-etb-terres-de-braise' },
    select: { id: true },
  });
  const fromSlug = `test-ancien-slug-${randomUUID()}`;
  await db.slugRedirect.create({
    data: { entityType: 'PRODUCT', fromSlug, entityId: product.id },
  });
  try {
    assert.deepEqual(await redirection(fromSlug), {
      status: 308,
      target: '/produit/dev-etb-terres-de-braise',
    });
  } finally {
    await db.slugRedirect.deleteMany({ where: { fromSlug } });
  }
});

test('HTTP : absence de galerie, de description et d’extension sans contenu inventé', async () => {
  const category = await db.category.findUniqueOrThrow({
    where: { slug: 'accessoires' },
  });
  const suffix = randomUUID();
  const product = await db.product.create({
    data: {
      name: 'Fixture sans visuel',
      slug: `test-fiche-${suffix}`,
      productType: 'ACCESSORY',
      status: 'ACTIVE',
      categoryId: category.id,
      variants: {
        create: {
          sku: `TEST-${suffix}`,
          price: '12.00',
          stockQuantity: 1,
          isDefault: true,
        },
      },
    },
  });
  try {
    const html = await page(product.slug);
    assert.ok(html.includes('placeholder-accessories.png'));
    assert.ok(!html.includes('<h2>Description</h2>'));
    assert.ok(!text(html).includes('Dans l’extension'));
    assert.ok(text(html).includes('Plus que 1 en stock'));
    assert.equal(
      (productOf(html)?.image as unknown) ?? undefined,
      undefined,
      'Aucun visuel de remplacement dans le JSON-LD',
    );
  } finally {
    await db.$transaction(async (tx) => {
      await tx.productVariant.deleteMany({ where: { productId: product.id } });
      await tx.product.delete({ where: { id: product.id } });
    });
  }
});
