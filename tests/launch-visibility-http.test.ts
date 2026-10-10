import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { getPrisma } from '../src/lib/db/prisma';

const base = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
if (
  !['localhost', '127.0.0.1'].includes(
    new URL(process.env.DATABASE_URL ?? 'invalid:').hostname,
  ) ||
  !['localhost', '127.0.0.1'].includes(new URL(base).hostname)
)
  throw new Error('Tests réservés au serveur et à la base locale de QA.');
const db = getPrisma();
after(() => db.$disconnect());

async function temporaryRedirect(path: string, target: string) {
  const response = await fetch(`${base}${path}`, { redirect: 'manual' });
  // A layout can already have streamed; Next then encodes the redirect in its response.
  if (response.status === 307)
    assert.equal(
      new URL(response.headers.get('location')!, base).pathname,
      target,
    );
  else {
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert.ok(html.includes(`NEXT_REDIRECT;replace;${target};307;`), path);
  }
}

test('anciens liens : familles et extensions sans produit redirigées sans supprimer la donnée admin', async () => {
  const slug = `qa-empty-${randomUUID()}`;
  const category = await db.category.create({
    data: { slug, name: 'Famille QA sans produit' },
  });
  const set = await db.tcgSet.create({
    data: { slug, name: 'Extension QA sans produit' },
  });
  try {
    await temporaryRedirect(`/pokemon/${slug}`, '/pokemon');
    await temporaryRedirect(`/categorie/${slug}`, '/catalogue');
    await temporaryRedirect(`/extensions/${slug}`, '/catalogue');
    assert.ok(await db.category.findUnique({ where: { id: category.id } }));
    assert.ok(await db.tcgSet.findUnique({ where: { id: set.id } }));
    const html = await (await fetch(`${base}/catalogue`)).text();
    assert.ok(!html.includes(`href="/pokemon/${slug}"`));
    assert.ok(!html.includes(`href="/categorie/${slug}"`));
  } finally {
    await db.tcgSet.delete({ where: { id: set.id } });
    await db.category.delete({ where: { id: category.id } });
  }
});

test('recherche sans résultat : formulaire et réinitialisation conservés', async () => {
  const response = await fetch(
    `${base}/catalogue?search=qa-aucun-resultat-caldera`,
  );
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.ok(html.includes('Réinitialiser la recherche'));
  assert.ok(html.includes('Rechercher dans ce catalogue'));
  assert.ok(!html.includes('NEXT_REDIRECT;'));
});

test(
  'démonstration : achat masqué, compte et favoris conservés',
  { skip: process.env.TEST_CATALOG_DEMO !== '1' },
  async () => {
    await temporaryRedirect('/panier', '/catalogue');
    await temporaryRedirect('/checkout', '/catalogue');
    const html = await (await fetch(`${base}/`)).text();
    assert.ok(!html.includes('Ouvrir le panier'));
    assert.ok(html.includes('href="/favoris"'));
    assert.ok(html.includes('href="/compte/connexion"'));
    assert.ok(!html.includes('acheter sereinement'));
    assert.ok(html.includes('Aucun achat n’est encore possible'));
    const catalog = await (await fetch(`${base}/catalogue`)).text();
    assert.ok(!catalog.includes('au panier'));
    assert.ok(!catalog.includes('Prix croissant'));
    const product = await (
      await fetch(`${base}/produit/dev-etb-terres-de-braise`)
    ).text();
    assert.ok(product.includes('Les achats ne sont pas encore ouverts'));
    assert.ok(!product.includes('Ajouter au panier'));
  },
);
