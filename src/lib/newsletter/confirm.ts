import 'server-only';
import { getPrisma } from '@/lib/db/prisma';
import { validNewsletterChannel } from './acquisition';
import { confirmationDay } from './radar';

/** Count the confirmation exactly once, in the transaction that consumes its token. */
export async function confirmNewsletterToken(
  tokenHash: string,
  now = new Date(),
) {
  const where = {
    confirmationTokenHash: tokenHash,
    status: 'PENDING' as const,
    confirmationExpiresAt: { gt: now },
  };
  return getPrisma().$transaction(async (tx) => {
    const rows = await tx.newsletterSubscriber.updateManyAndReturn({
      where,
      data: {
        status: 'ACTIVE',
        confirmedAt: now,
        lastInterestAt: now,
        confirmationTokenHash: null,
        confirmationExpiresAt: null,
      },
      select: { id: true, pendingAcquisitionChannel: true },
    });
    const row = rows[0];
    if (!row) return false;
    const day = confirmationDay(now);
    const channel = validNewsletterChannel(row.pendingAcquisitionChannel);
    await tx.newsletterConfirmationDaily.upsert({
      where: { day_channel: { day, channel } },
      create: { day, channel, count: 1 },
      update: { count: { increment: 1 } },
    });
    await tx.newsletterSubscriber.update({
      where: { id: row.id },
      data: { pendingAcquisitionChannel: null },
    });
    return true;
  });
}
