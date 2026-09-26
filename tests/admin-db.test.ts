import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import sharp from 'sharp';
import { hashPassword, verifyPassword } from 'better-auth/crypto';
import { getPrisma } from '../src/lib/db/prisma';
import {
  saveProduct,
  saveVariant,
  changePublication,
} from '../src/lib/admin/products';
import { adjustStock } from '../src/lib/admin/inventory';
import { saveCategory, saveGame, saveSet } from '../src/lib/admin/taxonomy';
import { faqInput, parseFaq } from '../src/lib/admin/seo';
import { uploadImage, editImage } from '../src/lib/admin/images';
import {
  imageStorage,
  normalizeImage,
  readUploadedImage,
} from '../src/lib/storage/images';
import { saveOrderNote, cancelAdminOrder } from '../src/lib/admin/orders';
import { allowLogin } from '../src/lib/admin/login';
import { getProductBySlug } from '../src/lib/catalog/queries';
import { cartTokenHash } from '../src/lib/cart/identity';
if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1'].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  )
)
  throw new Error('Tests réservés à PostgreSQL local de développement.');
const db = getPrisma();
function form(values: Record<string, string | number | boolean>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values))
    if (value !== false) data.set(key, value === true ? 'on' : String(value));
  return data;
}
test('administration : intégrité du catalogue, des stocks, des images et des commandes', async (t) => {
  const key = randomUUID();
  const urls: string[] = [];
  const categories: string[] = [];
  const sets: string[] = [];
  const games: string[] = [];
  const seoProducts: string[] = [];
  const admin = await db.adminUser.create({
    data: { name: 'Test admin', email: `admin-${key}@example.com` },
  });
  const category = await db.category.create({
    data: { name: 'Test admin', slug: `admin-${key}` },
  });
  categories.push(category.id);
  const product = (
    await saveProduct(
      admin.id,
      form({
        name: 'Produit admin de test',
        slug: `admin-${key}`,
        categoryId: category.id,
        productType: 'ETB',
      }),
    )
  ).product;
  let variantId = '';
  let secondId = '';
  let orderId = '';
  let cartId = '';
  let checkoutId = '';
  let initialImage = '';
  const variantForm = (extra: Record<string, string | number | boolean> = {}) =>
    form({
      productId: product.id,
      sku: `ADM-${key}`,
      language: 'FR',
      condition: 'NEW',
      price: '59,90',
      stockQuantity: 5,
      lowStockThreshold: 2,
      isActive: true,
      isDefault: true,
      ...extra,
    });
  try {
    await t.test(
      'scrypt : mot de passe correct / incorrect, jamais de clair',
      async () => {
        const password = `password-${randomUUID()}`;
        const hash = await hashPassword(password);
        assert.notEqual(hash, password);
        assert.equal(await verifyPassword({ hash, password }), true);
        assert.equal(
          await verifyPassword({ hash, password: 'incorrect' }),
          false,
        );
      },
    );
    await t.test(
      'brouillon invisible, publication sans variante refusée',
      async () => {
        assert.equal(product.status, 'DRAFT');
        assert.equal(await getProductBySlug(product.slug), null);
        await assert.rejects(
          changePublication(
            admin.id,
            form({ id: product.id, status: 'ACTIVE' }),
          ),
          /variante active/,
        );
      },
    );
    await t.test(
      'création variante, Decimal, stock initial audité',
      async () => {
        const variant = await saveVariant(admin.id, variantForm());
        variantId = variant.id;
        const current = await db.productVariant.findUniqueOrThrow({
          where: { id: variantId },
        });
        assert.equal(current.price.toFixed(2), '59.90');
        assert.equal(current.stockQuantity, 5);
        assert.equal(
          await db.inventoryAdjustment.count({ where: { variantId } }),
          1,
        );
        await assert.rejects(
          saveVariant(
            admin.id,
            variantForm({ sku: `bad-${key}`, price: '1.234' }),
          ),
          /Montant/,
        );
        await assert.rejects(
          saveVariant(
            admin.id,
            variantForm({ sku: `bad-${key}`, compareAtPrice: '12' }),
          ),
          /ancien prix/,
        );
      },
    );
    await t.test(
      'images : upload réel, principale unique, validation du contenu',
      async () => {
        const png = await sharp({
          create: { width: 20, height: 20, channels: 3, background: '#003c2d' },
        })
          .png()
          .toBuffer();
        for (let index = 0; index < 2; index++) {
          const data = form({ productId: product.id, alt: `Test ${index}` });
          data.set(
            'file',
            new File([new Uint8Array(png)], 'test.png', { type: 'image/png' }),
          );
          const image = await uploadImage(admin.id, data);
          urls.push(image.url);
          if (!index) initialImage = image.id;
          if (index)
            await editImage(
              admin.id,
              form({
                id: image.id,
                productId: product.id,
                alt: 'Image principale B',
                sortOrder: 0,
                isPrimary: true,
              }),
            );
        }
        assert.equal(
          await db.productImage.count({
            where: { productId: product.id, isPrimary: true },
          }),
          1,
        );
        const primary = await db.productImage.findFirstOrThrow({
          where: { productId: product.id, isPrimary: true },
        });
        await editImage(
          admin.id,
          form({
            id: primary.id,
            productId: product.id,
            alt: 'Principale conservée',
            sortOrder: 0,
          }),
        );
        assert.equal(
          await db.productImage.count({
            where: { productId: product.id, isPrimary: true },
          }),
          1,
        );
        assert.ok(await readUploadedImage(urls[0]!.split('/').pop()!));
        await assert.rejects(
          normalizeImage(
            new File(['<svg><script/></svg>'], 'test.png', {
              type: 'image/png',
            }),
          ),
          /image valide/,
        );
        await assert.rejects(
          normalizeImage(
            new File([new Uint8Array(png)], 'test.svg', {
              type: 'image/svg+xml',
            }),
          ),
          /Formats/,
        );
        await assert.rejects(
          normalizeImage(
            new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.png', {
              type: 'image/png',
            }),
          ),
          /5 Mo/,
        );
        assert.equal(await readUploadedImage('../.env'), null);
      },
    );
    await t.test(
      'publication, prix actuel et coût absent de la boutique',
      async () => {
        await changePublication(
          admin.id,
          form({ id: product.id, status: 'ACTIVE' }),
        );
        assert.ok(await getProductBySlug(product.slug));
        const current = await db.productVariant.findUniqueOrThrow({
          where: { id: variantId },
        });
        const data = variantForm({
          id: variantId,
          version: current.updatedAt.toISOString(),
          price: '64,90',
          costPrice: '12.34',
        });
        data.delete('stockQuantity');
        await saveVariant(admin.id, data);
        const view = await getProductBySlug(product.slug);
        assert.ok(view);
        assert.ok(JSON.stringify(view).includes('64.90'));
        assert.ok(!JSON.stringify(view).includes('costPrice'));
        assert.equal(
          await db.adminAuditLog.count({
            where: {
              adminUserId: admin.id,
              entityId: variantId,
              action: 'VARIANT_UPDATED',
            },
          }),
          1,
        );
      },
    );
    await t.test('une seule variante par défaut et SKU unique', async () => {
      const variant = await saveVariant(
        admin.id,
        variantForm({ sku: `EN-${key}`, language: 'EN', isDefault: true }),
      );
      secondId = variant.id;
      assert.equal(
        await db.productVariant.count({
          where: { productId: product.id, isDefault: true },
        }),
        1,
      );
      assert.equal(
        (await db.productVariant.findUniqueOrThrow({ where: { id: secondId } }))
          .isDefault,
        true,
      );
      await assert.rejects(saveVariant(admin.id, variantForm()));
    });
    await t.test(
      'réapprovisionnement 5 + 10 = 15 puis dommage −2 = 13',
      async () => {
        await adjustStock(
          admin.id,
          form({
            variantId: secondId,
            mode: 'delta',
            quantity: 10,
            type: 'RESTOCK',
            reason: 'Réception test',
          }),
        );
        let row = await db.productVariant.findUniqueOrThrow({
          where: { id: secondId },
        });
        assert.equal(row.stockQuantity, 15);
        await adjustStock(
          admin.id,
          form({
            variantId: secondId,
            mode: 'delta',
            quantity: -2,
            type: 'DAMAGE',
            reason: 'Deux emballages abîmés',
          }),
        );
        row = await db.productVariant.findUniqueOrThrow({
          where: { id: secondId },
        });
        assert.equal(row.stockQuantity, 13);
        const change = await db.inventoryAdjustment.findFirstOrThrow({
          where: { variantId: secondId, type: 'DAMAGE' },
        });
        assert.equal(change.previousQuantity, 15);
        assert.equal(change.quantityDelta, -2);
        assert.equal(change.newQuantity, 13);
      },
    );
    await t.test(
      'commande snapshot et réservations : stock 5 réservé 3, refuse 2 accepte 4',
      async () => {
        const cart = await db.cart.create({
          data: {
            tokenHash: cartTokenHash(
              randomUUID().replaceAll('-', '').repeat(2),
            )!,
            expiresAt: new Date(Date.now() + 86400000),
          },
        });
        cartId = cart.id;
        const checkout = await db.checkoutSession.create({
          data: { cartId, expiresAt: new Date(Date.now() + 86400000) },
        });
        checkoutId = checkout.id;
        const order = await db.order.create({
          data: {
            checkoutSessionId: checkoutId,
            publicId: randomUUID().replaceAll('-', '').repeat(2),
            orderNumber: `ADM-${key}`,
            email: 'snapshot@example.com',
            currency: 'EUR',
            subtotalAmount: '194.70',
            shippingAmount: '0',
            totalAmount: '194.70',
            shippingMethodCode: 'TEST',
            shippingMethodName: 'Test',
            items: {
              create: {
                productId: product.id,
                variantId,
                productName: 'Nom snapshot',
                productSlug: product.slug,
                sku: `ADM-${key}`,
                language: 'FR',
                unitPrice: '64.90',
                quantity: 3,
                lineTotal: '194.70',
                imageUrl: urls[0]!,
              },
            },
            payment: { create: { amount: '194.70', currency: 'EUR' } },
            reservations: {
              create: {
                variantId,
                quantity: 3,
                expiresAt: new Date(Date.now() + 1200000),
              },
            },
          },
        });
        orderId = order.id;
        await db.productVariant.update({
          where: { id: variantId },
          data: { reservedQuantity: 3 },
        });
        await assert.rejects(
          adjustStock(
            admin.id,
            form({
              variantId,
              mode: 'absolute',
              expected: 5,
              quantity: 2,
              type: 'CORRECTION',
              reason: 'Comptage',
            }),
          ),
          /3 unités.*réservées/,
        );
        await adjustStock(
          admin.id,
          form({
            variantId,
            mode: 'absolute',
            expected: 5,
            quantity: 4,
            type: 'CORRECTION',
            reason: 'Comptage',
          }),
        );
        const row = await db.productVariant.findUniqueOrThrow({
          where: { id: variantId },
        });
        assert.equal(row.stockQuantity, 4);
        assert.equal(row.reservedQuantity, 3);
        assert.equal(row.availableQuantity, 1);
        await assert.rejects(
          adjustStock(
            admin.id,
            form({
              variantId,
              mode: 'absolute',
              expected: 5,
              quantity: 6,
              type: 'CORRECTION',
              reason: 'Ancien formulaire',
            }),
          ),
          /stock a changé/,
        );
      },
    );
    await t.test(
      'champs forgés stock et paiement rejetés sans mutation',
      async () => {
        await assert.rejects(
          adjustStock(
            admin.id,
            form({
              variantId,
              mode: 'delta',
              quantity: 1,
              type: 'RESTOCK',
              reason: 'Test',
              reservedQuantity: 0,
            }),
          ),
          /non autorisé/,
        );
        await assert.rejects(
          saveOrderNote(
            admin.id,
            form({
              id: orderId,
              status: 'PAID',
              totalAmount: 1,
              internalNote: 'test',
            }),
          ),
          /non autorisé/,
        );
        assert.equal(
          (await db.order.findUniqueOrThrow({ where: { id: orderId } })).status,
          'PENDING_PAYMENT',
        );
      },
    );
    await t.test(
      'annulation utilise le service existant et libère les réservations',
      async () => {
        await cancelAdminOrder(admin.id, form({ id: orderId }));
        assert.equal(
          (await db.order.findUniqueOrThrow({ where: { id: orderId } })).status,
          'CANCELLED',
        );
        assert.equal(
          (
            await db.productVariant.findUniqueOrThrow({
              where: { id: variantId },
            })
          ).reservedQuantity,
          0,
        );
        await db.order.update({
          where: { id: orderId },
          data: { status: 'PAID' },
        });
        await assert.rejects(
          cancelAdminOrder(admin.id, form({ id: orderId })),
          /ne peut pas être annulée/,
        );
      },
    );
    await t.test(
      'archivage / retrait image conserve les snapshots',
      async () => {
        await editImage(
          admin.id,
          form({ id: initialImage, productId: product.id }),
          true,
        );
        assert.ok(await readUploadedImage(urls[0]!.split('/').pop()!));
        await changePublication(
          admin.id,
          form({ id: product.id, status: 'ARCHIVED' }),
        );
        assert.equal(await getProductBySlug(product.slug), null);
        const item = await db.orderItem.findFirstOrThrow({
          where: { orderId },
        });
        assert.equal(item.productName, 'Nom snapshot');
        assert.equal(item.unitPrice.toFixed(2), '64.90');
        assert.equal(item.imageUrl, urls[0]);
      },
    );
    await t.test(
      'cycles de catégories refusés, y compris modifications concurrentes',
      async () => {
        const a = await saveCategory(
          admin.id,
          form({ name: 'A', slug: `a-${key}`, sortOrder: 0, isActive: true }),
        );
        categories.push(a.id);
        const b = await saveCategory(
          admin.id,
          form({
            name: 'B',
            slug: `b-${key}`,
            parentId: a.id,
            sortOrder: 0,
            isActive: true,
          }),
        );
        categories.push(b.id);
        await assert.rejects(
          saveCategory(
            admin.id,
            form({
              id: a.id,
              name: a.name,
              slug: a.slug,
              parentId: b.id,
              sortOrder: 0,
              isActive: true,
            }),
          ),
          /cycle/,
        );
        await assert.rejects(
          saveCategory(
            admin.id,
            form({
              id: a.id,
              name: a.name,
              slug: a.slug,
              parentId: a.id,
              sortOrder: 0,
              isActive: true,
            }),
          ),
          /cycle/,
        );
        await saveCategory(
          admin.id,
          form({
            id: b.id,
            name: b.name,
            slug: b.slug,
            sortOrder: 0,
            isActive: true,
          }),
        );
        const results = await Promise.allSettled([
          saveCategory(
            admin.id,
            form({
              id: a.id,
              name: a.name,
              slug: a.slug,
              parentId: b.id,
              sortOrder: 0,
              isActive: true,
            }),
          ),
          saveCategory(
            admin.id,
            form({
              id: b.id,
              name: b.name,
              slug: b.slug,
              parentId: a.id,
              sortOrder: 0,
              isActive: true,
            }),
          ),
        ]);
        assert.ok(results.some((result) => result.status === 'rejected'));
      },
    );
    await t.test(
      'extensions locales, scripts / URL distantes refusés',
      async () => {
        await assert.rejects(
          saveSet(
            admin.id,
            form({
              name: 'Set',
              slug: `set-${key}`,
              logoUrl: 'javascript:alert(1)',
              isActive: true,
            }),
          ),
          /image locale/,
        );
        const set = await saveSet(
          admin.id,
          form({ name: 'Set', slug: `set-${key}`, isActive: true }),
        );
        sets.push(set.id);
      },
    );
    await t.test(
      'jeux : slug réservé, unicité, FAQ validée et redirection du slug',
      async () => {
        const gameForm = (
          extra: Record<string, string | number | boolean> = {},
        ) =>
          form({
            name: 'Jeu test',
            slug: `jeu-${key}`,
            sortOrder: 0,
            isActive: true,
            ...extra,
          });
        for (const reserved of ['catalogue', 'guides', 'en-stock', 'admin'])
          await assert.rejects(
            saveGame(admin.id, gameForm({ slug: reserved })),
            /réservé à une page du site/,
          );
        await assert.rejects(
          saveGame(admin.id, gameForm({ slug: 'x'.repeat(101) })),
          /maximum 100/,
        );
        await assert.rejects(
          saveGame(admin.id, gameForm({ faq: 'Question sans réponse' })),
          /FAQ, ligne 1/,
        );
        await assert.rejects(
          saveGame(admin.id, gameForm({ faq: 'A ? :: Oui.\na ? :: Non.' })),
          /FAQ, ligne 2 : cette question est déjà posée/,
        );
        await assert.rejects(
          saveGame(admin.id, gameForm({ seoTitle: 'x'.repeat(71) })),
          /Titre SEO : 70 caractères maximum/,
        );
        await assert.rejects(
          saveGame(
            admin.id,
            gameForm({ seoTitle: 'Boosters Jeu test | Caldera' }),
          ),
          /n’ajoutez pas « Caldera »/,
        );
        await assert.rejects(
          saveGame(admin.id, gameForm({ seoDescription: 'x'.repeat(171) })),
          /Meta description : 170 caractères maximum/,
        );
        await assert.rejects(
          saveGame(admin.id, gameForm({ unknown: 'forgé' })),
          /non autorisé/,
        );
        assert.deepEqual(parseFaq('\n  \nQ ? :: R :: suite\n'), [
          { question: 'Q ?', answer: 'R :: suite' },
        ]);
        const { game } = await saveGame(
          admin.id,
          gameForm({
            intro: '## Le jeu\n\nTexte **éditorial**.',
            seoTitle: 'Jeu test : boosters et coffrets',
            faq: 'Quand ? :: Demain.\n\nOù ? :: Ici :: là.',
          }),
        );
        games.push(game.id);
        assert.equal(game.intro, '## Le jeu\n\nTexte **éditorial**.');
        assert.deepEqual(game.faq, [
          { question: 'Quand ?', answer: 'Demain.' },
          { question: 'Où ?', answer: 'Ici :: là.' },
        ]);
        assert.equal(
          faqInput(game.faq),
          'Quand ? :: Demain.\nOù ? :: Ici :: là.',
        );
        assert.equal(
          faqInput([{ question: 'A::B ?', answer: 'Ligne 1\nLigne 2' }]),
          'A:B ? :: Ligne 1 Ligne 2',
        );
        await assert.rejects(
          saveGame(admin.id, gameForm({ name: 'Doublon' })),
          /déjà utilisé par le jeu « Jeu test »/,
        );
        const renamed = await saveGame(
          admin.id,
          gameForm({ id: game.id, slug: `jeu-renomme-${key}` }),
        );
        assert.equal(renamed.previousSlug, `jeu-${key}`);
        assert.equal(renamed.game.faq, null);
        assert.equal(
          (
            await db.slugRedirect.findUniqueOrThrow({
              where: {
                entityType_fromSlug: {
                  entityType: 'GAME',
                  fromSlug: `jeu-${key}`,
                },
              },
            })
          ).entityId,
          game.id,
        );
        // Back to the first slug: the live slug never keeps a redirect.
        await saveGame(admin.id, gameForm({ id: game.id }));
        assert.deepEqual(
          (
            await db.slugRedirect.findMany({
              where: { entityId: game.id },
              select: { entityType: true, fromSlug: true },
            })
          ).map((row) => `${row.entityType}:${row.fromSlug}`),
          [`GAME:jeu-renomme-${key}`],
        );
        assert.equal(
          await db.adminAuditLog.count({
            where: { entityId: game.id, action: 'GAME_SAVED' },
          }),
          3,
        );
      },
    );
    await t.test(
      'extensions et catégories : filtres réservés, collisions et redirections',
      async () => {
        await assert.rejects(
          saveSet(
            admin.id,
            form({ name: 'Set', slug: 'japonais', isActive: true }),
          ),
          /réservé aux filtres de langue et de disponibilité/,
        );
        await assert.rejects(
          saveCategory(
            admin.id,
            form({
              name: 'Cat',
              slug: 'en-stock',
              sortOrder: 0,
              isActive: true,
            }),
          ),
          /réservé aux filtres de langue et de disponibilité/,
        );
        await assert.rejects(
          saveSet(
            admin.id,
            form({ name: 'Set', slug: category.slug, isActive: true }),
          ),
          /déjà utilisé par la catégorie « Test admin ». Une extension et une catégorie ne peuvent pas partager une adresse/,
        );
        await assert.rejects(
          saveCategory(
            admin.id,
            form({
              name: 'Cat',
              slug: `set-${key}`,
              sortOrder: 0,
              isActive: true,
            }),
          ),
          /déjà utilisé par l’extension « Set ». Une extension et une catégorie ne peuvent pas partager une adresse/,
        );
        await assert.rejects(
          saveSet(
            admin.id,
            form({ name: 'Set bis', slug: `set-${key}`, isActive: true }),
          ),
          /déjà utilisé par l’extension « Set »\.$/,
        );
        await assert.rejects(
          saveSet(
            admin.id,
            form({
              name: 'Set',
              slug: `set-bis-${key}`,
              gameId: randomUUID(),
              isActive: true,
            }),
          ),
          /Jeu introuvable/,
        );
        await saveSet(
          admin.id,
          form({
            id: sets[0]!,
            name: 'Set',
            slug: `set-renomme-${key}`,
            seoDescription: 'Extension de test.',
            faq: 'Date ? :: Aucune.',
            isActive: true,
          }),
        );
        const set = await db.tcgSet.findUniqueOrThrow({
          where: { id: sets[0]! },
        });
        assert.equal(set.seoDescription, 'Extension de test.');
        assert.deepEqual(set.faq, [{ question: 'Date ?', answer: 'Aucune.' }]);
        assert.equal(
          (
            await db.slugRedirect.findUniqueOrThrow({
              where: {
                entityType_fromSlug: {
                  entityType: 'SET',
                  fromSlug: `set-${key}`,
                },
              },
            })
          ).entityId,
          sets[0],
        );
        await saveCategory(
          admin.id,
          form({
            id: category.id,
            name: category.name,
            slug: `admin-renomme-${key}`,
            intro: 'Famille de test.',
            imageUrl: '/assets/images/products/prismatic.png',
            sortOrder: 0,
            isActive: true,
          }),
        );
        const renamed = await db.category.findUniqueOrThrow({
          where: { id: category.id },
        });
        assert.equal(renamed.intro, 'Famille de test.');
        assert.equal(renamed.imageUrl, '/assets/images/products/prismatic.png');
        assert.equal(
          (
            await db.slugRedirect.findUniqueOrThrow({
              where: {
                entityType_fromSlug: {
                  entityType: 'CATEGORY',
                  fromSlug: category.slug,
                },
              },
            })
          ).entityId,
          category.id,
        );
        // The old slug is free again: a set may take it, its redirect stays scoped to categories.
        const reuse = await saveSet(
          admin.id,
          form({ name: 'Set réutilisé', slug: category.slug, isActive: true }),
        );
        sets.push(reuse.id);
      },
    );
    await t.test(
      'produits : jeu imposé par l’extension, incohérence refusée, slug redirigé',
      async () => {
        const [gameId] = games;
        const other = (
          await saveGame(
            admin.id,
            form({
              name: 'Autre jeu',
              slug: `autre-jeu-${key}`,
              sortOrder: 1,
              isActive: true,
            }),
          )
        ).game;
        games.push(other.id);
        const gameSet = await saveSet(
          admin.id,
          form({
            name: 'Set du jeu',
            slug: `set-jeu-${key}`,
            gameId: gameId!,
            isActive: true,
          }),
        );
        sets.push(gameSet.id);
        const base = {
          name: 'Booster du jeu',
          slug: `booster-jeu-${key}`,
          categoryId: category.id,
          productType: 'BOOSTER',
          tcgSetId: gameSet.id,
        };
        const created = (await saveProduct(admin.id, form(base))).product;
        seoProducts.push(created.id);
        assert.equal(created.gameId, gameId);
        await assert.rejects(
          saveProduct(
            admin.id,
            form({ ...base, slug: `booster-bis-${key}`, gameId: other.id }),
          ),
          /L’extension « Set du jeu » appartient au jeu « Jeu test » : le produit doit être rattaché à ce jeu/,
        );
        await assert.rejects(
          saveProduct(
            admin.id,
            form({
              ...base,
              slug: `booster-ter-${key}`,
              tcgSetId: '',
              gameId: randomUUID(),
            }),
          ),
          /Jeu introuvable/,
        );
        const loose = (
          await saveProduct(
            admin.id,
            form({
              name: 'Accessoire du jeu',
              slug: `accessoire-${key}`,
              categoryId: category.id,
              productType: 'ACCESSORY',
              gameId: other.id,
            }),
          )
        ).product;
        seoProducts.push(loose.id);
        assert.equal(loose.gameId, other.id);
        const current = await db.product.findUniqueOrThrow({
          where: { id: created.id },
        });
        const renamed = await saveProduct(
          admin.id,
          form({
            ...base,
            id: created.id,
            version: current.updatedAt.toISOString(),
            slug: `booster-renomme-${key}`,
            gameId: gameId!,
            seoTitle: 'Booster du jeu – Set du jeu',
            seoDescription: 'Booster de test.',
          }),
        );
        assert.equal(renamed.previousSlug, `booster-jeu-${key}`);
        assert.equal(renamed.product.seoTitle, 'Booster du jeu – Set du jeu');
        assert.equal(renamed.product.seoDescription, 'Booster de test.');
        assert.equal(
          (
            await db.slugRedirect.findUniqueOrThrow({
              where: {
                entityType_fromSlug: {
                  entityType: 'PRODUCT',
                  fromSlug: `booster-jeu-${key}`,
                },
              },
            })
          ).entityId,
          created.id,
        );
        await saveSet(
          admin.id,
          form({
            id: gameSet.id,
            name: 'Set du jeu',
            slug: `set-jeu-${key}`,
            gameId: other.id,
            isActive: true,
          }),
        );
        assert.equal(
          (await db.product.findUniqueOrThrow({ where: { id: created.id } }))
            .gameId,
          other.id,
        );
        await db.productVariant.create({
          data: { productId: loose.id, sku: `ACC-${key}`, price: '9.90' },
        });
        await saveGame(
          admin.id,
          form({
            id: other.id,
            name: other.name,
            slug: other.slug,
            sortOrder: 1,
          }),
        );
        await assert.rejects(
          changePublication(admin.id, form({ id: loose.id, status: 'ACTIVE' })),
          /le jeu doivent être actifs/,
        );
      },
    );
    await t.test(
      'ajustements concurrents atomiques et désactivation sans perte des snapshots',
      async () => {
        const before = await db.productVariant.findUniqueOrThrow({
          where: { id: secondId },
        });
        await Promise.all(
          [1, 2].map((quantity) =>
            adjustStock(
              admin.id,
              form({
                variantId: secondId,
                mode: 'delta',
                quantity,
                type: 'RESTOCK',
                reason: 'Réception concurrente',
              }),
            ),
          ),
        );
        assert.equal(
          (
            await db.productVariant.findUniqueOrThrow({
              where: { id: secondId },
            })
          ).stockQuantity,
          before.stockQuantity + 3,
        );
        const current = await db.productVariant.findUniqueOrThrow({
          where: { id: variantId },
        });
        const data = variantForm({
          id: variantId,
          version: current.updatedAt.toISOString(),
          price: current.price.toFixed(2),
          isActive: false,
        });
        data.delete('stockQuantity');
        await saveVariant(admin.id, data);
        assert.equal(
          (
            await db.productVariant.findUniqueOrThrow({
              where: { id: variantId },
            })
          ).isActive,
          false,
        );
        assert.equal(
          (
            await db.orderItem.findFirstOrThrow({ where: { orderId } })
          ).unitPrice.toFixed(2),
          '64.90',
        );
      },
    );
    await t.test(
      'admin inactif interdit et limitation persistante des connexions',
      async () => {
        await db.adminUser.update({
          where: { id: admin.id },
          data: { isActive: false },
        });
        await assert.rejects(
          adjustStock(
            admin.id,
            form({
              variantId,
              mode: 'delta',
              quantity: 1,
              type: 'RESTOCK',
              reason: 'Refus attendu',
            }),
          ),
          /administrateur invalide/,
        );
        for (let index = 0; index < 5; index++)
          assert.equal(await allowLogin(admin.email), true);
        assert.equal(await allowLogin(admin.email), false);
      },
    );
  } finally {
    if (orderId) {
      await db.stockReservation.deleteMany({ where: { orderId } });
      await db.orderItem.deleteMany({ where: { orderId } });
      await db.payment.deleteMany({ where: { orderId } });
      await db.order.delete({ where: { id: orderId } });
    }
    if (checkoutId)
      await db.checkoutSession.delete({ where: { id: checkoutId } });
    if (cartId) await db.cart.delete({ where: { id: cartId } });
    await db.inventoryAdjustment.deleteMany({
      where: { adminUserId: admin.id },
    });
    await db.adminAuditLog.deleteMany({ where: { adminUserId: admin.id } });
    await db.productVariant.deleteMany({ where: { productId: product.id } });
    await db.product.delete({ where: { id: product.id } });
    await db.productVariant.deleteMany({
      where: { productId: { in: seoProducts } },
    });
    await db.product.deleteMany({ where: { id: { in: seoProducts } } });
    await db.slugRedirect.deleteMany({
      where: {
        entityId: {
          in: [product.id, ...seoProducts, ...categories, ...sets, ...games],
        },
      },
    });
    await db.category.updateMany({
      where: { id: { in: categories } },
      data: { parentId: null },
    });
    await db.category.deleteMany({ where: { id: { in: categories } } });
    await db.tcgSet.deleteMany({ where: { id: { in: sets } } });
    await db.game.deleteMany({ where: { id: { in: games } } });
    await db.adminUser.delete({ where: { id: admin.id } });
    for (const url of urls) await imageStorage.delete(url);
    await db.$disconnect();
  }
});
