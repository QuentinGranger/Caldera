import 'server-only';
import { createHash } from 'node:crypto';
import type { Prisma } from '@/generated/prisma/client';
import { storefrontProductWhere } from '@/lib/admin/storefront';
import { getPrisma } from '@/lib/db/prisma';
import {
  renderDiscordPublication,
  type DiscordPublication,
  type DiscordPublicationKind,
} from './publication';
import {
  discordWebhookUrl,
  sendDiscordPublication,
  webhookVariables,
} from './webhook';
import { siteOrigin } from '@/lib/site';

export function discordEnabled() {
  return (
    process.env.DISCORD_PUBLICATIONS_ENABLED === 'true' &&
    (process.env.NODE_ENV !== 'production' || process.env.STORE_OPEN === '1')
  );
}
export function discordConfigured(kind: DiscordPublicationKind) {
  return Boolean(discordWebhookUrl(process.env[webhookVariables[kind]]));
}
// Product names may exceed Discord's title limit; notifications must not block stock edits.
export function discordProductTitle(name: string) {
  return name
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
}
export function restockEventKey(productId: string, now = new Date()) {
  // One public restock per product and hour, across variants and instances.
  return `restock:${productId}:${now.toISOString().slice(0, 13)}`;
}
export async function enqueueDiscord(
  tx: Prisma.TransactionClient,
  eventKey: string,
  publication: DiscordPublication,
  options: { productId?: string; nextAttemptAt?: Date } = {},
) {
  renderDiscordPublication(publication, siteOrigin());
  return tx.discordOutbox.createMany({
    data: [{ eventKey, ...publication, ...options }],
    skipDuplicates: true,
  });
}
export async function queueProductRelease(
  tx: Prisma.TransactionClient,
  productId: string,
) {
  if (!discordEnabled()) return;
  const p = await tx.product.findFirst({
    where: {
      id: productId,
      ...storefrontProductWhere,
      newArrival: true,
      releaseDate: { not: null },
    },
    select: { name: true, slug: true, releaseDate: true, publishedAt: true },
  });
  if (!p?.releaseDate) return;
  await enqueueDiscord(
    tx,
    `release:${productId}`,
    {
      kind: 'release',
      title: discordProductTitle(p.name),
      summary: 'Découvrez ce produit et sa disponibilité sur Caldera.',
      path: `/produit/${p.slug}`,
    },
    {
      productId,
      nextAttemptAt: new Date(
        Math.max(
          Date.now(),
          p.releaseDate.getTime(),
          p.publishedAt?.getTime() ?? 0,
        ),
      ),
    },
  );
}
export async function queueProductRestock(
  tx: Prisma.TransactionClient,
  productId: string,
) {
  if (!discordEnabled()) return;
  const p = await tx.product.findFirst({
    where: {
      id: productId,
      ...storefrontProductWhere,
      preorder: false,
      variants: {
        some: {
          isActive: true,
          price: { gt: 0 },
          availableQuantity: { gt: 0 },
        },
      },
    },
    select: { name: true, slug: true },
  });
  if (!p) return;
  await enqueueDiscord(
    tx,
    restockEventKey(productId),
    {
      kind: 'restock',
      title: discordProductTitle(p.name),
      summary:
        'Ce produit est de retour en stock. Consultez la disponibilité sur Caldera.',
      path: `/produit/${p.slug}`,
    },
    { productId },
  );
}

/** A lease abandoned after a crash is uncertain, never automatically resent. */
export async function claimDiscordPublication(now = new Date()) {
  const db = getPrisma();
  await db.discordOutbox.updateMany({
    where: {
      status: 'PROCESSING',
      lockedAt: { lt: new Date(now.getTime() - 120_000) },
    },
    data: { status: 'REVIEW', errorCode: 'LEASE_EXPIRED', lockedAt: null },
  });
  const configured = (
    Object.keys(webhookVariables) as DiscordPublicationKind[]
  ).filter(discordConfigured);
  if (!configured.length) return null;
  const rows = await db.$queryRaw<{ id: string }[]>`
    UPDATE "DiscordOutbox" SET status = 'PROCESSING', "lockedAt" = ${now},
      attempts = attempts + 1, "updatedAt" = ${now}
    WHERE id = (SELECT id FROM "DiscordOutbox"
      WHERE status IN ('PENDING','RETRY') AND "nextAttemptAt" <= ${now}
        AND kind = ANY(${configured}::text[])
        AND NOT EXISTS (SELECT 1 FROM "DiscordOutbox" WHERE status IN ('RETRY','REVIEW')
          AND "errorCode" IN ('RATE_LIMIT','RATE_LIMIT_EXHAUSTED') AND "nextAttemptAt" > ${now})
      ORDER BY "nextAttemptAt", "createdAt", id FOR UPDATE SKIP LOCKED LIMIT 1)
    RETURNING id`;
  return rows[0]
    ? db.discordOutbox.findUnique({ where: { id: rows[0].id } })
    : null;
}

