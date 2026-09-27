import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { renderAccountEmail, type AccountEmailKind } from '@/emails/account';
import {
  EmailProviderError,
  emailSettings,
  resendProvider,
} from '@/lib/email/provider';
import { appOrigin } from '@/lib/orders/access';

export type AccountEmail = {
  kind: AccountEmailKind;
  to: string;
  subject: string;
  html: string;
  text: string;
  /** The link the e-mail carries (tests read the token from it). */
  action: string;
};
type Mailer = (email: AccountEmail) => Promise<void>;

let testMailer: Mailer | null = null;
/** Tests only: capture e-mails instead of calling the provider. */
export function setAccountMailer(mailer: Mailer | null) {
  testMailer = mailer;
}

function actionUrl(kind: AccountEmailKind, token?: string) {
  const origin = appOrigin();
  if (kind === 'verify')
    return `${origin}/compte/verification?token=${encodeURIComponent(token ?? '')}`;
  if (kind === 'reset')
    return `${origin}/compte/nouveau-mot-de-passe?token=${encodeURIComponent(token ?? '')}`;
  return `${origin}/compte/connexion`;
}

/**
 * Sends synchronously, never throws: a failed delivery is logged with a code
 * only (no address, no token) and the visitor can ask for a new link. Throwing
 * would also tell a sign-up form which addresses already have an account.
 */
export async function sendAccountEmail(
  kind: AccountEmailKind,
  to: string,
  token?: string,
) {
  try {
    const origin = appOrigin();
    const action = actionUrl(kind, token);
    const rendered = renderAccountEmail(kind, {
      action,
      logo: `${origin}/assets/brand/logo-header-no-bg.png`,
      reset: `${origin}/compte/mot-de-passe-oublie`,
    });
    if (testMailer) {
      await testMailer({ kind, to, action, ...rendered });
      return;
    }
    if (process.env.EMAILS_ENABLED !== 'true')
      throw new EmailProviderError('EMAILS_DESACTIVES');
    const settings = emailSettings();
    await resendProvider().send(
      {
        from: settings.from,
        to: [settings.testRecipient ?? to],
        ...(settings.replyTo ? { reply_to: settings.replyTo } : {}),
        subject: `${settings.testRecipient ? '[TEST] ' : ''}${rendered.subject}`,
        html: rendered.html,
        text: rendered.text,
      },
      `caldera-account:${kind}:${
        token ? createHash('sha256').update(token).digest('hex') : randomUUID()
      }`,
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        scope: 'account',
        action: 'email_failed',
        kind,
        code:
          error instanceof EmailProviderError
            ? error.code
            : 'ACCOUNT_EMAIL_FAILED',
      }),
    );
  }
}
