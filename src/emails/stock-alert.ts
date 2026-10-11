import { campaignUrl } from '@/lib/analytics/campaign';
import { emailLayout } from './layout';
import { EMAIL_SOCIAL_LINKS_TEXT } from './social-links';
import { escapeHtml } from './templates';

export type StockAlertEmailProduct = {
  name: string;
  /** « Français », « Japonais »… */
  language: string;
  /** Formatted price, e.g. « 59,90 € ». */
  price: string;
};

function layout(title: string, content: string, logo: string) {
  return emailLayout({
    subject: title,
    logo: logo,
    label: 'Vos alertes stock',
    content: `${content}`,
  });
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
  urls = { ...urls, product: campaignUrl(urls.product, 'stock_alert') };
  const subject = `De retour en stock : ${product.name}`.replace(
    /[\r\n]/g,
    ' ',
  );
  const html = layout(
    subject,
    `<p style="font-size:13px">Alerte de retour en stock</p><h1 style="font-family:Georgia,serif;font-size:30px;line-height:1.2">Il est de retour</h1><p><strong>${escapeHtml(productLine(product))}</strong><br>${escapeHtml(product.price)}</p><p>La version que vous suiviez est de nouveau disponible. Consultez sa fiche pour vérifier le stock actuel ; cette alerte ne réserve pas de produit.</p>${button(urls.product, 'Voir le produit disponible')}<p style="font-size:12px;color:#60665d">Vous recevez ce message une seule fois : cette alerte est maintenant terminée et votre adresse sera effacée sous 30 jours.</p>`,
    urls.logo,
  );
  const text = [
    'Il est de retour',
    productLine(product),
    product.price,
    'La version que vous suiviez est de nouveau disponible. Consultez sa fiche pour vérifier le stock actuel ; cette alerte ne réserve pas de produit.',
    `Voir le produit : ${urls.product}`,
    'Vous recevez ce message une seule fois : cette alerte est maintenant terminée.',
    'Les Terres de Caldera',
    EMAIL_SOCIAL_LINKS_TEXT,
  ].join('\n\n');
  return { subject, html, text };
}
