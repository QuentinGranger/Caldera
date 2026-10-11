import 'server-only';
import { randomUUID } from 'node:crypto';
import { getPrisma } from '@/lib/db/prisma';
import {
  emailSettings,
  resendProvider,
  parseEnvelope,
  EmailProviderError,
  type EmailProvider,
} from '@/lib/email/provider';
import type { LifecycleDelivery, Prisma } from '@/generated/prisma/client';
import { appOrigin } from '@/lib/orders/access';
import { newsletterUnsubscribeUrl } from '@/lib/newsletter/tokens';
import { formatPrice } from '@/utils/formatPrice';
import { renderLifecycleEmail } from '@/emails/lifecycle';
import { availableVariants } from './catalog';
import {
  commercialFrequencyAllowed,
  DAY,
  LIFECYCLE_KINDS,
  personalKinds,
  lowStock,
  type LifecycleKind,
} from './policy';
import { recoveryUrl } from './tokens';
const db = () => getPrisma();
async function claim(now: Date, deliveryId?: string) {
  return db().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "LifecycleRuntime" WHERE id='default' FOR UPDATE`;
    const rows = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM "LifecycleDelivery" WHERE (${deliveryId ?? null}::uuid IS NULL OR id=${deliveryId ?? null}::uuid) AND status IN ('PENDING','FAILED','SENDING') AND "attemptCount" < 5 AND "nextAttemptAt" <= ${now} AND ("leaseUntil" IS NULL OR "leaseUntil" <= ${now}) ORDER BY "dueAt", id FOR UPDATE SKIP LOCKED LIMIT 1`;
    if (!rows[0]) return null;
    const row = await tx.lifecycleDelivery.findUniqueOrThrow({
      where: { id: rows[0].id },
      include: { subscriber: true },
    });
    // Serialize recipient frequency checks across competing automation workers.
    await tx.$queryRaw`SELECT id FROM "NewsletterSubscriber" WHERE id=${row.subscriberId}::uuid FOR UPDATE`;
    const personal = personalKinds.has(row.kind as LifecycleKind);
    if (
      row.expiresAt <= now ||
      (process.env.CATALOG_DEMO_MODE === '1' && row.kind !== 'WELCOME') ||
      row.subscriber.status !== 'ACTIVE' ||
      (personal &&
        (!row.subscriber.personalizedEmails ||
          !row.subscriber.personalizedConsentAt ||
          row.subscriber.personalizedConsentAt > row.createdAt)) ||
      (row.firstAttemptAt &&
        now.getTime() - row.firstAttemptAt.getTime() >= 23 * 3600000)
    ) {
      await tx.lifecycleDelivery.update({
        where: { id: row.id },
        data: {
          status: 'SKIPPED',
          lastError: 'EXPIRE_OU_CONSENTEMENT_RETIRE',
          leaseUntil: null,
          leaseToken: null,
        },
      });
      return { skipped: true as const };
    }
    if (!row.firstAttemptAt) {
      const attempts = await tx.lifecycleDelivery.findMany({
        where: {
          subscriberId: row.subscriberId,
          firstAttemptAt: { gte: new Date(now.getTime() - 30 * DAY) },
        },
        select: { firstAttemptAt: true },
      });
      const campaigns = await tx.newsletterCampaignDelivery.findMany({
        where: {
          subscriberId: row.subscriberId,
          firstAttemptAt: { gte: new Date(now.getTime() - 30 * DAY) },
        },
        select: { firstAttemptAt: true },
      });
      const recentAlert = await tx.stockAlert.count({
        where: {
          email: row.subscriber.email,
          notifiedAt: { gte: new Date(now.getTime() - 3 * DAY) },
        },
      });
      const global = await tx.lifecycleDelivery.count({
        where: { firstAttemptAt: { gte: new Date(now.getTime() - DAY) } },
      });
      if (
        global >= 50 ||
        recentAlert ||
        !commercialFrequencyAllowed(
          [...attempts, ...campaigns].flatMap((r) =>
            r.firstAttemptAt ? [r.firstAttemptAt] : [],
          ),
          now,
        )
      ) {
        await tx.lifecycleDelivery.update({
          where: { id: row.id },
          data: { nextAttemptAt: new Date(now.getTime() + 3600000) },
        });
        return { skipped: true as const };
      }
    }
    return tx.lifecycleDelivery.update({
      where: { id: row.id },
      data: {
        status: 'SENDING',
        attemptCount: { increment: 1 },
        firstAttemptAt: row.firstAttemptAt ?? now,
        leaseUntil: new Date(now.getTime() + 5 * 60000),
        leaseToken: randomUUID(),
      },
      include: { subscriber: true },
    });
  });
}
export async function currentLifecycleContent(
  row: Pick<
    LifecycleDelivery,
    'kind' | 'sourceId' | 'variantIds' | 'quantities' | 'createdAt'
  >,
  email: string,
) {
  if (!LIFECYCLE_KINDS.includes(row.kind as LifecycleKind)) return null;
  const kind = row.kind as LifecycleKind;
  if (kind.startsWith('CART_')) {
    const cart = await db().cart.findUnique({
      where: { id: row.sourceId! },
      include: {
        items: true,
        customer: { select: { email: true, emailVerified: true } },
        checkouts: { include: { order: true } },
      },
    });
    if (
      !cart ||
      cart.status !== 'ACTIVE' ||
      cart.expiresAt <= new Date() ||
      !cart.items.length ||
      cart.updatedAt > row.createdAt ||
      cart.items.some((i) => i.updatedAt > row.createdAt) ||
      cart.checkouts.some(
        (c) =>
          c.order || c.status === 'COMPLETED' || c.updatedAt > row.createdAt,
      )
    )
      return null;
    if (
      !(cart.customer?.emailVerified && cart.customer.email === email) &&
      !cart.checkouts.some((c) => c.email === email)
    )
      return null;
    if (
      await db().order.count({
        where: {
          email,
          status: { in: ['PAID', 'PAYMENT_PROCESSING', 'PAYMENT_REVIEW'] },
          createdAt: { gte: cart.createdAt },
        },
      })
    )
      return null;
  }
  if (
    kind === 'POST_PURCHASE' ||
    kind === 'COMPLEMENTS' ||
    kind === 'WIN_BACK'
  ) {
    const order = await db().order.findUnique({
      where: { id: row.sourceId! },
      include: { payment: true, refunds: true, returns: true },
    });
    if (
      !order ||
      order.email !== email ||
      order.status !== 'PAID' ||
      order.payment?.status !== 'SUCCEEDED' ||
      order.refunds.length ||
      order.returns.length ||
      (kind !== 'WIN_BACK' && !order.deliveredAt)
    )
      return null;
    if (
      kind === 'WIN_BACK' &&
      (await db().order.count({
        where: { email, status: 'PAID', paidAt: { gt: order.paidAt! } },
      }))
    )
      return null;
  }
  let variants = await availableVariants(row.variantIds);
  if (kind.startsWith('FAVORITE_') || kind === 'LOW_STOCK') {
    const customer = await db().customer.findUnique({
      where: { email },
      select: {
        emailVerified: true,
        wishlistItems: { select: { productId: true } },
      },
    });
    if (!customer?.emailVerified) return null;
    variants = variants.filter((v) =>
      customer.wishlistItems.some((f) => f.productId === v.productId),
    );
  }
  if (kind === 'LOW_STOCK')
    variants = variants.filter((v) =>
      lowStock(v.availableQuantity, v.lowStockThreshold),
    );
  // Never repeat a recommendation for a product bought in the meantime.
  if (kind === 'COMPLEMENTS' || kind === 'POST_PURCHASE') {
    const purchased = await db().orderItem.findMany({
      where: {
        order: { email, status: 'PAID' },
        productId: { in: variants.map((v) => v.productId) },
      },
      select: { productId: true },
    });
    variants = variants.filter(
      (v) => !purchased.some((p) => p.productId === v.productId),
    );
  }
  if (!variants.length && kind !== 'WELCOME' && kind !== 'POST_PURCHASE')
    return null;
  return {
    kind,
    products: variants.slice(0, 4).map((v) => ({
      name: v.product.name,
      price: formatPrice(v.price.toFixed(2)),
      url: `${appOrigin()}/produit/${encodeURIComponent(v.product.slug)}?variant=${encodeURIComponent(v.sku)}`,
      ...(kind.startsWith('CART_')
        ? {
            quantity: Math.min(
              v.availableQuantity,
              row.quantities[row.variantIds.indexOf(v.id)] ?? 1,
            ),
          }
        : {}),
      ...(kind === 'LOW_STOCK' ? { stock: v.availableQuantity } : {}),
    })),
  };
}
export async function processLifecycleEmails(
  options: {
    deliveryId?: string;
    provider?: EmailProvider;
    settings?: ReturnType<typeof emailSettings>;
    limit?: number;
    now?: Date;
  } = {},
) {
  if (
    (process.env.LIFECYCLE_EMAILS_ENABLED !== 'true' ||
      process.env.EMAILS_ENABLED !== 'true') &&
    !options.provider
  )
    return { sent: 0, failed: 0, skipped: 0, disabled: true };
  const now = options.now ?? new Date();
  const provider = options.provider ?? resendProvider();
  const settings = options.settings ?? emailSettings();
  let sent = 0,
    failed = 0,
    skipped = 0;
  for (let i = 0; i < Math.min(options.limit ?? 5, 20); i++) {
    const row = await claim(now, options.deliveryId);
    if (!row) break;
    if ('skipped' in row) {
      skipped++;
      continue;
    }
    const owned = {
      id: row.id,
      status: 'SENDING' as const,
      leaseToken: row.leaseToken,
    };
    try {
      const current = await currentLifecycleContent(row, row.subscriber.email);
      if (!current) {
        await db().lifecycleDelivery.updateMany({
          where: owned,
          data: {
            status: 'SKIPPED',
            lastError: 'EVENEMENT_PLUS_PERTINENT',
            leaseUntil: null,
            leaseToken: null,
          },
        });
        skipped++;
        continue;
      }
      let envelope = row.envelope ? parseEnvelope(row.envelope) : null;
      if (
        envelope &&
        [
          'LOW_STOCK',
          'FAVORITE_PRICE',
          'FAVORITE_RESTOCK',
          'NEW_ARRIVAL',
        ].includes(current.kind) &&
        current.products.some(
          (product) =>
            !envelope!.text.includes(product.price) ||
            (product.stock !== undefined &&
              !envelope!.text.includes(`Plus que ${product.stock} exemplaire`)),
        )
      ) {
        await db().lifecycleDelivery.updateMany({
          where: owned,
          data: {
            status: 'SKIPPED',
            leaseUntil: null,
            leaseToken: null,
            lastError: 'CONTENU_FIGE_DEVENU_OBSOLETE',
          },
        });
        skipped++;
        continue;
      }
      if (!envelope) {
        const origin = appOrigin();
        const action = current.kind.startsWith('CART_')
          ? recoveryUrl(row.id, row.expiresAt)
          : current.kind === 'POST_PURCHASE'
            ? `${origin}/contact`
            : (current.products[0]?.url ?? `${origin}/newsletter`);
        const rendered = renderLifecycleEmail(current.kind, current.products, {
          action,
          unsubscribe: newsletterUnsubscribeUrl(row.subscriberId),
          preferences: `${origin}/compte/profil#communications`,
          logo: `${origin}/assets/brand/logo-header-no-bg.png`,
        });
        envelope = {
          from: settings.from,
          to: [settings.testRecipient ?? row.subscriber.email],
          ...rendered,
          subject: `${settings.testRecipient ? '[TEST] ' : ''}${rendered.subject}`,
          ...(settings.replyTo ? { reply_to: settings.replyTo } : {}),
        };
        const persisted = await db().lifecycleDelivery.updateMany({
          where: owned,
          data: { envelope: envelope as unknown as Prisma.InputJsonObject },
        });
        if (!persisted.count) continue;
      }
      if (settings.testRecipient && envelope.to[0] !== settings.testRecipient)
        throw new EmailProviderError('DESTINATAIRE_FIGE_DIFFERENT_DU_TEST');
      // Consent checked again immediately before contacting the provider.
      const consent = await db().newsletterSubscriber.findUnique({
        where: { id: row.subscriberId },
      });
      if (
        consent?.status !== 'ACTIVE' ||
        (personalKinds.has(current.kind) && !consent.personalizedEmails)
      ) {
        await db().lifecycleDelivery.updateMany({
          where: owned,
          data: { status: 'SKIPPED', leaseUntil: null, leaseToken: null },
        });
        skipped++;
        continue;
      }
      const result = await provider.send(
        envelope,
        `caldera-lifecycle:${row.id}`,
      );
      const changed = await db().lifecycleDelivery.updateMany({
        where: owned,
        data: {
          status: 'SENT',
          providerMessageId: result.id,
          sentAt: now,
          leaseUntil: null,
          leaseToken: null,
          lastError: null,
        },
      });
      sent += changed.count;
    } catch (error) {
      await db().lifecycleDelivery.updateMany({
        where: owned,
        data: {
          status: 'FAILED',
          leaseUntil: null,
          leaseToken: null,
          nextAttemptAt: new Date(
            now.getTime() + Math.min(60 * 2 ** row.attemptCount, 3600) * 1000,
          ),
          lastError:
            error instanceof EmailProviderError
              ? error.code
              : 'ENVOI_AUTOMATIQUE_ECHOUE',
        },
      });
      failed++;
    }
  }
  return { sent, failed, skipped, disabled: false };
}
