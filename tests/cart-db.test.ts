import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { getPrisma } from '../src/lib/db/prisma';
import { mutateCart } from '../src/lib/cart/service';
import { getCartByToken } from '../src/lib/cart/queries';
import { cartTokenHash } from '../src/lib/cart/identity';
import { CartError, validateCart } from '../src/lib/cart/validation';

if (process.env.NODE_ENV === 'production')
  throw new Error('Tests réservés au développement.');
const db = getPrisma();
test('panier invité PostgreSQL : persistance, validation et isolation', async (t) => {
  const key = randomUUID();
  const tokens = new Set<string>();
  const category = await db.category.create({
    data: { name: 'Test panier', slug: `test-cart-${key}` },
  });
  const product = await db.product.create({
    data: {
      name: 'Test panier',
      slug: `test-cart-${key}`,
      categoryId: category.id,
      status: 'ACTIVE',
      productType: 'ETB',
      variants: {
        create: [
          {
            sku: `TEST-CART-FR-${key}`,
            price: '59.90',
            stockQuantity: 5,
            isDefault: true,
          },
          {
            sku: `TEST-CART-EN-${key}`,
            price: '54.90',
            stockQuantity: 2,
            language: 'EN',
          },
          {
            sku: `TEST-CART-JP-${key}`,
            price: '0.10',
            stockQuantity: 10,
            language: 'JP',
          },
        ],
      },
    },
    include: { variants: true },
  });
  const fr = product.variants.find((v) => v.language === 'FR')!;
  const en = product.variants.find((v) => v.language === 'EN')!;
  const jp = product.variants.find((v) => v.language === 'JP')!;
  async function add(
    token: string | undefined,
    variantId = fr.id,
    quantity = 1,
  ) {
    const result = await mutateCart(token, {
      kind: 'add',
      variantId,
      quantity,
    });
    tokens.add(result);
    return result;
  }
  async function record(token: string) {
    return db.cart.findUniqueOrThrow({
      where: { tokenHash: cartTokenHash(token)! },
    });
  }
  let token = '';
  try {
    await t.test(
      'lecture sans cookie ou invalide : vide, aucune création',
      async () => {
        const before = await db.cart.count();
        for (const input of [
          undefined,
          '',
          'invalid',
          randomUUID(),
          'a'.repeat(64),
        ])
          assert.equal((await getCartByToken(input)).itemCount, 0);
        assert.equal(await db.cart.count(), before);
      },
    );
    await t.test(
      'quantités et ids non fiables rejetés, aucun panier orphelin',
      async () => {
        const before = await db.cart.count();
        for (const quantity of [
          -1,
          0,
          1.5,
          'bonjour',
          999999,
          null,
          NaN,
          Infinity,
        ])
          await assert.rejects(
            mutateCart(undefined, { kind: 'add', variantId: fr.id, quantity }),
            CartError,
          );
        for (const variantId of [null, {}, 'invalid', randomUUID()])
          await assert.rejects(
            mutateCart(undefined, { kind: 'add', variantId, quantity: 1 }),
            CartError,
          );
        assert.equal(await db.cart.count(), before);
      },
    );
    await t.test(
      'ajout x1 puis x2 : une ligne, prix Decimal, stock inchangé',
      async () => {
        token = await add(undefined);
        await add(token, fr.id, 2);
        const cart = await getCartByToken(token);
        assert.equal(cart.items.length, 1);
        assert.equal(cart.itemCount, 3);
        assert.equal(cart.subtotal, '179.70');
        assert.equal(cart.items[0]?.price, '59.90');
        assert.equal(
          (await db.productVariant.findUniqueOrThrow({ where: { id: fr.id } }))
            .stockQuantity,
          5,
        );
        assert.equal((await record(token)).tokenHash, cartTokenHash(token));
        assert.ok(!JSON.stringify(cart).match(/tokenHash|costPrice|expiresAt/));
        assert.deepEqual(await getCartByToken(token), cart);
      },
    );
    await t.test('stock 5 : cumul 3+2 accepté, +1 refusé', async () => {
      await add(token, fr.id, 2);
      await assert.rejects(add(token), CartError);
      assert.equal((await getCartByToken(token)).itemCount, 5);
    });
    await t.test(
      'variantes FR et EN distinctes et langue lisible disponible',
      async () => {
        await add(token, en.id, 2);
        const cart = await getCartByToken(token);
        assert.equal(cart.items.length, 2);
        assert.equal(cart.itemCount, 7);
        assert.equal(cart.subtotal, '409.30');
        assert.ok(cart.items.some((item) => item.language === 'EN'));
      },
    );
    await t.test(
      'appartenance : update et delete d’un autre panier rejetés',
      async () => {
        const other = await add(undefined, jp.id);
        const id = (await getCartByToken(token)).items[0]!.id;
        await assert.rejects(
          mutateCart(other, { kind: 'update', itemId: id, quantity: 1 }),
          CartError,
        );
        await assert.rejects(
          mutateCart(other, { kind: 'remove', itemId: id }),
          CartError,
        );
        assert.equal((await getCartByToken(token)).itemCount, 7);
      },
    );
    await t.test(
      'stock réduit : ligne conservée, ajustement explicite',
      async () => {
        await db.productVariant.update({
          where: { id: fr.id },
          data: { stockQuantity: 2 },
        });
        const cart = await getCartByToken(token),
          item = cart.items.find((i) => i.variantId === fr.id)!;
        assert.equal(item.quantity, 5);
        assert.equal(item.issue, 'INSUFFICIENT_STOCK');
        assert.equal(cart.hasUnavailableItems, true);
        await mutateCart(token, {
          kind: 'update',
          itemId: item.id,
          quantity: 2,
        });
        assert.equal((await getCartByToken(token)).hasUnavailableItems, false);
      },
    );
    await t.test(
      'prix actualisé et rupture sans effacement silencieux',
      async () => {
        await db.productVariant.update({
          where: { id: fr.id },
          data: { price: '54.90', stockQuantity: 0 },
        });
        const cart = await getCartByToken(token),
          item = cart.items.find((i) => i.variantId === fr.id)!;
        assert.equal(item.price, '54.90');
        assert.equal(item.lineTotal, '109.80');
        assert.equal(cart.subtotal, '219.60');
        assert.equal(item.issue, 'OUT_OF_STOCK');
        assert.equal(item.quantity, 2);
        await assert.rejects(
          mutateCart(token, { kind: 'update', itemId: item.id, quantity: 1 }),
          CartError,
        );
        await db.productVariant.update({
          where: { id: fr.id },
          data: { stockQuantity: 5 },
        });
      },
    );
    await t.test(
      'variante inactive, produit archivé, catégorie masquée',
      async () => {
        await db.productVariant.update({
          where: { id: fr.id },
          data: { isActive: false },
        });
        assert.equal(
          (await getCartByToken(token)).items.find((i) => i.variantId === fr.id)
            ?.issue,
          'UNAVAILABLE',
        );
        await assert.rejects(add(token), CartError);
        await db.productVariant.update({
          where: { id: fr.id },
          data: { isActive: true },
        });
        await db.product.update({
          where: { id: product.id },
          data: { status: 'ARCHIVED' },
        });
        assert.ok(
          (await getCartByToken(token)).items.every(
            (i) => i.issue === 'UNAVAILABLE',
          ),
        );
        await assert.rejects(add(token), CartError);
        await db.product.update({
          where: { id: product.id },
          data: { status: 'ACTIVE' },
        });
        await db.category.update({
          where: { id: category.id },
          data: { isActive: false },
        });
        await assert.rejects(add(token), CartError);
        await db.category.update({
          where: { id: category.id },
          data: { isActive: true },
        });
      },
    );
    await t.test('précommande : quota respecté, libellé préservé', async () => {
      await db.product.update({
        where: { id: product.id },
        data: { preorder: true },
      });
      const preorder = await add(undefined, en.id, 2);
      assert.equal((await getCartByToken(preorder)).items[0]?.preorder, true);
      await assert.rejects(add(preorder, en.id), CartError);
      await db.productVariant.update({
        where: { id: en.id },
        data: { stockQuantity: 0 },
      });
      await assert.rejects(add(undefined, en.id), CartError);
      await db.productVariant.update({
        where: { id: en.id },
        data: { stockQuantity: 2 },
      });
      await db.product.update({
        where: { id: product.id },
        data: { preorder: false },
      });
    });
    await t.test(
      'concurrence : pas de doublon ou de dépassement du stock',
      async () => {
        const concurrent = await add(undefined);
        const results = await Promise.allSettled(
          Array.from({ length: 6 }, () => add(concurrent)),
        );
        const cart = await getCartByToken(concurrent);
        assert.equal(cart.items.length, 1);
        assert.ok(cart.itemCount <= 5);
        assert.equal(
          cart.itemCount,
          1 + results.filter((r) => r.status === 'fulfilled').length,
        );
        assert.ok(results.some((r) => r.status === 'rejected'));
      },
    );
    await t.test(
      'expiration et conversion : aucune mutation de l’ancien panier',
      async () => {
        for (const status of ['ACTIVE', 'CONVERTED'] as const) {
          const old = await add(undefined, jp.id);
          const row = await record(old);
          await db.cart.update({
            where: { id: row.id },
            data: status === 'ACTIVE' ? { expiresAt: new Date(0) } : { status },
          });
          assert.equal((await getCartByToken(old)).itemCount, 0);
          await assert.rejects(mutateCart(old, { kind: 'clear' }), CartError);
          const replacement = await add(old, jp.id);
          assert.notEqual(replacement, old);
          assert.equal(
            (await record(old)).status,
            status === 'ACTIVE' ? 'ABANDONED' : 'CONVERTED',
          );
        }
      },
    );
    await t.test(
      'renouvellement à 30 jours, retrait puis panier vide',
      async () => {
        const row = await record(token);
        await db.cart.update({
          where: { id: row.id },
          data: { expiresAt: new Date(Date.now() + 60000) },
        });
        const item = (await getCartByToken(token)).items[0]!;
        await mutateCart(token, { kind: 'remove', itemId: item.id });
        assert.ok(
          (await record(token)).expiresAt.getTime() >
            Date.now() + 29 * 86400000,
        );
        assert.equal((await getCartByToken(token)).items.length, 1);
        const last = (await getCartByToken(token)).items[0]!;
        await mutateCart(token, { kind: 'remove', itemId: last.id });
        assert.equal((await getCartByToken(token)).itemCount, 0);
      },
    );
    await t.test('trois références, clear et précision décimale', async () => {
      await add(token);
      await add(token, en.id);
      await add(token, jp.id, 3);
      const cart = await getCartByToken(token);
      assert.equal(cart.items.length, 3);
      assert.equal(
        cart.items.find((i) => i.variantId === jp.id)?.lineTotal,
        '0.30',
      );
      await mutateCart(token, { kind: 'clear' });
      assert.equal((await getCartByToken(token)).subtotal, '0.00');
      assert.equal((await record(token)).status, 'ACTIVE');
    });
    await t.test(
      'contraintes SQL : quantité, unicité, Restrict et Cascade',
      async () => {
        const guarded = await add(undefined),
          row = await record(guarded);
        await assert.rejects(
          db.productVariant.delete({ where: { id: fr.id } }),
        );
        await assert.rejects(
          db.cartItem.create({
            data: { cartId: row.id, variantId: fr.id, quantity: 1 },
          }),
        );
        await assert.rejects(
          db.cartItem.create({
            data: { cartId: row.id, variantId: jp.id, quantity: 0 },
          }),
        );
        await db.cart.delete({ where: { id: row.id } });
        assert.equal(await db.cartItem.count({ where: { cartId: row.id } }), 0);
        const validation = validateCart({
          status: 'ACTIVE',
          expiresAt: new Date(0),
          items: [{ id: randomUUID(), quantity: 1, variant: null }],
        });
        assert.equal(validation.expired, true);
        assert.equal(validation.issues[0]?.issue, 'UNAVAILABLE');
      },
    );
  } finally {
    await db.cart.deleteMany({
      where: {
        tokenHash: { in: [...tokens].map((value) => cartTokenHash(value)!) },
      },
    });
    await db.productVariant.deleteMany({ where: { productId: product.id } });
    await db.product.delete({ where: { id: product.id } });
    await db.category.delete({ where: { id: category.id } });
    await db.$disconnect();
  }
});
