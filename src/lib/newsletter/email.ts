import 'server-only';

import { appOrigin } from '@/lib/orders/access';
import {
  emailSettings,
  EmailProviderError,
  resendProvider,
} from '@/lib/email/provider';
import type { NewsletterSubscription } from './service';

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        character
      ]!,
  );
}

export async function sendNewsletterWelcome(
  subscription: NewsletterSubscription,
) {
  if (process.env.EMAILS_ENABLED !== 'true') return { sent: false };

  try {
    const settings = emailSettings();
    const unsubscribeUrl = `${appOrigin()}/newsletter/desinscription?token=${encodeURIComponent(subscription.unsubscribeToken)}`;
    const subject = 'Bienvenue dans l’expédition Caldera';
    const html = `<!doctype html><html lang="fr"><body style="margin:0;padding:32px 8px;background:#f6f1e4;color:#173e32;font-family:Arial,sans-serif;line-height:1.6"><main style="max-width:620px;margin:auto;background:#fffcf5;border-top:4px solid #e8c261"><header style="padding:26px 32px;background:#003c2d;color:#f7e9be"><strong style="letter-spacing:.14em">LES TERRES DE CALDERA</strong></header><section style="padding:32px"><h1 style="margin-top:0;font-family:Georgia,serif;font-size:32px">Bienvenue dans l’expédition</h1><p>Votre inscription aux nouvelles de Caldera est bien enregistrée.</p><p>Vous recevrez nos sélections, les nouvelles extensions et les annonces de réassort.</p><p style="margin-top:32px;font-size:12px;color:#60665d">Vous pouvez <a href="${escapeHtml(unsubscribeUrl)}" style="color:#00503b">vous désinscrire à tout moment</a>.</p></section></main></body></html>`;
    const text = `Bienvenue dans l’expédition Caldera\n\nVotre inscription aux nouvelles de Caldera est bien enregistrée.\n\nVous recevrez nos sélections, les nouvelles extensions et les annonces de réassort.\n\nVous désinscrire : ${unsubscribeUrl}`;
    const recipient = settings.testRecipient ?? subscription.email;

    await resendProvider().send(
      {
        from: settings.from,
        to: [recipient],
        ...(settings.replyTo ? { reply_to: settings.replyTo } : {}),
        subject: `${settings.testRecipient ? '[TEST] ' : ''}${subject}`,
        html,
        text,
      },
      `caldera-newsletter:${subscription.id}:${subscription.consentAt.getTime()}`,
    );

    return { sent: true };
  } catch (error) {
    console.error('Newsletter welcome email unavailable', {
      code:
        error instanceof EmailProviderError
          ? error.code
          : 'NEWSLETTER_EMAIL_UNAVAILABLE',
    });
    return { sent: false };
  }
}