export async function processDiscordOutbox(
  options: { limit?: number; fetcher?: typeof fetch } = {},
) {
  const counts = {
    sent: 0,
    retry: 0,
    review: 0,
    rejected: 0,
    cancelled: 0,
    disabled: !discordEnabled(),
  };
  if (counts.disabled) return counts;
  const db = getPrisma();
  for (let i = 0; i < Math.min(Math.max(options.limit ?? 5, 1), 5); i++) {
    const event = await claimDiscordPublication();
    if (!event) break;
    try {
      let publication: DiscordPublication = {
        kind: event.kind as DiscordPublicationKind,
        title: event.title,
        summary: event.summary,
        path: event.path,
      };
      if (event.productId) {
        const p = await db.product.findFirst({
          where: { id: event.productId, ...storefrontProductWhere },
          select: {
            name: true,
            slug: true,
            releaseDate: true,
            publishedAt: true,
            newArrival: true,
            variants: {
              where: { isActive: true, price: { gt: 0 } },
              select: { availableQuantity: true },
            },
          },
        });
        if (
          !p ||
          (event.kind === 'release' && (!p.newArrival || !p.releaseDate)) ||
          (event.kind === 'restock' &&
            !p.variants.some((v) => v.availableQuantity > 0))
        ) {
          await db.discordOutbox.updateMany({
            where: {
              id: event.id,
              status: 'PROCESSING',
              lockedAt: event.lockedAt,
            },
            data: {
              status: 'CANCELLED',
              errorCode: 'NO_LONGER_PUBLIC_OR_AVAILABLE',
              lockedAt: null,
            },
          });
          counts.cancelled++;
          continue;
        }
        if (
          event.kind === 'release' &&
          Math.max(
            p.releaseDate?.getTime() ?? 0,
            p.publishedAt?.getTime() ?? 0,
          ) > Date.now()
        ) {
          await db.discordOutbox.updateMany({
            where: {
              id: event.id,
              status: 'PROCESSING',
              lockedAt: event.lockedAt,
            },
            data: {
              status: 'PENDING',
              lockedAt: null,
              nextAttemptAt: new Date(
                Math.max(
                  p.releaseDate?.getTime() ?? 0,
                  p.publishedAt?.getTime() ?? 0,
                ),
              ),
            },
          });
          continue;
        }
        publication = {
          ...publication,
          title: discordProductTitle(p.name),
          path: `/produit/${p.slug}`,
        };
      }
      const result = await sendDiscordPublication(publication, {
        fetcher: options.fetcher,
        origin: siteOrigin(),
      });
      if (result.status === 'sent') {
        await db.discordOutbox.updateMany({
          where: {
            id: event.id,
            status: 'PROCESSING',
            lockedAt: event.lockedAt,
          },
          data: {
            status: 'SENT',
            messageId: result.messageId,
            lockedAt: null,
            errorCode: null,
          },
        });
        counts.sent++;
      } else if (result.status === 'retry') {
        const exhausted = event.attempts >= 8;
        await db.discordOutbox.updateMany({
          where: {
            id: event.id,
            status: 'PROCESSING',
            lockedAt: event.lockedAt,
          },
          data: {
            status: exhausted ? 'REVIEW' : 'RETRY',
            lockedAt: null,
            errorCode: exhausted ? 'RATE_LIMIT_EXHAUSTED' : 'RATE_LIMIT',
            nextAttemptAt: new Date(
              Date.now() +
                (result.retryAfterMs ??
                  Math.min(60_000 * 2 ** event.attempts, 3_600_000)),
            ),
          },
        });
        if (exhausted) counts.review++;
        else counts.retry++;
        break; // Respect Discord's bucket/global cooldown for the whole batch.
      } else {
        const status = result.status === 'rejected' ? 'REJECTED' : 'REVIEW';
        await db.discordOutbox.updateMany({
          where: {
            id: event.id,
            status: 'PROCESSING',
            lockedAt: event.lockedAt,
          },
          data: {
            status,
            lockedAt: null,
            errorCode:
              status === 'REJECTED' ? 'DISCORD_REJECTED' : 'DELIVERY_UNCERTAIN',
          },
        });
        if (status === 'REJECTED') counts.rejected++;
        else counts.review++;
      }
    } catch {
      // Never log a webhook URL, provider response, content or customer data.
      await db.discordOutbox.updateMany({
        where: { id: event.id, status: 'PROCESSING', lockedAt: event.lockedAt },
        data: {
          status: 'REVIEW',
          lockedAt: null,
          errorCode: 'DELIVERY_UNCERTAIN',
        },
      });
      counts.review++;
    }
  }
  return counts;
}
export async function safelyProcessDiscordOutbox() {
  try {
    const counts = await processDiscordOutbox();
    console.info(JSON.stringify({ scope: 'discord_outbox', ...counts }));
  } catch {
    console.error(
      JSON.stringify({ scope: 'discord_outbox', code: 'PROCESSING_FAILED' }),
    );
  }
}
export function manualEventKey(publication: DiscordPublication) {
  return (
    'editorial:' +
    createHash('sha256').update(JSON.stringify(publication)).digest('hex')
  );
}
