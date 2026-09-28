import 'server-only';
import { renderNewsletterConfirmationEmail } from '@/emails/newsletter';
import {
  EmailProviderError,
  emailSettings,
  resendProvider,
} from '@/lib/email/provider';
import { appOrigin } from '@/lib/orders/access';
import { newsletterConfirmationUrl, newsletterTokenHash } from './tokens';

export type NewsletterEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  action: string;
};
type Mailer = (email: NewsletterEmail) => Promise<void>;
let testMailer: Mailer | null = null;

/** Tests only: capture e-mails instead of calling the provider. */
export function setNewsletterMailer(mailer: Mailer | null) {
  testMailer = mailer;
}

export async function sendNewsletterConfirmation(to: string, token: string) {
  try {
    const origin = appOrigin();
    const action = newsletterConfirmationUrl(token);
    const rendered = renderNewsletterConfirmationEmail({
      confirmation: action,
      logo: `${origin}/assets/brand/logo-header-no-bg.png`,
    });
    if (testMailer) {
      await testMailer({ to, action, ...rendered });
      return true;
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
      `caldera-newsletter:confirmation:${newsletterTokenHash(token)}`,
    );
    return true;
  } catch (error) {
    console.error(
      JSON.stringify({
        scope: 'newsletter',
        action: 'email_failed',
        code:
          error instanceof EmailProviderError
            ? error.code
            : 'NEWSLETTER_EMAIL_FAILED',
      }),
    );
    return false;
  }
}
