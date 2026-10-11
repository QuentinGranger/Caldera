import 'server-only';
import type {
  NewsletterCampaignDelivery,
  LifecycleDelivery,
  NewsletterSubscriber,
} from '@/generated/prisma/client';
import { getPrisma } from '@/lib/db/prisma';
import { trackingAllowed } from './engagement';
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
/** Receives an already signature-verified payload. Never stores IP, UA, recipient or clicked URL. */
export async function recordEmailEngagement(payload: unknown) {
  if (!payload || typeof payload !== 'object') return;
  const event = payload as {
    type?: unknown;
    created_at?: unknown;
    data?: { email_id?: unknown; tags?: unknown };
  };
  const field =
    event.type === 'email.opened'
      ? 'openedAt'
      : event.type === 'email.clicked'
        ? 'clickedAt'
        : event.type === 'email.delivered'
          ? 'deliveredAt'
          : null;
  if (
    !field ||
    typeof event.data?.email_id !== 'string' ||
    !uuid.test(event.data.email_id)
  )
    return;
  if (typeof event.created_at !== 'string') return;
  const occurredAt = new Date(event.created_at);
  const now = new Date();
  if (
    !Number.isFinite(occurredAt.getTime()) ||
    occurredAt.getTime() > now.getTime() + 60000 ||
    occurredAt.getTime() < now.getTime() - 90 * 86400000
  )
    return;
  // Resend supplies tags as a map in webhook events; tolerate its array representation as well.
  const tags = event.data.tags;
  const tag = (name: string) =>
    Array.isArray(tags)
      ? tags.find((x) => x && x.name === name)?.value
      : tags && typeof tags === 'object'
        ? (tags as Record<string, unknown>)[name]
        : undefined;
  const deliveryId = tag('caldera_delivery');
  const kind = tag('caldera_kind');
  const db = getPrisma();
  for (const type of ['campaign', 'lifecycle'] as const) {
    const where: { id?: string; providerMessageId?: string } =
      typeof deliveryId === 'string' && uuid.test(deliveryId) && kind === type
        ? { id: deliveryId }
        : { providerMessageId: event.data.email_id };
    const row:
      | ((NewsletterCampaignDelivery | LifecycleDelivery) & {
          subscriber: NewsletterSubscriber;
        })
      | null =
      type === 'campaign'
        ? await db.newsletterCampaignDelivery.findFirst({
            where,
            include: { subscriber: true },
          })
        : await db.lifecycleDelivery.findFirst({
            where,
            include: { subscriber: true },
          });
    if (
      !row ||
      !row.trackingEnabled ||
      !row.trackingConsentAt ||
      !trackingAllowed(row.subscriber, now) ||
      !row.subscriber.emailTrackingConsentAt ||
      row.subscriber.emailTrackingConsentAt > row.trackingConsentAt ||
      (row.providerMessageId &&
        row.providerMessageId !== event.data.email_id) ||
      !row.firstAttemptAt ||
      occurredAt < row.firstAttemptAt ||
      row.firstAttemptAt.getTime() < now.getTime() - 90 * 86400000
    )
      continue;
    const data = {
      [field]: occurredAt,
      ...(!row.deliveredAt && field !== 'deliveredAt'
        ? { deliveredAt: occurredAt }
        : {}),
    };
    // First observation only: duplicates and replays never inflate the counts.
    const updateWhere = { id: row.id, trackingEnabled: true, [field]: null };
    if (type === 'campaign')
      await db.newsletterCampaignDelivery.updateMany({
        where: updateWhere,
        data,
      });
    else await db.lifecycleDelivery.updateMany({ where: updateWhere, data });
    return;
  }
}
