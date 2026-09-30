import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { getPrisma } from '../src/lib/db/prisma';
import type { EmailEnvelope, EmailProvider } from '../src/lib/email/provider';

if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1'].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  )
)
  throw new Error('Tests réservés à PostgreSQL local de développement.');
process.env.BETTER_AUTH_SECRET ||= randomBytes(32).toString('hex');

const { setStockAlertMailer } = await import('../src/lib/stock-alerts/email');
const service = await import('../src/lib/stock-alerts/service');
const { processStockAlerts, purgeStockAlerts, MAX_STOCK_ALERT_ATTEMPTS } =
  await import('../src/lib/stock-alerts/processor');

const db = getPrisma();
const settings = {
  from: 'Les Terres de Caldera <test@example.com>',
  replyTo: undefined,
  testRecipient: undefined,
};

function recordingProvider(fail = false) {
  const sent: { envelope: EmailEnvelope; key: string }[] = [];
  const provider: EmailProvider = {
    name: 'test',
    async send(envelope, key) {
      if (fail) throw new Error('panne');
      sent.push({ envelope, key });
      return { id: `msg-${sent.length}` };
    },
  };
  return { provider, sent };
}

const fragmentToken = (url: string) =>
  new URLSearchParams(new URL(url).hash.slice(1)).get('token')!;

