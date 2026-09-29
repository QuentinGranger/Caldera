import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { renderAdminAccountEmail, type AdminEmailKind } from '@/emails/admin';
import { deliverAfterResponse } from '@/lib/auth/deliver';
import {
  emailSettings,
  EmailProviderError,
  resendProvider,
} from '@/lib/email/provider';
import { appOrigin } from '@/lib/orders/access';

export type AdminPasswordResetEmail = {
  kind: AdminEmailKind;
  to: string;
  action: string;
  subject: string;
  html: string;
  text: string;
};
type Mailer = (email: AdminPasswordResetEmail) => Promise<void>;
let testMailer: Mailer | null = null;

/** Tests only: capture the e-mails without calling Resend. */
export function setAdminPasswordResetMailer(mailer: Mailer | null) {
  testMailer = mailer;
}

/** The token travels in the fragment: never in server logs nor Referer headers. */
export function sendAdminPasswordResetEmail(to: string, token: string) {
  return send(
    'reset',
    to,
    `${appOrigin()}/admin/nouveau-mot-de-passe#token=${encodeURIComponent(token)}`,
    token,
  );
}

export function sendAdminPasswordChangedEmail(to: string) {
  return send('password-changed', to, `${appOrigin()}/admin/login`);
}

// Never throws and, inside a request, runs after the response: the answer to
// « mot de passe oublié » is the same, at the same speed, for any address.
async function send(
  kind: AdminEmailKind,
  to: string,
  action: string,
  token?: string,
) {
  const rendered = () =>
    renderAdminAccountEmail(kind, {
      action,
      logo: `${appOrigin()}/assets/brand/logo-header-no-bg.png`,
    });
  if (testMailer) {
    await testMailer({ kind, to, action, ...rendered() });
    return;
  }
  await deliverAfterResponse(async () => {
    try {
      if (process.env.EMAILS_ENABLED !== 'true')
        throw new EmailProviderError('EMAILS_DESACTIVES');
      const settings = emailSettings();
      const email = rendered();
      await resendProvider().send(
        {
          from: settings.from,
          to: [settings.testRecipient ?? to],
          ...(settings.replyTo ? { reply_to: settings.replyTo } : {}),
          subject: `${settings.testRecipient ? '[TEST] ' : ''}${email.subject}`,
          html: email.html,
          text: email.text,
        },
        `caldera-admin:${kind}:${
          token
            ? createHash('sha256').update(token).digest('hex')
            : randomUUID()
        }`,
      );
    } catch (error) {
      console.error(
        JSON.stringify({
          scope: 'admin',
          action: 'account_email_failed',
          kind,
          code:
            error instanceof EmailProviderError
              ? error.code
              : 'ADMIN_ACCOUNT_EMAIL_FAILED',
        }),
      );
    }
  });
}
