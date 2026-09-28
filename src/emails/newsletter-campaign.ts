import { decodeEntities, renderMarkdown } from '@/lib/content/markdown';
import { PRODUCTION_HOST, PRODUCTION_SITE_URL } from '@/lib/site';
import { escapeHtml } from './templates';

export type NewsletterCampaignContent = {
  subject: string;
  preheader: string | null;
  heading: string;
  bodyMarkdown: string;
  ctaLabel: string | null;
  ctaUrl: string | null;
};

function absoluteUrl(value: string) {
  return value.startsWith('/') ? `${PRODUCTION_SITE_URL}${value}` : value;
}

function emailMarkdown(source: string) {
  return renderMarkdown(source, { headingLevel: 2 })
    .replace(/href="\//g, `href="${PRODUCTION_SITE_URL}/`)
    .replace(/src="\//g, `src="${PRODUCTION_SITE_URL}/`)
    .replace(
      /<h2>/g,
      '<h2 style="font-family:Georgia,serif;font-size:22px;line-height:1.3;margin:24px 0 8px">',
    )
    .replace(
      /<h3>/g,
      '<h3 style="font-size:18px;line-height:1.35;margin:20px 0 8px">',
    )
    .replace(/<p>/g, '<p style="margin:0 0 16px">')
    .replace(/<ul>/g, '<ul style="padding-left:22px;margin:0 0 16px">')
    .replace(/<ol>/g, '<ol style="padding-left:22px;margin:0 0 16px">')
    .replace(
      /<blockquote>/g,
      '<blockquote style="margin:18px 0;padding:12px 16px;border-left:3px solid #e8c261;background:#f6f1e4">',
    );
}

function plainMarkdown(source: string) {
  const html = renderMarkdown(source)
    .replace(/<\/(p|h[2-6]|blockquote|li|ul|ol)>/g, '\n')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<[^>]+>/g, '');
  return decodeEntities(html)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function renderNewsletterCampaignEmail(
  campaign: NewsletterCampaignContent,
  urls: { logo: string; unsubscribe?: string },
) {
  const subject = campaign.subject.replace(/[\r\n]+/g, ' ').trim();
  const content = emailMarkdown(campaign.bodyMarkdown);
  const cta =
    campaign.ctaLabel && campaign.ctaUrl
      ? `<p style="margin:24px 0"><a href="${escapeHtml(absoluteUrl(campaign.ctaUrl))}" style="display:inline-block;padding:14px 22px;background:#003c2d;color:#fff;text-decoration:none;border-radius:4px;font-weight:700">${escapeHtml(campaign.ctaLabel)}</a></p>`
      : '';
  const unsubscribe = urls.unsubscribe
    ? `<p style="margin:10px 0 0;font-size:12px;color:#60665d">Vous recevez cet e-mail après avoir confirmé votre inscription. <a href="${escapeHtml(urls.unsubscribe)}" style="color:#173e32">Se désinscrire</a>.</p>`
    : '<p style="margin:10px 0 0;font-size:12px;color:#60665d">E-mail de test — aucun abonné ne l’a reçu.</p>';
  const preheader = campaign.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(campaign.preheader)}</div>`
    : '';
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head><body style="margin:0;padding:20px 8px;background:#f6f1e4;font-family:Arial,sans-serif;color:#173e32;line-height:1.6">${preheader}<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#fffcf5"><tr><td style="padding:26px;background:#003c2d;border-bottom:3px solid #e8c261"><img src="${escapeHtml(urls.logo)}" width="240" alt="Les Terres de Caldera" style="display:block;max-width:100%;height:auto;color:#f7e9be"></td></tr><tr><td style="padding:28px 24px"><h1 style="margin:0 0 18px;font-family:Georgia,serif;font-size:30px;line-height:1.2">${escapeHtml(campaign.heading)}</h1>${content}${cta}</td></tr><tr><td style="padding:20px 24px;border-top:1px solid #d8d5c7;font-size:13px">Les Terres de Caldera<br><a href="${PRODUCTION_SITE_URL}" style="color:#173e32">${PRODUCTION_HOST}</a>${unsubscribe}</td></tr></table></td></tr></table></body></html>`;
  const text = [
    campaign.heading,
    plainMarkdown(campaign.bodyMarkdown),
    ...(campaign.ctaLabel && campaign.ctaUrl
      ? [`${campaign.ctaLabel} : ${absoluteUrl(campaign.ctaUrl)}`]
      : []),
    'Les Terres de Caldera',
    `Site : ${PRODUCTION_SITE_URL}`,
    urls.unsubscribe
      ? `Se désinscrire : ${urls.unsubscribe}`
      : 'E-mail de test — aucun abonné ne l’a reçu.',
  ].join('\n\n');
  return { subject, html, text, contentHtml: content };
}
