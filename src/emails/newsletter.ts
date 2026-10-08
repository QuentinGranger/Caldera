import {
  EMAIL_SOCIAL_LINKS_HTML,
  EMAIL_SOCIAL_LINKS_TEXT,
} from './social-links';
import { escapeHtml } from './templates';
import { PRODUCTION_HOST, PRODUCTION_SITE_URL } from '@/lib/site';

export function renderNewsletterConfirmationEmail(urls: {
  confirmation: string;
  logo: string;
}) {
  const subject = 'Confirmez votre inscription aux nouvelles de Caldera';
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head><body style="margin:0;padding:20px 8px;background:#f6f1e4;font-family:Arial,sans-serif;color:#173e32;line-height:1.6"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#fffcf5"><tr><td style="padding:26px;background:#003c2d;border-bottom:3px solid #e8c261"><img src="${escapeHtml(urls.logo)}" width="240" alt="Les Terres de Caldera" style="display:block;max-width:100%;height:auto;color:#f7e9be"></td></tr><tr><td style="padding:24px"><h1 style="font-family:Georgia,serif;font-size:30px;line-height:1.2">Gardons le cap ensemble</h1><p>Confirmez votre adresse e-mail pour recevoir les réassorts, nouvelles extensions et sélections des Terres de Caldera.</p><a href="${escapeHtml(urls.confirmation)}" style="display:inline-block;margin:12px 0;padding:14px 22px;background:#003c2d;color:#fff;text-decoration:none;border-radius:4px">Confirmer mon inscription</a><p style="font-size:12px;color:#60665d">Ce lien est valable 24 heures et ne sert qu’une fois. Si vous n’avez pas demandé cette inscription, ignorez ce message : votre adresse ne sera pas activée.</p></td></tr><tr><td style="padding:20px 24px;border-top:1px solid #d8d5c7;font-size:13px">Les Terres de Caldera<br><a href="${PRODUCTION_SITE_URL}" style="color:#173e32">${PRODUCTION_HOST}</a>${EMAIL_SOCIAL_LINKS_HTML}</td></tr></table></td></tr></table></body></html>`;
  const text = [
    'Gardons le cap ensemble',
    'Confirmez votre adresse e-mail pour recevoir les réassorts, nouvelles extensions et sélections des Terres de Caldera.',
    `Confirmer mon inscription : ${urls.confirmation}`,
    'Ce lien est valable 24 heures et ne sert qu’une fois. Si vous n’avez pas demandé cette inscription, ignorez ce message : votre adresse ne sera pas activée.',
    'Les Terres de Caldera',
    `Site : ${PRODUCTION_SITE_URL}`,
    EMAIL_SOCIAL_LINKS_TEXT,
  ].join('\n\n');
  return { subject, html, text };
}
