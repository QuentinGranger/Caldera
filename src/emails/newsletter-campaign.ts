import { emailLayout } from './layout';
import { EMAIL_SOCIAL_LINKS_TEXT } from './social-links';
import { decodeEntities, renderMarkdown } from '@/lib/content/markdown';
import { PRODUCTION_SITE_URL } from '@/lib/site';
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
  const html = emailLayout({
    subject: subject,
    logo: urls.logo,
    label: 'Le journal Caldera',
    footer: unsubscribe,
    preheader: campaign.preheader ?? undefined,
    content: `<h1 style="margin:0 0 18px;font-family:Georgia,serif;font-size:30px;line-height:1.2">${escapeHtml(campaign.heading)}</h1>${content}${cta}`,
  });
  const text = [
    campaign.heading,
    plainMarkdown(campaign.bodyMarkdown),
    ...(campaign.ctaLabel && campaign.ctaUrl
      ? [`${campaign.ctaLabel} : ${absoluteUrl(campaign.ctaUrl)}`]
      : []),
    'Les Terres de Caldera',
    `Site : ${PRODUCTION_SITE_URL}`,
    EMAIL_SOCIAL_LINKS_TEXT,
    urls.unsubscribe
      ? `Se désinscrire : ${urls.unsubscribe}`
      : 'E-mail de test — aucun abonné ne l’a reçu.',
  ].join('\n\n');
  return { subject, html, text, contentHtml: content };
}
