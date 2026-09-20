import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import Stripe from 'stripe';
import { getPrisma } from '../src/lib/db/prisma';
import { mutateCart } from '../src/lib/cart/service';
import { mutateCheckout } from '../src/lib/checkout/service';
import { getCheckoutData } from '../src/lib/checkout/queries';
import { emptyAddress } from '../src/lib/checkout/types';
import { cartTokenHash } from '../src/lib/cart/identity';
import { prepareOrder } from '../src/lib/orders/prepare';
import { ensureIntent } from '../src/lib/payments/intents';
import { cancelOrder, currentOrder } from '../src/lib/payments/cancel';
import {
  assertPaymentConfiguration,
  getStripe,
  paymentReturnUrl,
} from '../src/lib/stripe/stripe';

assertPaymentConfiguration();
assert.notEqual(
  process.env.EMAILS_ENABLED,
  'true',
  'Désactiver les emails pour la recette Stripe automatisée.',
);
const database = new URL(process.env.DATABASE_URL!);
if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1', '[::1]'].includes(database.hostname)
)
  throw new Error('Recette réservée à PostgreSQL local et Stripe TEST.');
const db = getPrisma(),
  stripe = getStripe(),
  key = randomUUID();
const tokens: string[] = [],
  orders: string[] = [];
let categoryId: string | undefined,
  productId: string | undefined,
  variantId: string | undefined,
  methodId: string | undefined;
