import { newsletterCopy } from '@/lib/newsletter/copy';
import { emailLayout, emailText } from './layout';
import { EMAIL_SOCIAL_LINKS_TEXT } from './social-links';
import { escapeHtml } from './templates';
import { PRODUCTION_SITE_URL } from '@/lib/site';

export function renderNewsletterConfirmationEmail(urls: {
  confirmation: string;
  logo: string;
  preparing?: boolean;
}) {
  const copy = newsletterCopy(urls.preparing ?? true);
  const subject = 'Confirmez votre inscription aux nouvelles de Caldera';
  const html = emailLayout({
    subject: subject,
    logo: urls.logo,
    label: 'Les nouvelles de Caldera',
    content: `<h1 style="font-family:Georgia,serif;font-size:30px;line-height:1.2">Gardons le cap ensemble</h1><p>${escapeHtml(copy.confirmation)}</p><a href="${escapeHtml(urls.confirmation)}" style="display:inline-block;margin:12px 0;padding:14px 22px;background:#003c2d;color:#fff;text-decoration:none;border-radius:4px">Confirmer mon inscription</a><p style="font-size:12px;color:#60665d">Ce lien est valable 24 heures et ne sert qu’une fois. Si vous n’avez pas demandé cette inscription, ignorez ce message : votre adresse ne sera pas activée.</p>`,
  });
  const text = [
    'Gardons le cap ensemble',
    copy.confirmation,
    `Confirmer mon inscription : ${urls.confirmation}`,
    'Ce lien est valable 24 heures et ne sert qu’une fois. Si vous n’avez pas demandé cette inscription, ignorez ce message : votre adresse ne sera pas activée.',
    'Les Terres de Caldera',
    `Site : ${PRODUCTION_SITE_URL}`,
    EMAIL_SOCIAL_LINKS_TEXT,
  ].join('\n\n');
  return { subject, html, text: emailText(text) };
}
