import 'server-only';
import { appOrigin } from '@/lib/orders/access';
export type EmailEnvelope = {
  from: string;
  to: string[];
  reply_to?: string;
  subject: string;
  html: string;
  text: string;
};
export interface EmailProvider {
  name: string;
  send(
    envelope: EmailEnvelope,
    idempotencyKey: string,
  ): Promise<{ id: string }>;
}
export class EmailProviderError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}
export function emailSettings() {
  const from = process.env.EMAIL_FROM ?? '';
  const replyTo = process.env.EMAIL_REPLY_TO || undefined;
  const testRecipient = process.env.EMAIL_TEST_RECIPIENT || undefined;
  const email = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;
  const address = /<([^<>]+)>$/.exec(from)?.[1] ?? from;
  if (
    !email.test(address) ||
    /[\r\n]/.test(from) ||
    (replyTo && !email.test(replyTo)) ||
    (testRecipient && !email.test(testRecipient))
  )
    throw new EmailProviderError('CONFIGURATION_EXPEDITEUR');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(
    new URL(appOrigin()).hostname,
  );
  if ((process.env.NODE_ENV !== 'production' || local) && !testRecipient)
    throw new EmailProviderError('DESTINATAIRE_TEST_REQUIS');
  return { from, replyTo, testRecipient };
}
export function resendProvider(): EmailProvider {
  const key = process.env.EMAIL_PROVIDER_API_KEY;
  if (!key) throw new EmailProviderError('CLE_FOURNISSEUR_MANQUANTE');
  return {
    name: 'resend',
    async send(envelope, idempotencyKey) {
      let response: Response;
      try {
        response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey,
          },
          body: JSON.stringify(envelope),
          signal: AbortSignal.timeout(10000),
        });
      } catch {
        throw new EmailProviderError('RESEAU_OU_TIMEOUT');
      }
      if (!response.ok)
        throw new EmailProviderError(`FOURNISSEUR_HTTP_${response.status}`);
      const value: unknown = await response.json();
      if (
        !value ||
        typeof value !== 'object' ||
        !('id' in value) ||
        typeof value.id !== 'string' ||
        value.id.length > 200
      )
        throw new EmailProviderError('REPONSE_FOURNISSEUR_INVALIDE');
      return { id: value.id };
    },
  };
}
export function parseEnvelope(value: unknown): EmailEnvelope {
  if (!value || typeof value !== 'object')
    throw new EmailProviderError('ENVELOPPE_INVALIDE');
  const row = value as Record<string, unknown>;
  if (
    !['from', 'subject', 'html', 'text'].every(
      (key) => typeof row[key] === 'string',
    ) ||
    !Array.isArray(row.to) ||
    row.to.length !== 1 ||
    typeof row.to[0] !== 'string' ||
    (row.reply_to !== undefined && typeof row.reply_to !== 'string')
  )
    throw new EmailProviderError('ENVELOPPE_INVALIDE');
  return value as EmailEnvelope;
}
