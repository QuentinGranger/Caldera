import {
  EMAIL_SOCIAL_LINKS_HTML,
  EMAIL_SOCIAL_LINKS_TEXT,
} from './social-links';
import { PRODUCTION_HOST, PRODUCTION_SITE_URL } from '@/lib/site';
import { escapeHtml } from './templates';

export type StockAlertEmailProduct = {
  name: string;
  /** « Français », « Japonais »… */
  language: string;
  /** Formatted price, e.g. « 59,90 € ». */
  price: string;
};

function layout(title: string, content: string, logo: string) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head><body style="margin:0;padding:20px 8px;background:#f6f1e4;font-family:Arial,sans-serif;color:#173e32;line-height:1.6"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#fffcf5"><tr><td style="padding:26px;background:#003c2d;border-bottom:3px solid #e8c261"><img src="${escapeHtml(logo)}" width="240" alt="Les Terres de Caldera" style="display:block;max-width:100%;height:auto;color:#f7e9be"></td></tr><tr><td style="padding:24px">${content}</td></tr><tr><td style="padding:20px 24px;border-top:1px solid #d8d5c7;font-size:13px">Les Terres de Caldera<br><a href="${PRODUCTION_SITE_URL}" style="color:#173e32">${PRODUCTION_HOST}</a>${EMAIL_SOCIAL_LINKS_HTML}</td></tr></table></td></tr></table></body></html>`;
}

function button(url: string, text: string) {
  return `<a href="${escapeHtml(url)}" style="display:inline-block;margin:12px 0;padding:14px 22px;background:#003c2d;color:#fff;text-decoration:none;border-radius:4px">${escapeHtml(text)}</a>`;
}

const productLine = (product: StockAlertEmailProduct) =>
  `${product.name} — ${product.language}`;

/** Double opt-in of a visitor: nothing is kept without this click. */
export function renderStockAlertConfirmationEmail(
  product: StockAlertEmailProduct,
  urls: { confirmation: string; removal: string; logo: string },
) {
  const subject = 'Confirmez votre alerte de retour en stock';
  const html = layout(
    subject,
    `<p style="font-size:13px">Alerte de retour en stock</p><h1 style="font-family:Georgia,serif;font-size:30px;line-height:1.2">Confirmez votre alerte</h1><p>Vous avez demandé à être prévenu du retour de&nbsp;:</p><p><strong>${escapeHtml(productLine(product))}</strong></p>${button(urls.confirmation, 'Confirmer mon alerte')}<p style="font-size:12px;color:#60665d">Ce lien est valable 24 heures. Sans confirmation, l’alerte et votre adresse sont effacées. Si vous n’êtes pas à l’origine de cette demande, ignorez ce message.</p><p style="font-size:12px;color:#60665d">Vous pourrez annuler l’alerte à tout moment : <a href="${escapeHtml(urls.removal)}" style="color:#173e32">annuler cette alerte</a>.</p>`,
    urls.logo,
  );
  const text = [
    'Confirmez votre alerte de retour en stock',
    `Produit : ${productLine(product)}`,
    `Confirmer mon alerte : ${urls.confirmation}`,
    'Lien valable 24 heures. Sans confirmation, l’alerte et votre adresse sont effacées. Si vous n’êtes pas à l’origine de cette demande, ignorez ce message.',
    `Annuler cette alerte : ${urls.removal}`,
    'Les Terres de Caldera',
    EMAIL_SOCIAL_LINKS_TEXT,
  ].join('\n\n');
  return { subject, html, text };
}

/** The one message of an alert: the variant can be bought again. */
export function renderStockAlertNotificationEmail(
  product: StockAlertEmailProduct,
  urls: { product: string; logo: string },
) {
  const subject = `De retour en stock : ${product.name}`.replace(
    /[\r\n]/g,
    ' ',
  );
  const html = layout(
    subject,
    `<p style="font-size:13px">Alerte de retour en stock</p><h1 style="font-family:Georgia,serif;font-size:30px;line-height:1.2">Il est de retour</h1><p><strong>${escapeHtml(productLine(product))}</strong><br>${escapeHtml(product.price)}</p><p>Les quantités sont limitées et ne sont pas réservées : la commande reste ouverte à tous jusqu’à épuisement.</p>${button(urls.product, 'Voir le produit')}<p style="font-size:12px;color:#60665d">Vous recevez ce message une seule fois : cette alerte est maintenant terminée et votre adresse sera effacée sous 30 jours.</p>`,
    urls.logo,
  );
  const text = [
    'Il est de retour',
    productLine(product),
    product.price,
    'Les quantités sont limitées et ne sont pas réservées : la commande reste ouverte à tous jusqu’à épuisement.',
    `Voir le produit : ${urls.product}`,
    'Vous recevez ce message une seule fois : cette alerte est maintenant terminée.',
    'Les Terres de Caldera',
    EMAIL_SOCIAL_LINKS_TEXT,
  ].join('\n\n');
  return { subject, html, text };
}
