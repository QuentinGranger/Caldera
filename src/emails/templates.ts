import { validTrackingUrl } from '@/lib/fulfillment/carriers';
import type { EmailType } from '@/generated/prisma/client';
import { PRODUCTION_HOST, PRODUCTION_SITE_URL } from '@/lib/site';
export type EmailSnapshot = {
  version: number;
  orderNumber: string;
  publicId: string;
  shippingMethod: string;
  subtotal: string;
  shipping: string;
  total: string;
  address: string[];
  items: {
    name: string;
    sku: string;
    language: string;
    quantity: number;
    unitPrice: string;
    total: string;
  }[];
  shipment: {
    carrier: string;
    trackingNumber: string | null;
    trackingUrl: string | null;
  } | null;
};
export function parseEmailSnapshot(value: unknown): EmailSnapshot {
  if (!value || typeof value !== 'object')
    throw new Error('Snapshot email invalide.');
  const row = value as Record<string, unknown>;
  for (const key of [
    'orderNumber',
    'publicId',
    'shippingMethod',
    'subtotal',
    'shipping',
    'total',
  ])
    if (typeof row[key] !== 'string')
      throw new Error('Snapshot email invalide.');
  if (
    row.version !== 1 ||
    !Array.isArray(row.address) ||
    row.address.some((line) => typeof line !== 'string') ||
    !Array.isArray(row.items)
  )
    throw new Error('Snapshot email invalide.');
  for (const item of row.items) {
    if (!item || typeof item !== 'object')
      throw new Error('Snapshot email invalide.');
    for (const key of ['name', 'sku', 'language', 'unitPrice', 'total'])
      if (typeof item[key] !== 'string')
        throw new Error('Snapshot email invalide.');
    if (!Number.isInteger(item.quantity) || item.quantity < 1)
      throw new Error('Snapshot email invalide.');
  }
  if (row.shipment !== null) {
    if (!row.shipment || typeof row.shipment !== 'object')
      throw new Error('Snapshot email invalide.');
    const shipment = row.shipment as Record<string, unknown>;
    if (
      typeof shipment.carrier !== 'string' ||
      !['trackingNumber', 'trackingUrl'].every(
        (key) => shipment[key] === null || typeof shipment[key] === 'string',
      )
    )
      throw new Error('Snapshot email invalide.');
  }
  return value as EmailSnapshot;
}
export function escapeHtml(value: string | number) {
  return String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ]!,
  );
}
const money = (value: string) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(
    Number(value),
  );
function link(url: string, text: string) {
  return `<a href="${escapeHtml(url)}" style="display:inline-block;margin:12px 0;padding:14px 22px;background:#003c2d;color:#fff;text-decoration:none;border-radius:4px">${escapeHtml(text)}</a>`;
}
export function renderEmail(
  type: EmailType,
  data: EmailSnapshot,
  urls: { order: string; logo: string },
) {
  const shipped = type === 'ORDER_SHIPPED';
  const shipment = data.shipment;
  const trackingUrl = shipment?.trackingUrl
    ? validTrackingUrl(shipment.trackingUrl)
    : null;
  const title = shipped
    ? 'Votre commande est en route'
    : 'Merci pour votre commande';
  const subject =
    `${shipped ? 'Votre commande est en route' : 'Commande confirmée'} — ${data.orderNumber}`.replace(
      /[\r\n]/g,
      ' ',
    );
  const content = shipped
    ? `<p>Votre commande a été expédiée.</p><p>Transporteur : <strong>${escapeHtml(shipment?.carrier ?? '')}</strong></p>${shipment?.trackingNumber ? `<p>Numéro de suivi : ${escapeHtml(shipment.trackingNumber)}</p>` : ''}${trackingUrl ? link(trackingUrl, 'Suivre mon colis') : ''}`
    : `<p>Votre paiement est confirmé. Nous avons bien reçu votre commande.</p><table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;font-size:14px"><thead><tr><th align="left">Article</th><th>Qté</th><th align="right">Total</th></tr></thead><tbody>${data.items.map((item) => `<tr><td style="border-top:1px solid #d8d5c7">${escapeHtml(item.name)}<br><span style="color:#60665d">${escapeHtml(item.sku)} · ${escapeHtml(item.language)}<br>${escapeHtml(money(item.unitPrice))} / unité</span></td><td align="center" style="border-top:1px solid #d8d5c7">${item.quantity}</td><td align="right" style="border-top:1px solid #d8d5c7;white-space:nowrap">${escapeHtml(money(item.total))}</td></tr>`).join('')}</tbody></table><p>Sous-total : ${escapeHtml(money(data.subtotal))}<br>Livraison : ${escapeHtml(money(data.shipping))}<br><strong>Total : ${escapeHtml(money(data.total))}</strong></p><h2 style="font-size:18px">Livraison</h2><p>${data.address.map(escapeHtml).join('<br>')}</p><p>${escapeHtml(data.shippingMethod)}</p>`;
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head><body style="margin:0;padding:20px 8px;background:#f6f1e4;font-family:Arial,sans-serif;color:#173e32;line-height:1.6"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#fffcf5"><tr><td style="padding:26px;background:#003c2d;border-bottom:3px solid #e8c261"><img src="${escapeHtml(urls.logo)}" width="240" alt="Les Terres de Caldera" style="display:block;max-width:100%;height:auto;color:#f7e9be"></td></tr><tr><td style="padding:24px"><p style="font-size:13px">Commande ${escapeHtml(data.orderNumber)}</p><h1 style="font-family:Georgia,serif;font-size:30px;line-height:1.2">${title}</h1>${content}${link(urls.order, 'Voir ma commande')}<p style="font-size:12px;color:#60665d">Ce lien personnel de consultation est valable 180 jours. Conservez-le pour consulter votre commande.</p></td></tr><tr><td style="padding:20px 24px;border-top:1px solid #d8d5c7;font-size:13px">Les Terres de Caldera<br><a href="${PRODUCTION_SITE_URL}" style="color:#173e32">${PRODUCTION_HOST}</a><br>Explorez. Collectionnez.</td></tr></table></td></tr></table></body></html>`;
  const lines = [
    title,
    `Commande ${data.orderNumber}`,
    shipped ? 'Votre commande a été expédiée.' : 'Votre paiement est confirmé.',
    ...(shipped
      ? [
          `Transporteur : ${shipment?.carrier ?? ''}`,
          ...(shipment?.trackingNumber
            ? [`Suivi : ${shipment.trackingNumber}`]
            : []),
          ...(shipment?.trackingUrl
            ? [`Suivre mon colis : ${shipment.trackingUrl}`]
            : []),
        ]
      : [
          ...data.items.map(
            (item) =>
              `${item.quantity} × ${item.name} (${item.sku}, ${item.language}) — ${money(item.unitPrice)} / unité — ${money(item.total)}`,
          ),
          `Sous-total : ${money(data.subtotal)}`,
          `Livraison : ${money(data.shipping)}`,
          `Total : ${money(data.total)}`,
          ...data.address,
          data.shippingMethod,
        ]),
    `Voir ma commande : ${urls.order}`,
    'Lien personnel valable 180 jours.',
    'Les Terres de Caldera',
    `Site : ${PRODUCTION_SITE_URL}`,
  ];
  return { subject, html, text: lines.join('\n\n') };
}
