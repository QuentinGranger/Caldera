import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { getPrisma } from '../src/lib/db/prisma';
import { cartTokenHash } from '../src/lib/cart/identity';
import { mockPwnedPasswords } from './helpers/pwned';

if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1'].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  )
)
  throw new Error('Tests réservés à PostgreSQL local de développement.');
// Test-only secrets when the local environment has none.
process.env.BETTER_AUTH_SECRET ||= randomBytes(32).toString('hex');
process.env.ORDER_ACCESS_SECRET ||= randomBytes(32).toString('hex');
// The breach check stays on, answered offline by the stand-in below.
delete process.env.PASSWORD_BREACH_CHECK;
const pwned = mockPwnedPasswords();

const { getCustomerAuth } = await import('../src/lib/account/auth');
const { setAccountMailer } = await import('../src/lib/account/emails');
const { allowAccountAttempt } = await import('../src/lib/account/limits');
const { isBreachedPassword } = await import('../src/lib/auth/passwordPolicy');
const { getCustomerOrders } = await import('../src/lib/account/queries');
type Mail = { kind: string; to: string; action: string };

const db = getPrisma();

async function order(
  key: string,
  values: {
    email: string;
    status?: 'PAID' | 'PENDING_PAYMENT';
    customerId?: string;
  },
) {
  const cart = await db.cart.create({
    data: {
      tokenHash: cartTokenHash(randomUUID().replaceAll('-', '').repeat(2))!,
      expiresAt: new Date(Date.now() + 86400000),
    },
  });
  const checkout = await db.checkoutSession.create({
    data: { cartId: cart.id, expiresAt: new Date(Date.now() + 86400000) },
  });
  const paid = (values.status ?? 'PAID') === 'PAID';
  return db.order.create({
    data: {
      checkoutSessionId: checkout.id,
      publicId: randomUUID().replaceAll('-', '').repeat(2),
      orderNumber: `ACC-${key}-${randomUUID().slice(0, 8)}`,
      status: values.status ?? 'PAID',
      email: values.email,
      customerId: values.customerId ?? null,
      currency: 'EUR',
      subtotalAmount: '10.00',
      shippingAmount: '0',
      totalAmount: '10.00',
      shippingMethodCode: 'TEST',
      shippingMethodName: 'Livraison test',
      paidAt: paid ? new Date() : null,
      ...(paid
        ? {
            payment: {
              create: {
                status: 'SUCCEEDED' as const,
                amount: '10.00',
                currency: 'EUR',
                paidAt: new Date(),
              },
            },
          }
        : {}),
    },
  });
}

