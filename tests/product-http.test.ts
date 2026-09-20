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
  assert.equal(res.status, status);
  const html = await res.text();
  assert.ok(!html.includes('costPrice'));
  return html;
}
function text(html: string) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/gu, ' ');
}
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
test('HTTP : galerie, breadcrumbs, metadata et JSON-LD', async () => {
  const html = await page('dev-etb-terres-de-braise');
  assert.ok(html.includes('Voir l’image 3'));
  assert.ok(html.includes('Fermer la vue agrandie'));
  assert.ok(html.includes('href="/categorie/etb"'));
  assert.ok(html.includes('href="/extensions/dev-terres-de-braise"'));
  const script = html.match(
    /<script type="application\/ld\+json">(.*?)<\/script>/s,
  );
  assert.ok(script?.[1]);
  const json = JSON.parse(script[1]);
  assert.equal(json['@type'], 'Product');
  assert.equal(json.offers.price, '59.90');
  assert.ok(!('review' in json));
  assert.ok(html.includes('property="og:title"'));
});
test('HTTP : rupture, précommande limitée, sans extension et sans variante', async () => {
  const sold = await page('dev-display-vallees');
  assert.match(sold, /<button[^>]*disabled=""[^>]*>[\s\S]*?Rupture de stock/);
  assert.ok(text(sold).includes('Rupture de stock'));
  const preorder = await page('dev-coffret-aurores?variant=DEV-COF-AURORES-EN');
  assert.ok(text(preorder).includes('Précommander'));
  assert.ok(text(preorder).includes('Sortie prévue le'));
  assert.match(preorder, /<input[^>]*type="number"[^>]*max="3"/);
  assert.ok(
    !text(await page('dev-classeur-foret')).includes('Dans l’extension'),
  );
  assert.ok(
    text(await page('dev-variante-inactive')).includes(
      'Produit momentanément indisponible',
    ),
  );
  for (const slug of ['inexistant', 'dev-brouillon', 'dev-archive'])
    await page(slug, 404);
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
  } finally {
    await db.$transaction(async (tx) => {
      await tx.productVariant.deleteMany({ where: { productId: product.id } });
      await tx.product.delete({ where: { id: product.id } });
    });
  }
});
