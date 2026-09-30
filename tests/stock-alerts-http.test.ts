import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { getPrisma } from '../src/lib/db/prisma';

if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1'].includes(
    new URL(process.env.DATABASE_URL ?? 'invalid:').hostname,
  )
)
  throw new Error('Fixtures réservées à la base de développement.');
// Server started with EMAILS_ENABLED=false: confirmations are only logged.
const base = process.env.TEST_BASE_URL ?? 'http://localhost:3001';
const origin = new URL(base).origin;
const manifest = JSON.parse(
  await readFile('.next/server/server-reference-manifest.json', 'utf8'),
) as { node: Record<string, { exportedName?: string }> };
const db = getPrisma();

async function formAction(
  path: string,
  name: string,
  values: Record<string, string>,
) {
  const id = Object.entries(manifest.node).find(
    ([, value]) => value.exportedName === name,
  )?.[0];
  assert.ok(id, `Action absente du manifest : ${name}`);
  const data = new FormData();
  for (const [field, value] of Object.entries(values))
    data.set(`_1_${field}`, value);
  data.set('0', JSON.stringify([{ success: false, message: '' }, '$K1']));
  const response = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Next-Action': id, Accept: 'text/x-component', Origin: origin },
    body: data,
  });
  return response.text();
}

test('alertes de retour en stock HTTP : formulaire, inscription, pages privées', async (t) => {
  const key = randomUUID().slice(0, 8);
  const category = await db.category.create({
    data: { name: `Alerte HTTP ${key}`, slug: `alerte-http-${key}` },
  });
  const product = await db.product.create({
    data: {
      name: `Display alerte ${key}`,
      slug: `display-alerte-${key}`,
      categoryId: category.id,
      status: 'ACTIVE',
      productType: 'DISPLAY',
      variants: {
        create: {
          sku: `ALERTE-HTTP-${key}`,
          price: '149.90',
          stockQuantity: 0,
        },
      },
    },
    include: { variants: true },
  });
  const variantId = product.variants[0]!.id;
  const path = `/produit/${product.slug}`;
  const email = `alerte-http-${key}@example.com`;
  try {
    await t.test(
      'fiche épuisée : formulaire d’alerte pour la version',
      async () => {
        const html = await (await fetch(`${base}${path}`)).text();
        assert.match(html, /Être prévenu du retour/);
        assert.match(html, /M’avertir du retour/);
        assert.ok(html.includes(`name="variantId" value="${variantId}"`));
        assert.doesNotMatch(html, /seront disponibles ultérieurement/);
      },
    );

    await t.test(
      'visiteur : réponse générique, alerte en attente',
      async () => {
        const body = await formAction(path, 'subscribeStockAlertAction', {
          variantId,
          email,
        });
        assert.match(body, /Vérifiez votre boîte mail/);
        const alert = await db.stockAlert.findUniqueOrThrow({
          where: { email_variantId: { email, variantId } },
        });
        assert.equal(alert.status, 'PENDING');
        assert.equal(alert.customerId, null);
      },
    );

    await t.test(
      'robots et saisies invalides : rien n’est enregistré',
      async () => {
        const bot = `robot-${key}@example.com`;
        const trapped = await formAction(path, 'subscribeStockAlertAction', {
          variantId,
          email: bot,
          website: 'https://spam.example',
        });
        assert.match(trapped, /Vérifiez votre boîte mail/);
        assert.equal(await db.stockAlert.count({ where: { email: bot } }), 0);
        assert.match(
          await formAction(path, 'subscribeStockAlertAction', {
            variantId,
            email: 'pas-une-adresse',
          }),
          /Indiquez une adresse e-mail valide/,
        );
        assert.match(
          await formAction(path, 'subscribeStockAlertAction', {
            variantId: 'pas-un-id',
            email,
          }),
          /Choisissez une version/,
        );
      },
    );

    await t.test(
      'pages d’e-mail : privées, jeton lu dans le navigateur',
      async () => {
        for (const page of [
          '/alertes/confirmation',
          '/alertes/desinscription',
        ]) {
          const response = await fetch(`${base}${page}`);
          assert.equal(response.status, 200, page);
          assert.match(response.headers.get('cache-control') ?? '', /no-store/);
          assert.match(response.headers.get('x-robots-tag') ?? '', /noindex/);
          assert.match(await response.text(), /name="token" value=""/);
        }
        assert.match(
          await formAction('/alertes/confirmation', 'confirmStockAlertAction', {
            token: 'x'.repeat(43),
          }),
          /expiré ou a déjà servi/,
        );
        assert.match(
          await formAction(
            '/alertes/desinscription',
            'removeStockAlertAction',
            {
              token: `${randomUUID()}.${'0'.repeat(64)}`,
            },
          ),
          /pas valable/,
        );
        // The account list needs a session.
        const account = await fetch(`${base}/compte/alertes`, {
          redirect: 'manual',
        });
        assert.equal(account.status, 307);
        assert.equal(
          account.headers.get('location'),
          '/compte/connexion?retour=%2Fcompte%2Falertes',
        );
      },
    );
  } finally {
    await db.stockAlert.deleteMany({ where: { variantId } });
    await db.customerAuthAttempt.deleteMany({
      where: { key: { not: 'global' } },
    });
    await db.productVariant.deleteMany({ where: { productId: product.id } });
    await db.product.delete({ where: { id: product.id } });
    await db.category.delete({ where: { id: category.id } });
    await db.$disconnect();
  }
});