test('comptes clients : inscription, confirmation, connexion, historique, suppression', async (t) => {
  const key = randomUUID().slice(0, 8);
  const email = `client-${key}@example.com`;
  const password = `phrase secrète ${key}`;
  const mails: Mail[] = [];
  setAccountMailer(async (mail) => {
    mails.push(mail);
  });
  const auth = getCustomerAuth();
  const token = (kind: string) => {
    const mail = mails.findLast((entry) => entry.kind === kind);
    assert.ok(mail, `e-mail ${kind} absent`);
    // Links carry the token in the fragment, never in the query string.
    assert.equal(new URL(mail.action).search, '');
    return new URLSearchParams(new URL(mail.action).hash.slice(1)).get(
      'token',
    )!;
  };
  const created: string[] = [];
  try {
    await t.test(
      'inscription : compte non vérifié, lien de confirmation',
      async () => {
        await auth.api.signUpEmail({
          body: { name: 'Client Test', email: email.toUpperCase(), password },
        });
        const customer = await db.customer.findUniqueOrThrow({
          where: { email },
        });
        created.push(customer.id);
        assert.equal(customer.emailVerified, false);
        assert.equal(mails.at(-1)?.kind, 'verify');
        assert.equal(mails.at(-1)?.to, email);
        assert.equal(
          await db.customerSession.count({ where: { userId: customer.id } }),
          0,
        );
        // The password is hashed, never stored as typed.
        const account = await db.customerAccount.findFirstOrThrow({
          where: { userId: customer.id },
        });
        assert.ok(account.password && !account.password.includes(password));
      },
    );

    await t.test(
      'adresse déjà prise : même réponse, e-mail au titulaire',
      async () => {
        const before = mails.length;
        const result = await auth.api.signUpEmail({
          body: { name: 'Intrus', email, password: 'autre mot de passe' },
        });
        assert.equal(result.token, null);
        assert.equal(await db.customer.count({ where: { email } }), 1);
        assert.equal(mails.length, before + 1);
        assert.equal(mails.at(-1)?.kind, 'existing');
      },
    );

    await t.test(
      'connexion refusée tant que l’adresse n’est pas confirmée',
      async () => {
        await assert.rejects(
          auth.api.signInEmail({ body: { email, password } }),
          (error: { body?: { code?: string } }) =>
            error.body?.code === 'EMAIL_NOT_VERIFIED',
        );
        assert.equal(mails.at(-1)?.kind, 'verify');
      },
    );

    await t.test(
      'confirmation : adresse vérifiée, session ouverte',
      async () => {
        await auth.api.verifyEmail({ query: { token: token('verify') } });
        const customer = await db.customer.findUniqueOrThrow({
          where: { email },
        });
        assert.equal(customer.emailVerified, true);
        const { headers } = await auth.api.signInEmail({
          body: { email, password },
          returnHeaders: true,
        });
        assert.match(
          headers.get('set-cookie') ?? '',
          /caldera_client\.session_token=/,
        );
        await assert.rejects(
          auth.api.signInEmail({
            body: { email, password: 'mauvais mot de passe' },
          }),
        );
      },
    );

    await t.test(
      'historique : compte + e-mail vérifié, commandes réelles seulement',
      async () => {
        const customer = await db.customer.findUniqueOrThrow({
          where: { email },
        });
        const guest = await order(key, { email: email.toUpperCase() });
        const unpaid = await order(key, { email, status: 'PENDING_PAYMENT' });
        const linked = await order(key, {
          email: `autre-${key}@example.com`,
          customerId: customer.id,
        });
        const foreign = await order(key, { email: `autre-${key}@example.com` });
        const numbers = (
          await getCustomerOrders({ ...customer, emailVerified: true })
        ).map((entry) => entry.orderNumber);
        assert.ok(numbers.includes(guest.orderNumber));
        assert.ok(numbers.includes(linked.orderNumber));
        assert.ok(!numbers.includes(unpaid.orderNumber));
        assert.ok(!numbers.includes(foreign.orderNumber));
        // Unverified e-mail: only the orders placed while signed in.
        const unverified = (
          await getCustomerOrders({ ...customer, emailVerified: false })
        ).map((entry) => entry.orderNumber);
        assert.deepEqual(unverified, [linked.orderNumber]);
        const [first] = await getCustomerOrders({
          ...customer,
          emailVerified: true,
        });
        assert.match(
          first!.href ?? '',
          /^\/commande\/[a-f0-9]{64}\?access=\d{10}\.[a-f0-9]{64}$/,
        );
      },
    );

    await t.test(
      'mot de passe oublié : lien unique, haché, remplacé, confirmé',
      async () => {
        const customer = await db.customer.findUniqueOrThrow({
          where: { email },
        });
        await auth.api.requestPasswordReset({ body: { email } });
        const first = token('reset');
        await auth.api.requestPasswordReset({ body: { email } });
        const reset = token('reset');
        assert.notEqual(first, reset);
        // Only a hash is stored, and only the latest link remains.
        const rows = await db.customerVerification.findMany({
          where: { value: customer.id },
        });
        assert.equal(rows.length, 1);
        assert.ok(!rows[0]!.identifier.includes(reset));
        assert.ok(!rows[0]!.identifier.includes(first));
        await assert.rejects(
          auth.api.resetPassword({
            body: { newPassword: `phrase remplacée ${key}`, token: first },
          }),
          (error: { body?: { code?: string } }) =>
            error.body?.code === 'INVALID_TOKEN',
        );
        // A leaked password is caught before the link is used (the reset
        // action checks first: better-auth consumes the link before hashing).
        const leaked = `phrase fuitée ${key}`;
        pwned.breach(leaked);
        assert.equal(await isBreachedPassword(leaked), true);
        assert.equal(await isBreachedPassword(`nouvelle phrase ${key}`), false);
        // Sign-in lockout from earlier failures is lifted by the reset.
        for (let attempt = 0; attempt < 6; attempt++)
          await allowAccountAttempt('sign-in', email);
        assert.equal(await allowAccountAttempt('sign-in', email), false);
        const next = `nouvelle phrase ${key}`;
        const before = mails.length;
        await auth.api.resetPassword({
          body: { newPassword: next, token: reset },
        });
        assert.equal(await allowAccountAttempt('sign-in', email), true);
        assert.equal(mails.length, before + 1);
        assert.equal(mails.at(-1)?.kind, 'password-changed');
        assert.equal(mails.at(-1)?.to, email);
        assert.equal(
          await db.customerVerification.count({
            where: { value: customer.id },
          }),
          0,
        );
        assert.equal(
          await db.customerSession.count({ where: { userId: customer.id } }),
          0,
        );
        await assert.rejects(
          auth.api.signInEmail({ body: { email, password } }),
        );
        await auth.api.signInEmail({ body: { email, password: next } });
        // Single use.
        await assert.rejects(
          auth.api.resetPassword({
            body: { newPassword: `x ${next}`, token: reset },
          }),
        );
        // Unknown address: same answer, no e-mail.
        const count = mails.length;
        await auth.api.requestPasswordReset({
          body: { email: `inconnu-${key}@example.com` },
        });
        assert.equal(mails.length, count);
        // The breach service only ever saw 5-character hash prefixes.
        assert.ok(pwned.ranges.every((range) => /^[0-9A-F]{5}$/.test(range)));
      },
    );

    await t.test('inscription : mot de passe fuité refusé', async () => {
      const leaked = `phrase connue ${key}`;
      pwned.breach(leaked);
      await assert.rejects(
        auth.api.signUpEmail({
          body: {
            name: 'Fuite',
            email: `fuite-${key}@example.com`,
            password: leaked,
          },
        }),
        (error: { body?: { code?: string } }) =>
          error.body?.code === 'PASSWORD_COMPROMISED',
      );
      assert.equal(
        await db.customer.count({
          where: { email: `fuite-${key}@example.com` },
        }),
        0,
      );
    });

    await t.test('tentatives limitées par adresse', async () => {
      const target = `limite-${key}@example.com`;
      for (let attempt = 0; attempt < 5; attempt++)
        assert.equal(await allowAccountAttempt('sign-in', target), true);
      assert.equal(await allowAccountAttempt('sign-in', target), false);
      // Scopes are independent.
      assert.equal(await allowAccountAttempt('reset', target), true);
    });

    await t.test(
      'suppression : compte effacé, commandes conservées sans lien',
      async () => {
        const customer = await db.customer.findUniqueOrThrow({
          where: { email },
        });
        await db.customerAddress.create({
          data: {
            customerId: customer.id,
            firstName: 'Client',
            lastName: 'Test',
            addressLine1: '1 rue du Test',
            postalCode: '69005',
            city: 'Lyon',
            countryCode: 'FR',
          },
        });
        const { headers } = await auth.api.signInEmail({
          body: { email, password: `nouvelle phrase ${key}` },
          returnHeaders: true,
        });
        const cookie = (headers.get('set-cookie') ?? '').split(';')[0]!;
        await assert.rejects(
          auth.api.deleteUser({
            headers: new Headers({ cookie }),
            body: { password: 'mauvais mot de passe' },
          }),
        );
        await auth.api.deleteUser({
          headers: new Headers({ cookie }),
          body: { password: `nouvelle phrase ${key}` },
        });
        assert.equal(
          await db.customer.count({ where: { id: customer.id } }),
          0,
        );
        for (const model of [db.customerSession, db.customerAccount] as const)
          assert.equal(
            await (model as typeof db.customerSession).count({
              where: { userId: customer.id },
            }),
            0,
          );
        assert.equal(
          await db.customerAddress.count({
            where: { customerId: customer.id },
          }),
          0,
        );
        const kept = await db.order.findMany({
          where: { orderNumber: { startsWith: `ACC-${key}-` } },
        });
        assert.equal(kept.length, 4);
        assert.ok(kept.every((entry) => entry.customerId === null));
        created.length = 0;
      },
    );
  } finally {
    setAccountMailer(null);
    pwned.restore();
    const orders = await db.order.findMany({
      where: { orderNumber: { startsWith: `ACC-${key}-` } },
      select: { id: true, checkoutSessionId: true },
    });
    await db.payment.deleteMany({
      where: { orderId: { in: orders.map((o) => o.id) } },
    });
    await db.order.deleteMany({
      where: { id: { in: orders.map((o) => o.id) } },
    });
    const sessions = await db.checkoutSession.findMany({
      where: { id: { in: orders.map((o) => o.checkoutSessionId) } },
      select: { cartId: true },
    });
    await db.cart.deleteMany({
      where: { id: { in: sessions.map((s) => s.cartId) } },
    });
    await db.customer.deleteMany({ where: { id: { in: created } } });
    await db.customerAuthAttempt.deleteMany({
      where: { key: { not: 'global' } },
    });
    await db.$disconnect();
  }
});
