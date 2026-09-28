import 'server-only';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@/generated/prisma/client';
import { renderNewsletterCampaignEmail } from '@/emails/newsletter-campaign';
import { getPrisma } from '@/lib/db/prisma';
import {
  emailSettings,
  EmailProviderError,
  parseEnvelope,
  resendProvider,
  type EmailEnvelope,
  type EmailProvider,
} from '@/lib/email/provider';
import { appOrigin } from '@/lib/orders/access';
import { newsletterUnsubscribeUrl } from './tokens';

export const MAX_NEWSLETTER_ATTEMPTS = 5;
export const DEFAULT_NEWSLETTER_DAILY_LIMIT = 80;
const LEASE_MS = 5 * 60_000;
const IDEMPOTENCY_WINDOW_MS = 23 * 60 * 60_000;

function dailyLimit() {
  const parsed = Number.parseInt(process.env.NEWSLETTER_DAILY_LIMIT ?? '', 10);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 500
    ? parsed
    : DEFAULT_NEWSLETTER_DAILY_LIMIT;
}

async function skipInactiveRecipients() {
  return getPrisma().$executeRaw`
    UPDATE "NewsletterCampaignDelivery" AS delivery
    SET status = 'SKIPPED'::"NewsletterDeliveryStatus", "lastError" = 'ABONNEMENT_INACTIF', "updatedAt" = NOW()
    FROM "NewsletterSubscriber" AS subscriber
    WHERE delivery."subscriberId" = subscriber.id
      AND subscriber.status <> 'ACTIVE'::"NewsletterStatus"
      AND delivery.status IN ('PENDING'::"NewsletterDeliveryStatus", 'FAILED'::"NewsletterDeliveryStatus")
  `;
}

async function claim() {
  const db = getPrisma();
  return db.$transaction(async (tx) => {
    await tx.newsletterCampaignDelivery.updateMany({
      where: {
        status: { in: ['PENDING', 'SENDING', 'FAILED'] },
        firstAttemptAt: { lt: new Date(Date.now() - IDEMPOTENCY_WINDOW_MS) },
        retryBlocked: false,
      },
      data: {
        status: 'FAILED',
        retryBlocked: true,
        lastError: 'DELAI_IDEMPOTENCE_DEPASSE_VERIFICATION_FOURNISSEUR_REQUISE',
        leaseUntil: null,
        leaseToken: null,
      },
    });
    await tx.newsletterCampaignDelivery.updateMany({
      where: {
        status: 'SENDING',
        leaseUntil: { lt: new Date() },
        attemptCount: { gte: MAX_NEWSLETTER_ATTEMPTS },
      },
      data: {
        status: 'FAILED',
        retryBlocked: true,
        lastError: 'TENTATIVES_EPUISEES_VERIFICATION_FOURNISSEUR_REQUISE',
        leaseUntil: null,
        leaseToken: null,
      },
    });
    const candidates = await tx.$queryRaw<{ id: string }[]>`
      SELECT delivery.id
      FROM "NewsletterCampaignDelivery" AS delivery
      JOIN "NewsletterCampaign" AS campaign ON campaign.id = delivery."campaignId"
      WHERE campaign.status IN ('QUEUED'::"NewsletterCampaignStatus", 'SENDING'::"NewsletterCampaignStatus")
        AND delivery."retryBlocked" = false
        AND delivery."attemptCount" < ${MAX_NEWSLETTER_ATTEMPTS}
        AND ((delivery.status IN ('PENDING'::"NewsletterDeliveryStatus", 'FAILED'::"NewsletterDeliveryStatus") AND delivery."nextAttemptAt" <= NOW())
          OR (delivery.status = 'SENDING'::"NewsletterDeliveryStatus" AND delivery."leaseUntil" < NOW()))
      ORDER BY delivery."createdAt", delivery.id
      FOR UPDATE OF delivery SKIP LOCKED
      LIMIT 1
    `;
    if (!candidates[0]) return null;
    const current = await tx.newsletterCampaignDelivery.findUniqueOrThrow({
      where: { id: candidates[0].id },
      include: { campaign: true, subscriber: { select: { status: true } } },
    });
    if (current.subscriber.status !== 'ACTIVE') {
      await tx.newsletterCampaignDelivery.update({
        where: { id: current.id },
        data: { status: 'SKIPPED', lastError: 'ABONNEMENT_INACTIF' },
      });
      return null;
    }
    const leaseToken = randomUUID();
    const delivery = await tx.newsletterCampaignDelivery.update({
      where: { id: current.id },
      data: {
        status: 'SENDING',
        attemptCount: { increment: 1 },
        leaseUntil: new Date(Date.now() + LEASE_MS),
        leaseToken,
        firstAttemptAt: current.firstAttemptAt ?? new Date(),
        lastError: null,
      },
      include: { campaign: true },
    });
    if (delivery.campaign.status === 'QUEUED')
      await tx.newsletterCampaign.update({
        where: { id: delivery.campaignId },
        data: { status: 'SENDING' },
      });
    return delivery;
  });
}

