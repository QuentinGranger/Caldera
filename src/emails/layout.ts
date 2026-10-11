import { EMAIL_SOCIAL_LINKS_HTML } from './social-links';
import { PRODUCTION_HOST, PRODUCTION_SITE_URL } from '@/lib/site';

const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        character
      ]!,
  );

/** Trusted, already escaped template content only. No external fonts, scripts or tracking. */
export function emailLayout({
  subject,
  logo,
  content,
  label,
  preheader,
  footer = '',
}: {
  subject: string;
  logo: string;
  content: string;
  label: string;
  preheader?: string;
  footer?: string;
}) {
  // Inline essentials survive clients that strip head styles. Media rules are enhancements.
  const styled = content
    .replace(
      /<h1(?: style="[^"]*")?>/g,
      '<h1 style="margin:8px 0 24px;font-family:Georgia,Times,serif;font-size:34px;line-height:1.18;font-weight:400;letter-spacing:-.6px;color:#123d31">',
    )
    .replace(
      /<h2(?: style="[^"]*")?>/g,
      '<h2 style="margin:28px 0 12px;font-family:Georgia,Times,serif;font-size:23px;line-height:1.3;color:#123d31">',
    )
    .replace(/<p>/g, '<p style="margin:0 0 18px">')
    .replace(
      /<table width="100%"/g,
      '<table class="email-details" width="100%"',
    )
    .replace(
      /padding:14px 22px/g,
      'padding:16px 24px;font-size:15px;font-weight:700;line-height:1.4;text-align:center;max-width:100%;box-sizing:border-box;border:1px solid #1c5542',
    )
    .replace(/border-radius:4px/g, 'border-radius:8px')
    .replace(
      /font-size:12px;color:#60665d/g,
      'font-size:13px;line-height:1.7;color:#60665d',
    );
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escape(subject)}</title><style>body,table,td{margin:0}table{border-collapse:collapse}img{border:0}a{color:#165640}p,a,td{overflow-wrap:anywhere;word-wrap:break-word}.email-details td,.email-details th{padding:14px 8px;font-size:14px;vertical-align:top}.email-details th{background:#eee9dc;color:#435449;font-size:12px;text-transform:uppercase;letter-spacing:.06em}@media only screen and (max-width:480px){.email-outer{padding:12px 6px!important}.email-content{padding:28px 20px!important}.email-header{padding:28px 20px!important}.email-footer{padding:24px 20px!important}h1{font-size:29px!important}.email-details td,.email-details th{padding:12px 4px;font-size:12px}}</style></head><body bgcolor="#eeece4" style="margin:0;padding:0;background:#eeece4;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.7;color:#344c42"><div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all">${escape(preheader ?? subject)}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td class="email-outer" align="center" style="padding:36px 12px"><!--[if mso]><table role="presentation" width="640"><tr><td><![endif]--><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#fffcf5;border:1px solid #dcd8ca"><tr><td class="email-header" align="center" bgcolor="#003c2d" style="padding:36px 32px 28px;background:#003c2d;border-bottom:3px solid #d9b65d"><a href="${PRODUCTION_SITE_URL}" style="text-decoration:none"><img src="${escape(logo)}" width="240" alt="Les Terres de Caldera" style="display:block;width:240px;max-width:100%;height:auto;color:#f7e9be"></a><p style="margin:22px 0 0;color:#e9d59b;font-size:10px;line-height:1.5;letter-spacing:3px;text-transform:uppercase">Explorez. Collectionnez.</p></td></tr><tr><td class="email-content" style="padding:36px 36px 32px"><p style="margin:0 0 20px;color:#746029;font-size:11px;font-weight:700;line-height:1.5;letter-spacing:1.8px;text-transform:uppercase">${escape(label)}</p>${styled}</td></tr><tr><td class="email-footer" style="padding:26px 36px;background:#f3efe4;border-top:1px solid #ddd6c4;font-size:13px;line-height:1.7;color:#526157"><p style="margin:0 0 4px;font-family:Georgia,Times,serif;font-size:19px;color:#173e32">Les Terres de Caldera</p><a href="${PRODUCTION_SITE_URL}" style="color:#345b48;text-decoration:underline">${PRODUCTION_HOST}</a>${EMAIL_SOCIAL_LINKS_HTML}${footer}</td></tr></table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>`;
}
