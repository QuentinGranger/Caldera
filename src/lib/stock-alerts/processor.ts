import 'server-only';
import { renderStockAlertNotificationEmail } from '@/emails/stock-alert';
import { languageLabels } from '@/lib/catalog/params';
import { getPrisma } from '@/lib/db/prisma';
import {
  EmailProviderError,
  emailSettings,
  resendProvider,
  type EmailProvider,
} from '@/lib/email/provider';
import { appOrigin } from '@/lib/orders/access';
import { formatPrice } from '@/utils/formatPrice';

export const MAX_STOCK_ALERT_ATTEMPTS = 5;
export const DEFAULT_STOCK_ALERT_DAILY_LIMIT = 50;
const LEASE_MS = 5 * 60_000;
const DAY_MS = 24 * 60 * 60_000;

// Resend quotas are shared with orders and the newsletter: alerts get their
// own daily ceiling; the oldest confirmed alerts go first, the rest wait.
function dailyLimit() {
  const parsed = Number.parseInt(process.env.STOCK_ALERT_DAILY_LIMIT ?? '', 10);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 1000
    ? parsed
    : DEFAULT_STOCK_ALERT_DAILY_LIMIT;
}

/** Personal data is kept only as long as it serves the alert. */
export async function purgeStockAlerts(now = new Date()) {
  const result = await getPrisma().stockAlert.deleteMany({
    where: {
      OR: [
        { status: 'PENDING', confirmationExpiresAt: { lt: now } },
        {
          status: 'NOTIFIED',
          notifiedAt: { lt: new Date(now.getTime() - 30 * DAY_MS) },
        },
        {
          status: 'FAILED',
          updatedAt: { lt: new Date(now.getTime() - 30 * DAY_MS) },
        },
        { createdAt: { lt: new Date(now.getTime() - 365 * DAY_MS) } },
      ],
    },
  });
  return result.count;
}

/**
 * One confirmed alert whose variant can be bought again (active variant with
 * stock left, published product, active category, set and game), leased so
 * that concurrent runs never send it twice.
 */
