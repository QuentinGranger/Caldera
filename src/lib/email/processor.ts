import 'server-only';
import { randomUUID } from 'node:crypto';
import type { EmailDelivery, Prisma } from '@/generated/prisma/client';
import { getPrisma } from '@/lib/db/prisma';
import { adminTransaction, audit } from '@/lib/admin/common';
import { AdminError, uuid } from '@/lib/admin/validation';
import { appOrigin, orderAccessUrl } from '@/lib/orders/access';
import { parseEmailSnapshot, renderEmail } from '@/emails/templates';
import {
  emailSettings,
  EmailProviderError,
  parseEnvelope,
  resendProvider,
  type EmailEnvelope,
  type EmailProvider,
} from './provider';
export const MAX_EMAIL_ATTEMPTS = 5;
const LEASE_MS = 5 * 60000;
const IDEMPOTENCY_WINDOW_MS = 23 * 3600000; // Resend keeps keys for 24 h; never risk a new send after expiry.
export function canRetryEmail(
  email: Pick<
    EmailDelivery,
    'status' | 'attemptCount' | 'retryBlocked' | 'firstAttemptAt'
  >,
  now = new Date(),
) {
  return (
    email.status === 'FAILED' &&
    !email.retryBlocked &&
    email.attemptCount < MAX_EMAIL_ATTEMPTS &&
    (!email.firstAttemptAt ||
      now.getTime() - email.firstAttemptAt.getTime() < IDEMPOTENCY_WINDOW_MS)
  );
}
export function renderDelivery(
  email: Pick<EmailDelivery, 'type' | 'snapshot'>,
) {
  const snapshot = parseEmailSnapshot(email.snapshot);
  return renderEmail(email.type, snapshot, {
    order: orderAccessUrl(snapshot.publicId),
    logo: `${appOrigin()}/assets/brand/logo-header-no-bg.png`,
  });
}
async function claim(emailId?: string) {
  const db = getPrisma();
  return db.$transaction(async (tx) => {
    // A stale send is retried only within the provider's idempotency window.
    await tx.emailDelivery.updateMany({
      where: {
        ...(emailId ? { id: emailId } : {}),
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
    await tx.emailDelivery.updateMany({
      where: {
        ...(emailId ? { id: emailId } : {}),
        status: 'SENDING',
        leaseUntil: { lt: new Date() },
        attemptCount: { gte: MAX_EMAIL_ATTEMPTS },
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
      SELECT id FROM "EmailDelivery" WHERE ((${emailId ?? null}::uuid IS NULL) OR id = ${emailId ?? null}::uuid)
      AND "retryBlocked" = false AND "attemptCount" < ${MAX_EMAIL_ATTEMPTS}
      AND ((status IN ('PENDING', 'FAILED') AND "nextAttemptAt" <= NOW()) OR (status = 'SENDING' AND "leaseUntil" < NOW()))
      ORDER BY "createdAt", id FOR UPDATE SKIP LOCKED LIMIT 1`;
    if (!candidates[0]) return null;
    const email = await tx.emailDelivery.findUniqueOrThrow({
      where: { id: candidates[0].id },
    });
    return tx.emailDelivery.update({
      where: { id: email.id },
      data: {
        status: 'SENDING',
        attemptCount: { increment: 1 },
        leaseUntil: new Date(Date.now() + LEASE_MS),
        leaseToken: randomUUID(),
        firstAttemptAt: email.firstAttemptAt ?? new Date(),
        lastError: null,
      },
    });
  });
}
export async function processPendingEmails(
  options: {
    emailId?: string;
    limit?: number;
    provider?: EmailProvider;
    settings?: ReturnType<typeof emailSettings>;
  } = {},
) {
  if (!options.provider && process.env.EMAILS_ENABLED !== 'true')
    return { sent: 0, failed: 0, disabled: true };
  const provider = options.provider ?? resendProvider();
  const settings = options.settings ?? emailSettings();
  let sent = 0;
  let failed = 0;
  for (let index = 0; index < Math.min(options.limit ?? 10, 50); index++) {
    const email = await claim(options.emailId);
    if (!email) break;
    const owned = {
      id: email.id,
      status: 'SENDING' as const,
      leaseToken: email.leaseToken,
    };
    try {
      let envelope: EmailEnvelope;
      if (email.envelope) envelope = parseEnvelope(email.envelope);
      else {
        const rendered = renderDelivery(email);
        envelope = {
          from: settings.from,
          to: [settings.testRecipient ?? email.recipient],
          ...rendered,
          ...(settings.replyTo ? { reply_to: settings.replyTo } : {}),
          subject: `${settings.testRecipient ? '[TEST] ' : ''}${rendered.subject}`,
        };
        const persisted = await getPrisma().emailDelivery.updateMany({
          where: owned,
          data: {
            envelope: envelope as unknown as Prisma.InputJsonObject,
            provider: provider.name,
          },
        });
        if (!persisted.count) continue;
      }
      if (settings.testRecipient && envelope.to[0] !== settings.testRecipient) {
        throw new EmailProviderError('DESTINATAIRE_FIGE_DIFFERENT_DU_TEST');
      }
      // Reusing both key AND the frozen body covers timeout / accepted-but-not-acknowledged crashes.
      const result = await provider.send(envelope, `caldera-email:${email.id}`);
      const updated = await getPrisma().emailDelivery.updateMany({
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
      await getPrisma().emailDelivery.updateMany({
        where: owned,
        data: {
          status: 'FAILED',
          lastError:
            error instanceof EmailProviderError
              ? error.code
              : 'TRAITEMENT_EMAIL_ECHOUE',
          nextAttemptAt: new Date(
            Date.now() +
              Math.min(60 * 2 ** (email.attemptCount - 1), 3600) * 1000,
          ),
          leaseUntil: null,
          leaseToken: null,
        },
      });
      failed++;
    }
    if (options.emailId) break;
  }
  return { sent, failed, disabled: false };
}
export async function safelyProcessEmails() {
  try {
    return await processPendingEmails();
  } catch (error) {
    console.error('Email processor unavailable', {
      code:
        error instanceof EmailProviderError
          ? error.code
          : 'EMAIL_PROCESSOR_UNAVAILABLE',
    });
    return { sent: 0, failed: 0, disabled: true };
  }
}
export async function retryEmail(adminId: string, emailId: string) {
  uuid(emailId);
  return adminTransaction(adminId, async (tx) => {
    await tx.$queryRaw`SELECT id FROM "EmailDelivery" WHERE id = ${emailId}::uuid FOR UPDATE`;
    const email = await tx.emailDelivery.findUniqueOrThrow({
      where: { id: emailId },
    });
    if (!canRetryEmail(email))
      throw new AdminError(
        'Cet email ne peut pas être réessayé. Un email envoyé ne sera jamais renvoyé.',
      );
    await tx.emailDelivery.update({
      where: { id: emailId },
      data: { status: 'PENDING', nextAttemptAt: new Date(), lastError: null },
    });
    await audit(tx, adminId, 'EMAIL_RETRY_REQUESTED', 'Order', email.orderId, {
      emailId,
      attemptCount: email.attemptCount,
    });
    return email.orderId;
  });
}
