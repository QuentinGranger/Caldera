import 'server-only';
import { getPrisma } from '@/lib/db/prisma';
import { EmailProviderError, type EmailEnvelope } from './provider';
export const EMAIL_TRACKING_VERSION = '2026-10-11-v1';
export const TRACKING_DAYS = 180;
type Consent = {
  status: string;
  emailTracking: boolean;
  emailTrackingConsentAt: Date | null;
};
export function trackingAllowed(consent: Consent | null, now = new Date()) {
  return Boolean(
    consent?.status === 'ACTIVE' &&
    consent.emailTracking &&
    consent.emailTrackingConsentAt &&
    consent.emailTrackingConsentAt <= now &&
    now.getTime() - consent.emailTrackingConsentAt.getTime() <
      TRACKING_DAYS * 86400000,
  );
}
export function marketingSender(consent: Consent | null, fallback: string) {
  if (
    process.env.EMAIL_ENGAGEMENT_ENABLED !== 'true' ||
    !trackingAllowed(consent)
  )
    return { from: fallback, tracked: false };
  const from = process.env.MARKETING_EMAIL_FROM?.trim() ?? '';
  // Only this verified, dedicated domain may have tracking enabled.
  if (!/^(?:[^<>\r\n]+ <)?[^\s<>@]+@news\.lesterresdecaldera\.fr>?$/.test(from))
    throw new EmailProviderError('EXPEDITEUR_MARKETING_INVALIDE');
  return { from, tracked: true };
}
export function trackingTags(
  id: string,
  kind: 'campaign' | 'lifecycle',
): EmailEnvelope['tags'] {
  return [
    { name: 'caldera_delivery', value: id },
    { name: 'caldera_kind', value: kind },
  ];
}
export async function clearSubscriberEngagement(subscriberId: string) {
  const data = {
    trackingEnabled: false,
    trackingConsentAt: null,
    openedAt: null,
    clickedAt: null,
  };
  await getPrisma().$transaction([
    getPrisma().newsletterCampaignDelivery.updateMany({
      where: { subscriberId },
      data,
    }),
    getPrisma().lifecycleDelivery.updateMany({ where: { subscriberId }, data }),
    getPrisma().carnetEmailClick.deleteMany({
      where: { delivery: { subscriberId } },
    }),
  ]);
}
export async function purgeEmailEngagement() {
  const cutoff = new Date(Date.now() - 90 * 86400000);
  const data = {
    trackingEnabled: false,
    trackingConsentAt: null,
    openedAt: null,
    clickedAt: null,
    deliveredAt: null,
  };
  const result = await getPrisma().$transaction([
    getPrisma().newsletterCampaignDelivery.updateMany({
      where: { sentAt: { lt: cutoff }, trackingEnabled: true },
      data,
    }),
    getPrisma().lifecycleDelivery.updateMany({
      where: { sentAt: { lt: cutoff }, trackingEnabled: true },
      data,
    }),
  ]);
  await getPrisma().carnetEmailClick.deleteMany({
    where: {
      OR: [
        { clickedAt: { lt: cutoff } },
        { delivery: { trackingEnabled: false } },
      ],
    },
  });
  return { emailEngagementPurged: result.reduce((n, r) => n + r.count, 0) };
}
