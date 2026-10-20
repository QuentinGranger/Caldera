import 'server-only';
import { getPrisma } from '@/lib/db/prisma';
import { clearSubscriberEngagement } from './engagement';

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

/** Operational feedback, never an analytics event. No recipient or raw diagnostic is retained. */
export function emailDeliveryFeedback(payload: unknown, now = new Date()) {
  if (!payload || typeof payload !== 'object') return null;
  const event = payload as {
    type?: unknown;
    created_at?: unknown;
    data?: { email_id?: unknown; bounce?: { type?: unknown }; tags?: unknown };
  };
  const reason =
    event.type === 'email.complained'
      ? 'SPAM_COMPLAINT'
      : event.type === 'email.suppressed'
        ? 'SUPPRESSED'
        : event.type === 'email.bounced' &&
            event.data?.bounce?.type === 'Permanent'
          ? 'HARD_BOUNCE'
          : null;
  if (
    !reason ||
    typeof event.data?.email_id !== 'string' ||
    !uuid.test(event.data.email_id) ||
    typeof event.created_at !== 'string'
  )
    return null;
  const occurredAt = new Date(event.created_at);
  if (
    !Number.isFinite(occurredAt.getTime()) ||
    occurredAt.getTime() > now.getTime() + 60_000 ||
    occurredAt.getTime() < now.getTime() - 90 * 86400000
  )
    return null;
  const tags = event.data.tags;
  const tag = (key: string): unknown =>
    Array.isArray(tags)
      ? tags.find(
          (value) => value && typeof value === 'object' && value.name === key,
        )?.value
      : tags && typeof tags === 'object'
        ? (tags as Record<string, unknown>)[key]
        : undefined;
  const id = tag('caldera_delivery');
  return {
    messageId: event.data.email_id,
    occurredAt,
    reason,
    deliveryId: typeof id === 'string' && uuid.test(id) ? id : null,
    kind: tag('caldera_kind'),
  };
}

/** Call only after Svix verification. A matching local delivery is mandatory. */
export async function recordEmailDeliveryFeedback(payload: unknown) {
  const feedback = emailDeliveryFeedback(payload);
  if (!feedback) return;
  const { messageId, occurredAt, reason } = feedback;
  const error = `EMAIL_${reason}`;
  // Each write commits before locking another queue: send workers lock delivery
  // rows before subscribers. Holding a subscriber lock across queue updates
  // would invert that order and risk deadlocks. Retries are idempotent.
  const subscriberId = await (async () => {
    const db = getPrisma();
    const deliveryWhere = (kind: string) => ({
      OR: [
        { providerMessageId: messageId },
        ...(feedback.kind === kind && feedback.deliveryId
          ? [
              {
                id: feedback.deliveryId,
                providerMessageId: null,
                firstAttemptAt: { lte: occurredAt },
              },
            ]
          : []),
      ],
    });
    const campaign = await db.newsletterCampaignDelivery.findFirst({
      where: deliveryWhere('campaign'),
    });
    const lifecycle = campaign
      ? null
      : await db.lifecycleDelivery.findFirst({
          where: deliveryWhere('lifecycle'),
        });
    const order =
      campaign || lifecycle
        ? null
        : await db.emailDelivery.findFirst({
            where: { providerMessageId: messageId },
          });
    const stock =
      campaign || lifecycle || order
        ? null
        : await db.stockAlert.findFirst({
            where: { providerMessageId: messageId },
          });
    const source = campaign ?? lifecycle ?? order ?? stock;
    if (!source || occurredAt < source.createdAt) return null;
    const email = campaign?.recipient ?? order?.recipient ?? stock?.email;
    const subscriber = lifecycle
      ? await db.newsletterSubscriber.findUnique({
          where: { id: lifecycle.subscriberId },
        })
      : email
        ? await db.newsletterSubscriber.findFirst({
            where: { email: { equals: email, mode: 'insensitive' } },
          })
        : null;
    // An old webhook must never undo a newer opt-in, even when replayed.
    const currentConsent =
      subscriber &&
      subscriber.consentAt <= occurredAt &&
      (!subscriber.confirmedAt || subscriber.confirmedAt <= occurredAt);
    if (currentConsent) {
      const updated = await db.newsletterSubscriber.updateMany({
        where: {
          id: subscriber.id,
          consentAt: { lte: occurredAt },
          OR: [{ confirmedAt: null }, { confirmedAt: { lte: occurredAt } }],
        },
        data: {
          status: 'UNSUBSCRIBED',
          unsubscribedAt: occurredAt,
          personalizedEmails: false,
          personalizedConsentAt: null,
          emailTracking: false,
          emailTrackingConsentAt: null,
          emailTrackingConsentVersion: null,
          confirmationTokenHash: null,
          confirmationExpiresAt: null,
        },
      });
      if (updated.count) {
        await db.newsletterCampaignDelivery.updateMany({
          where: {
            subscriberId: subscriber.id,
            subscriber: {
              status: 'UNSUBSCRIBED',
              consentAt: { lte: occurredAt },
            },
            status: { in: ['PENDING', 'FAILED', 'SENDING'] },
          },
          data: {
            status: 'SKIPPED',
            retryBlocked: true,
            lastError: error,
            leaseToken: null,
            leaseUntil: null,
          },
        });
        await db.lifecycleDelivery.updateMany({
          where: {
            subscriberId: subscriber.id,
            subscriber: {
              status: 'UNSUBSCRIBED',
              consentAt: { lte: occurredAt },
            },
            status: { in: ['PENDING', 'FAILED', 'SENDING'] },
          },
          data: {
            status: 'SKIPPED',
            lastError: error,
            leaseToken: null,
            leaseUntil: null,
          },
        });
      }
    }
    const recipient = email ?? subscriber?.email;
    if (recipient)
      await db.stockAlert.updateMany({
        where: {
          email: { equals: recipient, mode: 'insensitive' },
          createdAt: { lte: occurredAt },
          OR: [{ confirmedAt: null }, { confirmedAt: { lte: occurredAt } }],
          status: { in: ['PENDING', 'ACTIVE', 'SENDING'] },
        },
        data: { status: 'FAILED', leaseUntil: null, lastError: error },
      });
    if (campaign)
      await db.newsletterCampaignDelivery.updateMany({
        where: { id: campaign.id, ...deliveryWhere('campaign') },
        data: {
          status: 'FAILED',
          providerMessageId: messageId,
          retryBlocked: true,
          lastError: error,
          leaseToken: null,
          leaseUntil: null,
        },
      });
    if (lifecycle)
      await db.lifecycleDelivery.updateMany({
        where: { id: lifecycle.id, ...deliveryWhere('lifecycle') },
        data: {
          status: 'SKIPPED',
          providerMessageId: messageId,
          lastError: error,
          leaseToken: null,
          leaseUntil: null,
        },
      });
    if (order)
      await db.emailDelivery.updateMany({
        where: { id: order.id, providerMessageId: messageId },
        data: {
          status: 'FAILED',
          retryBlocked: true,
          lastError: error,
          leaseToken: null,
          leaseUntil: null,
        },
      });
    if (stock)
      await db.stockAlert.updateMany({
        where: { id: stock.id, providerMessageId: messageId },
        data: { status: 'FAILED', leaseUntil: null, lastError: error },
      });
    return currentConsent ? subscriber.id : null;
  })();
  if (subscriberId) await clearSubscriberEngagement(subscriberId);
}
