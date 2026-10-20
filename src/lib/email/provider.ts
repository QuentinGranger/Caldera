import 'server-only';
import { appOrigin } from '@/lib/orders/access';
export type EmailEnvelope = {
  from: string;
  tags?: { name: string; value: string }[];
  to: string[];
  reply_to?: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
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
  const testRecipient = process.env.EMAIL_TEST_RECIPIENT || undefined;
  const email = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;
  // A customer answering an e-mail reaches the shop's inbox: the dedicated
  // address, else the contact one (when valid: it must never stop sending).
  const contact = process.env.CONTACT_EMAIL_TO?.trim();
  const replyTo =
    process.env.EMAIL_REPLY_TO ||
    (contact && email.test(contact) ? contact : undefined);
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
      envelope = parseEnvelope(envelope);
      const sendingKey = envelope.from.includes('@news.lesterresdecaldera.fr')
        ? process.env.MARKETING_EMAIL_PROVIDER_API_KEY || key
        : key;
      let response: Response;
      try {
        response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${sendingKey}`,
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
  const address = (v: string) =>
    !/[\x00-\x1f\x7f]/.test(v) && /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(v);
  const from = row.from as string;
  if (
    /[\x00-\x1f\x7f]/.test(from) ||
    !address(/<([^<>]+)>$/.exec(from)?.[1] ?? from) ||
    !address(row.to[0]) ||
    (row.reply_to !== undefined && !address(row.reply_to as string)) ||
    /[\r\n\x00]/.test(row.subject as string) ||
    !(row.subject as string).trim() ||
    !(row.html as string).trim() ||
    !(row.text as string).trim()
  )
    throw new EmailProviderError('ENVELOPPE_INVALIDE');
  if (row.headers !== undefined) {
    if (
      !row.headers ||
      typeof row.headers !== 'object' ||
      Array.isArray(row.headers)
    )
      throw new EmailProviderError('ENVELOPPE_INVALIDE');
    const allowed = ['List-Unsubscribe', 'List-Unsubscribe-Post', 'List-Id'];
    for (const [name, header] of Object.entries(row.headers))
      if (
        !allowed.includes(name) ||
        typeof header !== 'string' ||
        header.length > 2048 ||
        /[\r\n\x00]/.test(header)
      )
        throw new EmailProviderError('ENVELOPPE_INVALIDE');
  }
  if (
    row.tags !== undefined &&
    (!Array.isArray(row.tags) ||
      row.tags.some(
        (tag) =>
          !tag ||
          typeof tag !== 'object' ||
          typeof tag.name !== 'string' ||
          typeof tag.value !== 'string' ||
          !/^[a-zA-Z0-9_-]{1,256}$/.test(tag.name) ||
          !/^[a-zA-Z0-9_-]{1,256}$/.test(tag.value),
      ))
  )
    throw new EmailProviderError('ENVELOPPE_INVALIDE');
  return {
    from,
    to: [row.to[0]],
    subject: row.subject as string,
    html: row.html as string,
    text: row.text as string,
    ...(row.reply_to ? { reply_to: row.reply_to as string } : {}),
    ...(row.tags ? { tags: row.tags as EmailEnvelope['tags'] } : {}),
    ...(row.headers ? { headers: row.headers as Record<string, string> } : {}),
  };
}
