import 'server-only';
import { getPrisma } from '@/lib/db/prisma';
import { clearSubscriberEngagement } from '@/lib/email/engagement';

/** Shared by the visible confirmation form and RFC 8058 POST. */
export async function unsubscribeNewsletter(id: string) {
  await getPrisma().newsletterSubscriber.updateMany({
    where: { id },
    data: {
      status: 'UNSUBSCRIBED',
      emailTracking: false,
      emailTrackingConsentAt: null,
      emailTrackingConsentVersion: null,
      personalizedEmails: false,
      personalizedConsentAt: null,
      unsubscribedAt: new Date(),
      confirmationTokenHash: null,
      confirmationExpiresAt: null,
    },
  });
  await clearSubscriberEngagement(id);
}
