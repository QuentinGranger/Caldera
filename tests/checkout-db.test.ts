import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { getPrisma } from '../src/lib/db/prisma';
import { mutateCart } from '../src/lib/cart/service';
import { cartTokenHash } from '../src/lib/cart/identity';
import { mutateCheckout } from '../src/lib/checkout/service';
import { getCheckoutData } from '../src/lib/checkout/queries';
import {
  getCheckoutSummary,
  validateCheckout,
} from '../src/lib/checkout/validation';
import { CheckoutError } from '../src/lib/checkout/schemas';
import { emptyAddress } from '../src/lib/checkout/types';
if (process.env.NODE_ENV === 'production')
  throw new Error('Tests réservés à la base de développement.');
const db = getPrisma();
test('checkout PostgreSQL : persistance, validation, livraison et revalidation', async (t) => {
  const key = randomUUID(),
    tokens = new Set<string>();
  const existingCodes = (
    await db.shippingCountry.findMany({ select: { code: true } })
  ).map((country) => country.code);
  const codes = ['DE', 'NL', 'IT', 'ES', 'PT', 'AT', 'LU', 'CH']
    .filter((code) => !existingCodes.includes(code))
    .slice(0, 2);
  assert.equal(
    codes.length,
    2,
    'Deux pays de test non configurés sont nécessaires.',
  );
  const country = codes[0]!,
    secondCountry = codes[1]!;
  for (const code of codes)
    await db.shippingCountry.create({ data: { code, name: `Test ${code}` } });
  const standard = await db.shippingMethod.create({
    data: {
      code: `TEST-STANDARD-${key}`,
      name: 'Test standard',
      price: '5.90',
      freeFromAmount: '150.00',
      countries: { connect: codes.map((code) => ({ code })) },
    },
  });
  const express = await db.shippingMethod.create({
    data: {
      code: `TEST-EXPRESS-${key}`,
      name: 'Test express',
      type: 'EXPRESS',
      price: '12.90',
      countries: { connect: { code: country } },
    },
  });
  const category = await db.category.create({
    data: { name: 'Test checkout', slug: `test-checkout-${key}` },
  });
  const product = await db.product.create({
    data: {
      name: 'Test checkout',
      slug: `test-checkout-${key}`,
      categoryId: category.id,
      status: 'ACTIVE',
      productType: 'ETB',
      variants: {
        create: {
          sku: `TEST-CHECKOUT-${key}`,
          price: '59.90',
          stockQuantity: 8,
        },
      },
    },
    include: { variants: true },
  });
  const variantId = product.variants[0]!.id;
  async function newCart() {
    const token = await mutateCart(undefined, {
      kind: 'add',
      variantId,
      quantity: 1,
    });
    tokens.add(token);
    return token;
  }
  let token = '',
    sessionId = '';
  const shipping = {
    ...emptyAddress(),
    firstName: 'Éléonore',
    lastName: 'D’Angelo-Le Roy',
    addressLine1: '12 rue des Terres',
    postalCode: '10115',
    city: 'Ville de test',
    countryCode: country,
  };
  const contact = {
    email: 'checkout@example.com',
    phone: '',
    billingSame: true,
    shipping,
    billing: null,
  };
  async function view() {
    const data = await getCheckoutData(token);
    assert.ok(data);
    return getCheckoutSummary(data);
  }
  async function ready() {
    await mutateCheckout(token, {
      kind: 'shipping',
      sessionId,
      methodId: standard.id,
    });
    await mutateCheckout(token, { kind: 'prepare', sessionId });
  }
  try {
    await t.test(
      'panier absent, vide et rupture bloquent la création',
      async () => {
        assert.equal(await getCheckoutData(undefined), null);
        await assert.rejects(
          mutateCheckout(undefined, { kind: 'start' }),
          CheckoutError,
        );
        const empty = await newCart();
        await mutateCart(empty, { kind: 'clear' });
        await assert.rejects(
          mutateCheckout(empty, { kind: 'start' }),
          CheckoutError,
        );
        token = await newCart();
        await db.productVariant.update({
          where: { id: variantId },
          data: { stockQuantity: 0 },
        });
        await assert.rejects(
          mutateCheckout(token, { kind: 'start' }),
          CheckoutError,
        );
        assert.equal((await getCheckoutData(token))?.session, null);
        await db.productVariant.update({
          where: { id: variantId },
          data: { stockQuantity: 8 },
        });
      },
    );
    await t.test(
      'création et réutilisation atomiques, même après deux départs simultanés',
      async () => {
        await Promise.all([
          mutateCheckout(token, { kind: 'start' }),
          mutateCheckout(token, { kind: 'start' }),
        ]);
        sessionId = (await view()).sessionId!;
        assert.ok(sessionId);
        assert.equal((await view()).requiredStep, 'contact');
        const cart = await db.cart.findUniqueOrThrow({
          where: { tokenHash: cartTokenHash(token)! },
        });
        assert.equal(
          await db.checkoutSession.count({ where: { cartId: cart.id } }),
          1,
        );
        await assert.rejects(
          mutateCheckout(token, { kind: 'prepare', sessionId }),
          CheckoutError,
        );
      },
    );
    await t.test(
      'erreurs structurées, aucune adresse invalide sauvegardée',
      async () => {
        await assert.rejects(
          mutateCheckout(token, {
            kind: 'contact',
            sessionId,
            contact: { ...contact, email: 'invalide' },
          }),
          (error: unknown) =>
            error instanceof CheckoutError && Boolean(error.errors.email),
        );
        assert.equal(
          await db.checkoutAddress.count({ where: { checkoutId: sessionId } }),
          0,
        );
      },
    );
    await t.test(
      'adresses persistantes, facturation identique puis différente puis identique',
      async () => {
        await mutateCheckout(token, { kind: 'contact', sessionId, contact });
        assert.equal((await view()).requiredStep, 'shipping');
        assert.deepEqual((await view()).contact, contact);
        assert.equal(
          await db.checkoutAddress.count({ where: { checkoutId: sessionId } }),
          1,
        );
        await mutateCheckout(token, {
          kind: 'contact',
          sessionId,
          contact: {
            ...contact,
            billingSame: false,
            billing: { ...shipping, addressLine1: '25 rue de Facturation' },
          },
        });
        assert.equal(
          (await view()).contact.billing?.addressLine1,
          '25 rue de Facturation',
        );
        assert.equal(
          await db.checkoutAddress.count({ where: { checkoutId: sessionId } }),
          2,
        );
        await mutateCheckout(token, { kind: 'contact', sessionId, contact });
        assert.equal(
          await db.checkoutAddress.count({ where: { checkoutId: sessionId } }),
          1,
        );
      },
    );
    await t.test(
      'standard et express : frais et total calculés en Decimal serveur',
      async () => {
        await mutateCheckout(token, {
          kind: 'shipping',
          sessionId,
          methodId: standard.id,
        });
        assert.equal((await view()).total, '65.80');
        await mutateCheckout(token, {
          kind: 'shipping',
          sessionId,
          methodId: express.id,
        });
        assert.equal((await view()).shippingAmount, '12.90');
        assert.equal((await view()).total, '72.80');
        assert.equal((await view()).status, 'IN_PROGRESS');
        await mutateCheckout(token, { kind: 'prepare', sessionId });
        assert.equal((await view()).status, 'READY_FOR_PAYMENT');
        assert.equal(
          (
            await db.productVariant.findUniqueOrThrow({
              where: { id: variantId },
            })
          ).stockQuantity,
          8,
        );
      },
    );
    await t.test(
      'identité serveur : actions d’un autre panier refusées',
      async () => {
        const other = await newCart();
        await mutateCheckout(other, { kind: 'start' });
        for (const mutation of [
          { kind: 'contact' as const, sessionId, contact },
          { kind: 'shipping' as const, sessionId, methodId: standard.id },
          { kind: 'prepare' as const, sessionId },
        ])
          await assert.rejects(mutateCheckout(other, mutation), CheckoutError);
        assert.equal((await view()).contact.email, contact.email);
      },
    );
    await t.test(
      'adresse modifiée : invalidation et méthodes selon le pays',
      async () => {
        await mutateCheckout(token, {
          kind: 'contact',
          sessionId,
          contact: {
            ...contact,
            shipping: { ...shipping, countryCode: secondCountry },
          },
        });
        const current = await view();
        assert.equal(current.status, 'IN_PROGRESS');
        assert.equal(current.selectedMethod, null);
        assert.ok(current.methods.some((m) => m.id === standard.id));
        assert.ok(!current.methods.some((m) => m.id === express.id));
        await assert.rejects(
          mutateCheckout(token, {
            kind: 'shipping',
            sessionId,
            methodId: express.id,
          }),
          CheckoutError,
        );
        await mutateCheckout(token, { kind: 'contact', sessionId, contact });
      },
    );
    await t.test(
      'panier modifié depuis un autre onglet, seuil gratuit et remise en validation',
      async () => {
        await ready();
        await mutateCart(token, { kind: 'add', variantId, quantity: 2 });
        assert.equal(
          (
            await db.checkoutSession.findUniqueOrThrow({
              where: { id: sessionId },
            })
          ).status,
          'IN_PROGRESS',
        );
        const current = await view();
        assert.equal(current.cart.itemCount, 3);
        assert.equal(current.shippingAmount, '0.00');
        assert.equal(current.total, '179.70');
        await ready();
        assert.equal((await view()).status, 'READY_FOR_PAYMENT');
      },
    );
    await t.test(
      'prix produit changé : total courant et statut invalidé lors de sync',
      async () => {
        await db.productVariant.update({
          where: { id: variantId },
          data: { price: '49.90' },
        });
        const current = await view();
        assert.equal(current.cart.subtotal, '149.70');
        assert.equal(current.shippingAmount, '5.90');
        assert.equal(current.total, '155.60');
        assert.equal(current.status, 'IN_PROGRESS');
        await mutateCheckout(token, { kind: 'sync' });
        assert.equal(
          (
            await db.checkoutSession.findUniqueOrThrow({
              where: { id: sessionId },
            })
          ).status,
          'IN_PROGRESS',
        );
      },
    );
    await t.test(
      'tarif livraison changé, désactivation et destination retirée',
      async () => {
        await ready();
        await db.shippingMethod.update({
          where: { id: standard.id },
          data: { price: '6.90' },
        });
        assert.equal((await view()).shippingAmount, '6.90');
        assert.equal((await view()).status, 'IN_PROGRESS');
        await db.shippingMethod.update({
          where: { id: standard.id },
          data: { isActive: false },
        });
        assert.equal((await view()).requiredStep, 'shipping');
        await assert.rejects(
          mutateCheckout(token, { kind: 'prepare', sessionId }),
          CheckoutError,
        );
        await mutateCheckout(token, { kind: 'sync' });
        assert.equal(
          (
            await db.checkoutSession.findUniqueOrThrow({
              where: { id: sessionId },
            })
          ).shippingMethodId,
          null,
        );
        await db.shippingMethod.update({
          where: { id: standard.id },
          data: { isActive: true },
        });
        await ready();
        await db.shippingCountry.update({
          where: { code: country },
          data: { isActive: false },
        });
        assert.equal((await view()).requiredStep, 'contact');
        await assert.rejects(
          mutateCheckout(token, { kind: 'prepare', sessionId }),
          CheckoutError,
        );
        await db.shippingCountry.update({
          where: { code: country },
          data: { isActive: true },
        });
      },
    );
    await t.test(
      'stock devenu insuffisant : blocage sans réservation ni effacement',
      async () => {
        await ready();
        await db.productVariant.update({
          where: { id: variantId },
          data: { stockQuantity: 2 },
        });
        assert.equal((await view()).blocked, true);
        assert.equal((await view()).cart.itemCount, 3);
        await assert.rejects(
          mutateCheckout(token, { kind: 'prepare', sessionId }),
          CheckoutError,
        );
        await mutateCheckout(token, { kind: 'sync' });
        assert.equal(
          (
            await db.checkoutSession.findUniqueOrThrow({
              where: { id: sessionId },
            })
          ).status,
          'IN_PROGRESS',
        );
        await db.productVariant.update({
          where: { id: variantId },
          data: { stockQuantity: 8 },
        });
      },
    );
    await t.test(
      'expiration : ancien checkout marqué, remplacement sans reprendre les adresses',
      async () => {
        await db.checkoutSession.update({
          where: { id: sessionId },
          data: { expiresAt: new Date(0) },
        });
        assert.equal((await view()).status, 'EXPIRED');
        await assert.rejects(
          mutateCheckout(token, { kind: 'prepare', sessionId }),
          CheckoutError,
        );
        await mutateCheckout(token, { kind: 'sync' });
        assert.equal(
          (
            await db.checkoutSession.findUniqueOrThrow({
              where: { id: sessionId },
            })
          ).status,
          'EXPIRED',
        );
        await mutateCheckout(token, { kind: 'start' });
        const replacement = await view();
        assert.notEqual(replacement.sessionId, sessionId);
        assert.equal(replacement.contact.email, '');
        assert.equal(replacement.cart.itemCount, 3);
        await assert.rejects(
          mutateCheckout(token, { kind: 'contact', sessionId, contact }),
          CheckoutError,
        );
        sessionId = replacement.sessionId!;
      },
    );
    await t.test('aucune méthode et validation finale impossible', async () => {
      await mutateCheckout(token, { kind: 'contact', sessionId, contact });
      await db.shippingMethod.update({
        where: { id: standard.id },
        data: { countries: { disconnect: { code: country } } },
      });
      await db.shippingMethod.update({
        where: { id: express.id },
        data: { countries: { disconnect: { code: country } } },
      });
      assert.equal((await view()).methods.length, 0);
      const incomplete = await getCheckoutData(token);
      assert.ok(incomplete);
      assert.throws(() => validateCheckout(incomplete), CheckoutError);
      await assert.rejects(
        mutateCheckout(token, { kind: 'prepare', sessionId }),
        CheckoutError,
      );
      await db.shippingMethod.update({
        where: { id: standard.id },
        data: { countries: { connect: { code: country } } },
      });
      await ready();
    });
    await t.test(
      'FK restrict livraison et cascade des adresses sur suppression du panier',
      async () => {
        await assert.rejects(
          db.shippingMethod.delete({ where: { id: standard.id } }),
        );
        const row = await db.cart.findUniqueOrThrow({
          where: { tokenHash: cartTokenHash(token)! },
        });
        await db.cart.delete({ where: { id: row.id } });
        assert.equal(
          await db.checkoutAddress.count({ where: { checkoutId: sessionId } }),
          0,
        );
        assert.equal(
          await db.checkoutSession.count({ where: { cartId: row.id } }),
          0,
        );
      },
    );
  } finally {
    await db.cart.deleteMany({
      where: {
        tokenHash: { in: [...tokens].map((value) => cartTokenHash(value)!) },
      },
    });
    await db.shippingMethod.deleteMany({
      where: { id: { in: [standard.id, express.id] } },
    });
    await db.shippingCountry.deleteMany({ where: { code: { in: codes } } });
    await db.productVariant.deleteMany({ where: { productId: product.id } });
    await db.product.delete({ where: { id: product.id } });
    await db.category.delete({ where: { id: category.id } });
    await db.$disconnect();
  }
});
