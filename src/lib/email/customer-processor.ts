import 'server-only';
import { randomUUID } from 'node:crypto';
import { getPrisma } from '@/lib/db/prisma';
import { emailSettings, resendProvider } from './provider';

const MAX_ATTEMPTS = 5;
const LEASE_MS = 5 * 60_000;

export async function processPendingCustomerEmails(limit = 20) {
  if (process.env.EMAILS_ENABLED !== 'true')
    return { sent: 0, failed: 0, disabled: true };
  const settings = emailSettings();
  const provider = resendProvider();
  let sent = 0;
  let failed = 0;
  for (let index = 0; index < Math.min(limit, 50); index++) {
    const email = await claimCustomerEmail();
    if (!email) break;
    try {
      const result = await provider.send(
        {
          from: settings.from,
          to: [settings.testRecipient ?? email.recipient],
          ...(settings.replyTo ? { reply_to: settings.replyTo } : {}),
          subject: `${settings.testRecipient ? '[TEST] ' : ''}${email.subject}`,
          html: email.html,
          text: email.text,
        },
        `caldera-customer-email:${email.id}`,
      );
      await getPrisma().customerEmailDelivery.updateMany({
        where: { id: email.id, leaseToken: email.leaseToken },
        data: {
          status: 'SENT',
          providerMessageId: result.id,
          sentAt: new Date(),
          leaseUntil: null,
          leaseToken: null,
        },
      });
      sent++;
    } catch {
      await getPrisma().customerEmailDelivery.updateMany({
        where: { id: email.id, leaseToken: email.leaseToken },
        data: {
          status: 'FAILED',
          lastError: 'TRAITEMENT_EMAIL_CLIENT_ECHOUE',
          nextAttemptAt: new Date(
            Date.now() +
              Math.min(60 * 2 ** (email.attemptCount - 1), 3600) * 1000,
          ),
          leaseUntil: null,
          leaseToken: null,
          retryBlocked: email.attemptCount >= MAX_ATTEMPTS,
        },
      });
      failed++;
    }
  }
  return { sent, failed, disabled: false };
}

async function claimCustomerEmail() {
  const db = getPrisma();
  return db.$transaction(async (tx) => {
    await tx.customerEmailDelivery.updateMany({
      where: { status: 'SENDING', leaseUntil: { lt: new Date() } },
      data: { status: 'FAILED', leaseUntil: null, leaseToken: null },
    });
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "CustomerEmailDelivery"
      WHERE "retryBlocked" = false AND "attemptCount" < ${MAX_ATTEMPTS}
      AND ((status IN ('PENDING', 'FAILED') AND "nextAttemptAt" <= NOW()) OR (status = 'SENDING' AND "leaseUntil" < NOW()))
      ORDER BY "createdAt", id FOR UPDATE SKIP LOCKED LIMIT 1`;
    if (!rows[0]) return null;
    return tx.customerEmailDelivery.update({
      where: { id: rows[0].id },
      data: {
        status: 'SENDING',
        attemptCount: { increment: 1 },
        leaseUntil: new Date(Date.now() + LEASE_MS),
        leaseToken: randomUUID(),
        lastError: null,
      },
    });
  });
}