async function waitOrder(id: string, expected: string) {
  const until = Date.now() + 45000;
  while (Date.now() < until) {
    const order = await currentOrder(id);
    if (order.status === expected) return order;
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error(`Webhook non confirmé dans le délai prévu (${expected}).`);
}
async function setupOrder() {
  const token = await mutateCart(undefined, {
    kind: 'add',
    variantId: variantId!,
    quantity: 1,
  });
  tokens.push(token);
  await mutateCheckout(token, { kind: 'start' });
  const sessionId = (await getCheckoutData(token))!.session!.id;
  await mutateCheckout(token, {
    kind: 'contact',
    sessionId,
    contact: {
      email: 'stripe-test@example.com',
      phone: '',
      billingSame: true,
      billing: null,
      shipping: {
        ...emptyAddress(),
        firstName: 'Test',
        lastName: 'Caldera',
        addressLine1: '1 rue des Tests',
        postalCode: '75001',
        city: 'Paris',
      },
    },
  });
  await mutateCheckout(token, {
    kind: 'shipping',
    sessionId,
    methodId: methodId!,
  });
  await mutateCheckout(token, { kind: 'prepare', sessionId });
  const order = await prepareOrder(token, sessionId);
  orders.push(order.id);
  const intent = await ensureIntent(order.id);
  assert.equal(intent.livemode, false);
  const repeated = await ensureIntent(order.id);
  assert.equal(intent.id, repeated.id);
  return { order, intent, token };
}
try {
  const health = await fetch('http://localhost:3000/api/health');
  assert.equal(health.status, 200);
  assert.ok(
    await db.shippingCountry.findUnique({ where: { code: 'FR' } }),
    'Pays FR nécessaire.',
  );
  categoryId = (
    await db.category.create({
      data: { name: 'Recette Stripe temporaire', slug: `stripe-check-${key}` },
    })
  ).id;
  const product = await db.product.create({
    data: {
      name: 'Recette Stripe TEST',
      slug: `stripe-check-${key}`,
      categoryId,
      status: 'ACTIVE',
      productType: 'OTHER',
      variants: {
        create: { sku: `STRIPE-CHECK-${key}`, price: '1.00', stockQuantity: 3 },
      },
    },
    include: { variants: true },
  });
  productId = product.id;
  variantId = product.variants[0]!.id;
  methodId = (
    await db.shippingMethod.create({
      data: {
        code: `STRIPE-CHECK-${key}`,
        name: 'Recette livraison',
        price: '0.00',
        isDevelopment: true,
        countries: { connect: { code: 'FR' } },
      },
    })
  ).id;

  const success = await setupOrder();
  const publicStripe = new Stripe(
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
    { maxNetworkRetries: 0 },
  );
  const visibleIntent = await publicStripe.paymentIntents.retrieve(
    success.intent.id,
    { client_secret: success.intent.client_secret! },
  );
  assert.equal(visibleIntent.id, success.intent.id);
  console.info(
    'Clés publique et serveur : même environnement Stripe TEST vérifié.',
  );
  const paid = await stripe.paymentIntents.confirm(success.intent.id, {
    payment_method: 'pm_card_visa',
    return_url: paymentReturnUrl(success.order.publicId),
  });
  assert.equal(paid.status, 'succeeded');
  const confirmed = await waitOrder(success.order.id, 'PAID');
  assert.equal(confirmed.payment!.status, 'SUCCEEDED');
  assert.equal(confirmed.fulfillmentStatus, 'UNFULFILLED');
  const confirmationEmails = await db.emailDelivery.findMany({
    where: { orderId: confirmed.id, type: 'ORDER_CONFIRMATION' },
  });
  assert.equal(confirmationEmails.length, 1);
  assert.equal(confirmationEmails[0]!.status, 'PENDING');
  assert.equal(confirmationEmails[0]!.attemptCount, 0);
  assert.ok(confirmed.reservations.every((r) => r.status === 'CONSUMED'));
  const inventory = await db.productVariant.findUniqueOrThrow({
    where: { id: variantId },
  });
  assert.equal(inventory.stockQuantity, 2);
  assert.equal(inventory.reservedQuantity, 0);
  const cart = await db.cart.findUniqueOrThrow({
    where: { tokenHash: cartTokenHash(success.token)! },
  });
  assert.equal(cart.status, 'CONVERTED');
  console.info(
    'Succès Stripe TEST → vrai webhook signé → Order PAID, Payment SUCCEEDED, stock consommé, panier converti.',
  );

  const declined = await setupOrder();
  try {
    await stripe.paymentIntents.confirm(declined.intent.id, {
      payment_method: 'pm_card_visa_chargeDeclined',
      return_url: paymentReturnUrl(declined.order.publicId),
    });
    throw new Error('Refus attendu.');
  } catch (error) {
    assert.ok(error instanceof Stripe.errors.StripeCardError);
    assert.equal(error.code, 'card_declined');
  }
  const failed = await waitOrder(declined.order.id, 'PAYMENT_FAILED');
  assert.equal(failed.payment!.status, 'FAILED');
  assert.equal(
    (await db.productVariant.findUniqueOrThrow({ where: { id: variantId } }))
      .stockQuantity,
    2,
  );
  await cancelOrder(declined.order.id);
  assert.equal((await currentOrder(declined.order.id)).status, 'CANCELLED');
  console.info(
    'Refus Stripe TEST → vrai webhook → PAYMENT_FAILED ; aucune consommation ; annulation et libération vérifiées.',
  );

  const auth = await setupOrder();
  const challenge = await stripe.paymentIntents.confirm(auth.intent.id, {
    payment_method: 'pm_card_authenticationRequired',
    return_url: paymentReturnUrl(auth.order.publicId),
  });
  assert.equal(challenge.status, 'requires_action');
  assert.ok(challenge.next_action);
  const until = Date.now() + 30000;
  while (
    (await currentOrder(auth.order.id)).payment!.status !== 'REQUIRES_ACTION' &&
    Date.now() < until
  )
    await new Promise((resolve) => setTimeout(resolve, 750));
  assert.equal(
    (await currentOrder(auth.order.id)).payment!.status,
    'REQUIRES_ACTION',
  );
  await cancelOrder(auth.order.id);
  console.info(
    'Authentification Stripe TEST requise : état REQUIRES_ACTION reçu. Défi 3DS et Payment Element à vérifier dans le navigateur.',
  );
  console.info(
    'Recette serveur Stripe TEST réussie : 3 scénarios. Aucun débit réel.',
  );
} catch (error) {
  // Stripe errors can contain credentials and client secrets: never dump the object.
  console.error(
    JSON.stringify({
      scope: 'stripe-sandbox-check',
      status: 'failed',
      type:
        error instanceof Stripe.errors.StripeError
          ? error.type
          : error instanceof Error
            ? error.name
            : 'unknown',
      code: error instanceof Stripe.errors.StripeError ? error.code : undefined,
      message:
        error instanceof Stripe.errors.StripeError
          ? 'Requête Stripe de test refusée.'
          : error instanceof Error
            ? error.message
            : 'Erreur de recette.',
    }),
  );
  process.exitCode = 1;
} finally {
  let canDelete = true;
  for (const id of orders) {
    try {
      const order = await currentOrder(id);
      if (!['PAID', 'CANCELLED', 'EXPIRED'].includes(order.status))
        await cancelOrder(id);
      if (
        !['PAID', 'CANCELLED', 'EXPIRED'].includes(
          (await currentOrder(id)).status,
        )
      )
        canDelete = false;
    } catch {
      canDelete = false;
    }
  }
  if (canDelete) {
    // Let final cancel webhooks finish before deleting local fixture references.
    await new Promise((resolve) => setTimeout(resolve, 2000));
    for (const id of orders) {
      await db.stockReservation.deleteMany({ where: { orderId: id } });
      await db.orderItem.deleteMany({ where: { orderId: id } });
      await db.orderAddress.deleteMany({ where: { orderId: id } });
      await db.payment.deleteMany({ where: { orderId: id } });
      await db.emailDelivery.deleteMany({ where: { orderId: id } });
      await db.order.delete({ where: { id } });
    }
    await db.cart.deleteMany({
      where: { tokenHash: { in: tokens.map((t) => cartTokenHash(t)!) } },
    });
    if (methodId) await db.shippingMethod.delete({ where: { id: methodId } });
    if (variantId) await db.productVariant.delete({ where: { id: variantId } });
    if (productId) await db.product.delete({ where: { id: productId } });
    if (categoryId) await db.category.delete({ where: { id: categoryId } });
    console.info(
      'Fixtures locales nettoyées ; traces des événements et paiements TEST conservées pour audit.',
    );
  } else
    console.error(
      'Fixtures conservées pour vérification : une tentative n’est pas terminale.',
    );
  await db.$disconnect();
}