test('alertes de retour en stock : double opt-in, un seul envoi, suppression, rétention', async (t) => {
  const key = randomUUID().slice(0, 8);
  const category = await db.category.create({
    data: { name: `Alertes ${key}`, slug: `alertes-${key}` },
  });
  const product = await db.product.create({
    data: {
      name: `Coffret alerte ${key}`,
      slug: `coffret-alerte-${key}`,
      categoryId: category.id,
      status: 'ACTIVE',
      productType: 'ETB',
      variants: {
        create: [
          {
            sku: `ALERTE-FR-${key}`,
            price: '59.90',
            stockQuantity: 0,
            language: 'FR',
          },
          {
            sku: `ALERTE-JP-${key}`,
            price: '64.90',
            stockQuantity: 4,
            language: 'JP',
          },
        ],
      },
    },
    include: { variants: true },
  });
  const soldOut = product.variants.find((v) => v.language === 'FR')!;
  const inStock = product.variants.find((v) => v.language === 'JP')!;
  const guest = `visiteur-${key}@example.com`;
  const customer = await db.customer.create({
    data: {
      email: `client-${key}@example.com`,
      name: 'Client',
      emailVerified: true,
    },
  });
  const signedIn = {
    id: customer.id,
    email: customer.email,
    emailVerified: true,
  };
  const mails: { to: string; action: string; text: string }[] = [];
  setStockAlertMailer(async (mail) => {
    mails.push(mail);
  });
  try {
    await t.test(
      'visiteur : alerte en attente, confirmation par e-mail, jeton haché',
      async () => {
        assert.equal(
          await service.subscribeToStockAlert({
            email: guest,
            variantId: soldOut.id,
            customer: null,
          }),
          'pending',
        );
        const alert = await db.stockAlert.findUniqueOrThrow({
          where: { email_variantId: { email: guest, variantId: soldOut.id } },
        });
        assert.equal(alert.status, 'PENDING');
        assert.equal(mails.at(-1)?.to, guest);
        const token = fragmentToken(mails.at(-1)!.action);
        assert.equal(new URL(mails.at(-1)!.action).search, '');
        assert.notEqual(alert.confirmationTokenHash, token);
        assert.match(
          mails.at(-1)!.text,
          /Annuler cette alerte : http.*#token=/,
        );
        // Asking again replaces the link: still one alert.
        await service.subscribeToStockAlert({
          email: guest,
          variantId: soldOut.id,
          customer: null,
        });
        assert.equal(await db.stockAlert.count({ where: { email: guest } }), 1);
        assert.equal(await service.confirmStockAlert(token), false);
        const latest = fragmentToken(mails.at(-1)!.action);
        assert.equal(await service.confirmStockAlert(latest), true);
        assert.equal(await service.confirmStockAlert(latest), false);
        // Once active, asking again sends nothing and reveals nothing.
        const count = mails.length;
        assert.equal(
          await service.subscribeToStockAlert({
            email: guest,
            variantId: soldOut.id,
            customer: null,
          }),
          'pending',
        );
        assert.equal(mails.length, count);
      },
    );

    await t.test(
      'client connecté : alerte active tout de suite, sans e-mail',
      async () => {
        const count = mails.length;
        assert.equal(
          await service.subscribeToStockAlert({
            email: customer.email,
            variantId: soldOut.id,
            customer: signedIn,
          }),
          'active',
        );
        assert.equal(mails.length, count);
        const alerts = await service.getCustomerStockAlerts(signedIn);
        assert.equal(alerts.length, 1);
        assert.match(alerts[0]!.href, /\?variant=ALERTE-FR-/);
        assert.equal(alerts[0]!.backInStock, false);
      },
    );

    await t.test('refus : version disponible ou inconnue', async () => {
      assert.equal(
        await service.subscribeToStockAlert({
          email: guest,
          variantId: inStock.id,
          customer: null,
        }),
        'available',
      );
      assert.equal(
        await service.subscribeToStockAlert({
          email: guest,
          variantId: randomUUID(),
          customer: null,
        }),
        'not-found',
      );
    });

    await t.test(
      'retour en stock : un e-mail par alerte, une seule fois',
      async () => {
        const idle = recordingProvider();
        assert.equal(
          (await processStockAlerts({ provider: idle.provider, settings }))
            .notified,
          0,
        );
        assert.equal(idle.sent.length, 0);
        await db.productVariant.update({
          where: { id: soldOut.id },
          data: { stockQuantity: 2 },
        });
        const run = recordingProvider();
        const result = await processStockAlerts({
          provider: run.provider,
          settings,
        });
        assert.equal(result.notified, 2);
        assert.deepEqual(
          run.sent.map((entry) => entry.envelope.to[0]).sort(),
          [customer.email, guest].sort(),
        );
        assert.ok(
          run.sent.every((entry) =>
            entry.key.startsWith('caldera-stock-alert:'),
          ),
        );
        assert.match(
          run.sent[0]!.envelope.text,
          /produit\/coffret-alerte-.*\?variant=ALERTE-FR-/,
        );
        assert.equal(
          await db.stockAlert.count({
            where: { variantId: soldOut.id, status: 'NOTIFIED' },
          }),
          2,
        );
        const again = recordingProvider();
        await processStockAlerts({ provider: again.provider, settings });
        assert.equal(again.sent.length, 0);
      },
    );

    await t.test(
      'panne du fournisseur : nouvel essai différé, puis abandon',
      async () => {
        const other = `panne-${key}@example.com`;
        await db.stockAlert.create({
          data: {
            email: other,
            variantId: soldOut.id,
            status: 'ACTIVE',
            confirmedAt: new Date(),
          },
        });
        const failing = recordingProvider(true);
        const first = await processStockAlerts({
          provider: failing.provider,
          settings,
        });
        assert.equal(first.failed, 1);
        let alert = await db.stockAlert.findUniqueOrThrow({
          where: { email_variantId: { email: other, variantId: soldOut.id } },
        });
        assert.equal(alert.status, 'ACTIVE');
        assert.equal(alert.attemptCount, 1);
        assert.ok(alert.nextAttemptAt > new Date());
        for (let attempt = 1; attempt < MAX_STOCK_ALERT_ATTEMPTS; attempt++) {
          await db.stockAlert.update({
            where: { id: alert.id },
            data: { nextAttemptAt: new Date() },
          });
          await processStockAlerts({ provider: failing.provider, settings });
        }
        alert = await db.stockAlert.findUniqueOrThrow({
          where: { id: alert.id },
        });
        assert.equal(alert.status, 'FAILED');
        assert.equal(alert.attemptCount, MAX_STOCK_ALERT_ATTEMPTS);
      },
    );

    await t.test('suppression par lien signé et depuis le compte', async () => {
      await db.productVariant.update({
        where: { id: soldOut.id },
        data: { stockQuantity: 0 },
      });
      const other = `retrait-${key}@example.com`;
      const alert = await db.stockAlert.create({
        data: {
          email: other,
          variantId: soldOut.id,
          status: 'ACTIVE',
          confirmedAt: new Date(),
        },
      });
      const { stockAlertRemovalToken } =
        await import('../src/lib/stock-alerts/tokens');
      assert.equal(await service.removeStockAlertWithToken('faux'), false);
      assert.equal(
        await service.removeStockAlertWithToken(
          stockAlertRemovalToken(alert.id),
        ),
        true,
      );
      assert.equal(await db.stockAlert.count({ where: { id: alert.id } }), 0);
      const mine = await db.stockAlert.create({
        data: {
          email: customer.email,
          variantId: inStock.id,
          customerId: customer.id,
          status: 'ACTIVE',
        },
      });
      // Somebody else's alert cannot be removed from an account.
      const foreign = await db.stockAlert.create({
        data: {
          email: `autre-${key}@example.com`,
          variantId: inStock.id,
          status: 'ACTIVE',
        },
      });
      assert.equal(
        await service.removeCustomerStockAlert(signedIn, foreign.id),
        false,
      );
      assert.equal(
        await service.removeCustomerStockAlert(signedIn, mine.id),
        true,
      );
    });

    await t.test(
      'rétention : attente expirée et alertes envoyées anciennes effacées',
      async () => {
        const stale = await db.stockAlert.create({
          data: {
            email: `vieux-${key}@example.com`,
            variantId: soldOut.id,
            status: 'PENDING',
            confirmationExpiresAt: new Date(Date.now() - 1000),
          },
        });
        await db.stockAlert.updateMany({
          where: { variantId: soldOut.id, status: 'NOTIFIED' },
          data: { notifiedAt: new Date(Date.now() - 31 * 86_400_000) },
        });
        assert.ok((await purgeStockAlerts()) >= 3);
        assert.equal(await db.stockAlert.count({ where: { id: stale.id } }), 0);
        assert.equal(
          await db.stockAlert.count({
            where: { variantId: soldOut.id, status: 'NOTIFIED' },
          }),
          0,
        );
      },
    );

    await t.test('compte supprimé : ses alertes aussi', async () => {
      await db.stockAlert.create({
        data: {
          email: customer.email,
          variantId: soldOut.id,
          customerId: customer.id,
          status: 'ACTIVE',
        },
      });
      await db.customer.delete({ where: { id: customer.id } });
      assert.equal(
        await db.stockAlert.count({ where: { customerId: customer.id } }),
        0,
      );
    });
  } finally {
    setStockAlertMailer(null);
    await db.stockAlert.deleteMany({
      where: { variantId: { in: [soldOut.id, inStock.id] } },
    });
    await db.customer.deleteMany({ where: { id: customer.id } });
    await db.productVariant.deleteMany({ where: { productId: product.id } });
    await db.product.delete({ where: { id: product.id } });
    await db.category.delete({ where: { id: category.id } });
    await db.$disconnect();
  }
});