async function finalizeCampaigns() {
  const db = getPrisma();
  const campaigns = await db.newsletterCampaign.findMany({
    where: { status: { in: ['QUEUED', 'SENDING'] } },
    select: { id: true },
  });
  let completed = 0;
  for (const campaign of campaigns) {
    const remaining = await db.newsletterCampaignDelivery.count({
      where: {
        campaignId: campaign.id,
        OR: [
          { status: { in: ['PENDING', 'SENDING'] } },
          {
            status: 'FAILED',
            retryBlocked: false,
            attemptCount: { lt: MAX_NEWSLETTER_ATTEMPTS },
          },
        ],
      },
    });
    if (!remaining) {
      const result = await db.newsletterCampaign.updateMany({
        where: { id: campaign.id, status: { in: ['QUEUED', 'SENDING'] } },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      completed += result.count;
    }
  }
  return completed;
}

export async function processNewsletterDeliveries(
  options: {
    limit?: number;
    provider?: EmailProvider;
    settings?: ReturnType<typeof emailSettings>;
  } = {},
) {
  if (!options.provider && process.env.EMAILS_ENABLED !== 'true')
    return {
      sent: 0,
      failed: 0,
      skipped: 0,
      completed: 0,
      quotaLimited: false,
      disabled: true,
    };
  const provider = options.provider ?? resendProvider();
  const settings = options.settings ?? emailSettings();
  const skipped = await skipInactiveRecipients();
  const sentSince = await getPrisma().newsletterCampaignDelivery.count({
    where: {
      status: 'SENT',
      sentAt: { gte: new Date(Date.now() - 24 * 60 * 60_000) },
    },
  });
  const remainingQuota = Math.max(0, dailyLimit() - sentSince);
  const batch = Math.min(options.limit ?? 10, 25, remainingQuota);
  let sent = 0;
  let failed = 0;
  for (let index = 0; index < batch; index++) {
    const delivery = await claim();
    if (!delivery) break;
    const owned = {
      id: delivery.id,
      status: 'SENDING' as const,
      leaseToken: delivery.leaseToken,
    };
    try {
      let envelope: EmailEnvelope;
      if (delivery.envelope) envelope = parseEnvelope(delivery.envelope);
      else {
        const rendered = renderNewsletterCampaignEmail(delivery.campaign, {
          logo: `${appOrigin()}/assets/brand/logo-header-no-bg.png`,
          unsubscribe: newsletterUnsubscribeUrl(delivery.subscriberId),
        });
        envelope = {
          from: settings.from,
          to: [settings.testRecipient ?? delivery.recipient],
          ...(settings.replyTo ? { reply_to: settings.replyTo } : {}),
          subject: `${settings.testRecipient ? '[TEST] ' : ''}${rendered.subject}`,
          html: rendered.html,
          text: rendered.text,
        };
        const persisted =
          await getPrisma().newsletterCampaignDelivery.updateMany({
            where: owned,
            data: {
              envelope: envelope as unknown as Prisma.InputJsonObject,
              provider: provider.name,
            },
          });
        if (!persisted.count) continue;
      }
      if (settings.testRecipient && envelope.to[0] !== settings.testRecipient)
        throw new EmailProviderError('DESTINATAIRE_FIGE_DIFFERENT_DU_TEST');
      const result = await provider.send(
        envelope,
        `caldera-newsletter:${delivery.id}`,
      );
      const updated = await getPrisma().newsletterCampaignDelivery.updateMany({
        where: owned,
        data: {
          status: 'SENT',
          providerMessageId: result.id,
          sentAt: new Date(),
          leaseUntil: null,
          leaseToken: null,
        },
      });
      sent += updated.count;
    } catch (error) {
      await getPrisma().newsletterCampaignDelivery.updateMany({
        where: owned,
        data: {
          status: 'FAILED',
          lastError:
            error instanceof EmailProviderError
              ? error.code
              : 'TRAITEMENT_NEWSLETTER_ECHOUE',
          nextAttemptAt: new Date(
            Date.now() +
              Math.min(60 * 2 ** (delivery.attemptCount - 1), 3600) * 1000,
          ),
          leaseUntil: null,
          leaseToken: null,
        },
      });
      failed++;
    }
  }
  const completed = await finalizeCampaigns();
  return {
    sent,
    failed,
    skipped,
    completed,
    quotaLimited: remainingQuota === 0,
    disabled: false,
  };
}
