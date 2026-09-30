import 'server-only';
import {
  renderStockAlertConfirmationEmail,
  type StockAlertEmailProduct,
} from '@/emails/stock-alert';
import { deliverAfterResponse } from '@/lib/auth/deliver';
import {
  EmailProviderError,
  emailSettings,
  resendProvider,
} from '@/lib/email/provider';
import { appOrigin } from '@/lib/orders/access';
import {
  stockAlertConfirmationUrl,
  stockAlertRemovalUrl,
  stockAlertTokenHash,
} from './tokens';

export type StockAlertEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  action: string;
};
type Mailer = (email: StockAlertEmail) => Promise<void>;
let testMailer: Mailer | null = null;

/** Tests only: capture the confirmation e-mails instead of calling Resend. */
export function setStockAlertMailer(mailer: Mailer | null) {
  testMailer = mailer;
}

/** Never throws; inside a request it is sent after the response. */
export async function sendStockAlertConfirmation(
  to: string,
  product: StockAlertEmailProduct,
  token: string,
  alertId: string,
) {
  const action = stockAlertConfirmationUrl(token);
  const rendered = renderStockAlertConfirmationEmail(product, {
    confirmation: action,
    removal: stockAlertRemovalUrl(alertId),
    logo: `${appOrigin()}/assets/brand/logo-header-no-bg.png`,
  });
  if (testMailer) {
    await testMailer({ to, action, ...rendered });
    return;
  }
  await deliverAfterResponse(async () => {
    try {
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
        `caldera-stock-alert:confirmation:${stockAlertTokenHash(token)}`,
      );
    } catch (error) {
      console.error(
        JSON.stringify({
          scope: 'stock-alert',
          action: 'confirmation_email_failed',
          code:
            error instanceof EmailProviderError
              ? error.code
              : 'STOCK_ALERT_EMAIL_FAILED',
        }),
      );
    }
  });
}