async function claim() {
  return getPrisma().$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT alert.id
      FROM "StockAlert" AS alert
      JOIN "ProductVariant" AS variant ON variant.id = alert."variantId"
      JOIN "Product" AS product ON product.id = variant."productId"
      JOIN "Category" AS category ON category.id = product."categoryId"
      LEFT JOIN "TcgSet" AS tcg ON tcg.id = product."tcgSetId"
      LEFT JOIN "Game" AS game ON game.id = product."gameId"
      WHERE ((alert.status = 'ACTIVE'::"StockAlertStatus" AND alert."nextAttemptAt" <= NOW())
          OR (alert.status = 'SENDING'::"StockAlertStatus" AND alert."leaseUntil" < NOW()))
        AND alert."attemptCount" < ${MAX_STOCK_ALERT_ATTEMPTS}
        AND variant."isActive" AND variant."availableQuantity" > 0
        AND product.status = 'ACTIVE'::"ProductStatus" AND category."isActive"
        AND (product."tcgSetId" IS NULL OR tcg."isActive")
        AND (product."gameId" IS NULL OR game."isActive")
      ORDER BY alert."confirmedAt" NULLS LAST, alert."createdAt", alert.id
      FOR UPDATE OF alert SKIP LOCKED
      LIMIT 1
    `;
    if (!rows[0]) return null;
    return tx.stockAlert.update({
      where: { id: rows[0].id },
      data: {
        status: 'SENDING',
        attemptCount: { increment: 1 },
        leaseUntil: new Date(Date.now() + LEASE_MS),
        lastError: null,
      },
      select: {
        id: true,
        email: true,
        attemptCount: true,
        variant: {
          select: {
            sku: true,
            price: true,
            language: true,
            product: { select: { name: true, slug: true } },
          },
        },
      },
    });
  });
}

/** Alerts whose delivery attempts ran out, so they stop being claimed. */
async function closeExhausted() {
  const result = await getPrisma().stockAlert.updateMany({
    where: {
      status: 'SENDING',
      leaseUntil: { lt: new Date() },
      attemptCount: { gte: MAX_STOCK_ALERT_ATTEMPTS },
    },
    data: {
      status: 'FAILED',
      leaseUntil: null,
      lastError: 'TENTATIVES_EPUISEES',
    },
  });
  return result.count;
}

/**
 * Sends the one message of each alert whose variant is back. Run every
 * minute by the maintenance job, so any restock counts (stock adjustment,
 * released reservation, cancelled order, direct database edit).
 */
export async function processStockAlerts(
  options: {
    limit?: number;
    provider?: EmailProvider;
    settings?: ReturnType<typeof emailSettings>;
  } = {},
) {
  // Without e-mails (local, tests) nothing runs, not even the database.
  if (!options.provider && process.env.EMAILS_ENABLED !== 'true')
    return {
      notified: 0,
      failed: 0,
      purged: 0,
      quotaLimited: false,
      disabled: true,
    };
  const purged = await purgeStockAlerts();
  const provider = options.provider ?? resendProvider();
  const settings = options.settings ?? emailSettings();
  const exhausted = await closeExhausted();
  const sentSince = await getPrisma().stockAlert.count({
    where: {
      status: 'NOTIFIED',
      notifiedAt: { gte: new Date(Date.now() - DAY_MS) },
    },
  });
  const remaining = Math.max(0, dailyLimit() - sentSince);
  const batch = Math.min(options.limit ?? 20, 50, remaining);
  let notified = 0;
  let failed = exhausted;
  for (let index = 0; index < batch; index++) {
    const alert = await claim();
    if (!alert) break;
    const owned = { id: alert.id, status: 'SENDING' as const };
    try {
      const product = alert.variant.product;
      const rendered = renderStockAlertNotificationEmail(
        {
          name: product.name,
          language: languageLabels[alert.variant.language],
          price: formatPrice(alert.variant.price.toFixed(2)),
        },
        {
          product: `${appOrigin()}/produit/${product.slug}?variant=${encodeURIComponent(alert.variant.sku)}`,
          logo: `${appOrigin()}/assets/brand/logo-header-no-bg.png`,
        },
      );
      // Same key on every attempt: a crash after sending never sends twice.
      const result = await provider.send(
        {
          from: settings.from,
          to: [settings.testRecipient ?? alert.email],
          ...(settings.replyTo ? { reply_to: settings.replyTo } : {}),
          subject: `${settings.testRecipient ? '[TEST] ' : ''}${rendered.subject}`,
          html: rendered.html,
          text: rendered.text,
        },
        `caldera-stock-alert:${alert.id}`,
      );
      const updated = await getPrisma().stockAlert.updateMany({
        where: owned,
        data: {
          status: 'NOTIFIED',
          notifiedAt: new Date(),
          providerMessageId: result.id,
          leaseUntil: null,
        },
      });
      notified += updated.count;
    } catch (error) {
      const last = alert.attemptCount >= MAX_STOCK_ALERT_ATTEMPTS;
      await getPrisma().stockAlert.updateMany({
        where: owned,
        data: {
          status: last ? 'FAILED' : 'ACTIVE',
          leaseUntil: null,
          lastError:
            error instanceof EmailProviderError
              ? error.code
              : 'ENVOI_ALERTE_ECHOUE',
          nextAttemptAt: new Date(
            Date.now() +
              Math.min(60 * 2 ** (alert.attemptCount - 1), 3600) * 1000,
          ),
        },
      });
      failed++;
    }
  }
  return {
    notified,
    failed,
    purged,
    quotaLimited: remaining === 0,
    disabled: false,
  };
}

/**
 * After a catalogue change in the administration: whoever waited for a
 * variant back in stock hears of it now, not at the next nightly run. Never
 * throws (e-mails off, provider down): the nightly run catches up.
 */
export async function safelyProcessStockAlerts() {
  try {
    return await processStockAlerts({ limit: 20 });
  } catch (error) {
    console.error('Stock alert processor unavailable', {
      code:
        error instanceof EmailProviderError
          ? error.code
          : 'STOCK_ALERTS_UNAVAILABLE',
    });
    return null;
  }
}
