import 'dotenv/config';
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { getPrisma } from '../src/lib/db/prisma';
import { getProductBySlug } from '../src/lib/catalog/queries';
import { getRelatedProducts } from '../src/lib/catalog/getRelatedProducts';
import { selectProductVariant } from '../src/lib/product/purchase';
import {
  productJsonLd,
  serializeJsonLd,
  productMetadata,
} from '../src/lib/product/seo';
const db = getPrisma();
after(() => db.$disconnect());
test('fiche : variantes actives, galerie ordonnée et DTO public', async () => {
  const product = await getProductBySlug('dev-etb-terres-de-braise');
  assert.ok(product);
  assert.equal(product.images.length, 3);
  assert.equal(product.images[0]?.isPrimary, true);
  assert.deepEqual(
    product.images.map((i) => i.sortOrder),
    [0, 1, 2],
  );
  assert.equal(product.variants.length, 2);
  const selected = selectProductVariant(product.variants);
  assert.equal(selected?.sku, 'DEV-ETB-BRAISE-FR');
  assert.equal(selected?.price, '59.90');
  assert.equal(selected?.maxQuantity, 7);
  const en = selectProductVariant(product.variants, 'DEV-ETB-BRAISE-EN');
  assert.equal(en?.price, '54.90');
  assert.equal(en?.availability, 'LOW_STOCK');
  assert.equal(en?.lowStockQuantity, 2);
  assert.ok(!JSON.stringify(product).includes('costPrice'));
  assert.deepEqual(JSON.parse(JSON.stringify(product)), product);
  const inactive = await getProductBySlug('dev-variante-inactive');
  assert.ok(inactive);
  assert.deepEqual(inactive.variants, []);
  assert.equal(await getProductBySlug('dev-brouillon'), null);
  assert.equal(await getProductBySlug('dev-archive'), null);
});
test('précommande et related products cohérents, sans duplication ni produit courant', async () => {
  const preorder = await getProductBySlug('dev-coffret-aurores');
  assert.ok(preorder);
  assert.equal(
    preorder.variants.find((v) => v.language === 'EN')?.maxQuantity,
    3,
  );
  assert.ok(preorder.variants.every((v) => v.availability === 'PREORDER'));
  const product = await getProductBySlug('dev-display-aurores-jp');
  assert.ok(product);
  const related = await getRelatedProducts(product);
  assert.equal(related.length, 4);
  assert.equal(new Set(related.map((p) => p.id)).size, 4);
  assert.ok(related.every((p) => p.id !== product.id));
  assert.equal(related[0]?.tcgSet?.slug, product.tcgSet?.slug);
});
test('SEO : offre réelle par défaut, absence de faux avis et échappement JSON-LD', async () => {
  const product = await getProductBySlug('dev-etb-terres-de-braise');
  assert.ok(product);
  const data = productJsonLd(product);
  assert.equal(data.offers?.price, '59.90');
  assert.equal(data.offers?.availability, 'https://schema.org/InStock');
  assert.equal(data.sku, 'DEV-ETB-BRAISE-FR');
  assert.ok(!/costPrice|review|rating/.test(JSON.stringify(data)));
  const serialized = serializeJsonLd(
    productJsonLd({ ...product, name: '</script><script>alert(1)</script>' }),
  );
  assert.ok(!serialized.includes('<'));
  assert.ok(serialized.includes('\\u003c'));
  const previous = process.env.SITE_URL;
  try {
    process.env.SITE_URL = 'https://caldera.example';
    const metadata = productMetadata(product);
    assert.equal(
      metadata.alternates?.canonical,
      'https://caldera.example/produit/dev-etb-terres-de-braise',
    );
    assert.ok(
      JSON.stringify(metadata.openGraph).includes('placeholder-sealed.png'),
    );
  } finally {
    if (previous === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = previous;
  }
});
