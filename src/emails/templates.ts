import { validTrackingUrl } from '@/lib/fulfillment/carriers';
import type { EmailType } from '@/generated/prisma/client';
import { LEGAL_IDENTITY, ORGANIZATION } from '@/lib/seo/policies';
import { PRODUCTION_HOST, PRODUCTION_SITE_URL } from '@/lib/site';
import { endOfDayAfter, REFUND_DAYS } from '@/lib/returns/rules';
export type EmailSnapshot = {
  version: number;
  orderNumber: string;
  publicId: string;
  shippingMethod: string;
  subtotal: string;
  shipping: string;
  total: string;
  /** Promotional code: items discount and waived shipping (absent before). */
  discount?: { code: string; amount: string; shipping: string };
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
  /** ORDER_REFUNDED only: this refund, not the running total. */
  refund?: {
    amount: string;
    shipping: string;
    items: { name: string; quantity: number; amount: string }[];
    /** The order could not be honoured: cancelled, refunded in full. */
    cancelled?: boolean;
  };
  /** RETURN_* only: the return request and the shop's answer. */
  returnRequest?: {
    number: string;
    reason: string;
    withdrawal: boolean;
    requestedAt: string;
    items: { name: string; quantity: number }[];
    resolution: string | null;
    /** RETURN_REPLACED only: the parcel carrying the new item. */
    replacement?: {
      carrier: string;
      trackingNumber: string | null;
      trackingUrl: string | null;
    };
  };
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
  if (row.discount !== undefined) {
    const discount = row.discount as Record<string, unknown> | null;
    if (
      !discount ||
      typeof discount.code !== 'string' ||
      typeof discount.amount !== 'string' ||
      typeof discount.shipping !== 'string'
    )
      throw new Error('Snapshot email invalide.');
  }
  if (row.refund !== undefined) {
    const refund = row.refund as Record<string, unknown> | null;
    if (
      !refund ||
      typeof refund.amount !== 'string' ||
      typeof refund.shipping !== 'string' ||
      !Array.isArray(refund.items) ||
      refund.items.some(
        (item) =>
          !item ||
          typeof item.name !== 'string' ||
          typeof item.amount !== 'string' ||
          !Number.isInteger(item.quantity) ||
          item.quantity < 1,
      ) ||
      !(refund.cancelled === undefined || typeof refund.cancelled === 'boolean')
    )
      throw new Error('Snapshot email invalide.');
  }
  if (row.returnRequest !== undefined) {
    const request = row.returnRequest as Record<string, unknown> | null;
    if (
      !request ||
      typeof request.number !== 'string' ||
      typeof request.reason !== 'string' ||
      typeof request.withdrawal !== 'boolean' ||
      typeof request.requestedAt !== 'string' ||
      !Number.isFinite(Date.parse(request.requestedAt)) ||
      !(
        request.resolution === null || typeof request.resolution === 'string'
      ) ||
      !Array.isArray(request.items) ||
      request.items.some(
        (item) =>
          !item ||
          typeof item.name !== 'string' ||
          !Number.isInteger(item.quantity) ||
          item.quantity < 1,
      )
    )
      throw new Error('Snapshot email invalide.');
    const replacement = request.replacement as
      Record<string, unknown> | undefined;
    if (
      replacement !== undefined &&
      (!replacement ||
        typeof replacement.carrier !== 'string' ||
        !['trackingNumber', 'trackingUrl'].every(
          (key) =>
            replacement[key] === null || typeof replacement[key] === 'string',
        ))
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
function discountLines(data: EmailSnapshot) {
  return data.discount && Number(data.discount.amount) > 0
    ? [`Réduction (${data.discount.code}) : −${money(data.discount.amount)}`]
    : [];
}
function shippingText(data: EmailSnapshot) {
  return data.discount && Number(data.discount.shipping) > 0
    ? `offerte avec le code ${data.discount.code}`
    : money(data.shipping);
}
function link(url: string, text: string) {
  return `<a href="${escapeHtml(url)}" style="display:inline-block;margin:12px 0;padding:14px 22px;background:#003c2d;color:#fff;text-decoration:none;border-radius:4px">${escapeHtml(text)}</a>`;
}
function emailPage({
  subject,
  title,
  content,
  orderNumber,
  urls,
  note,
}: {
  subject: string;
  title: string;
  content: string;
  orderNumber: string;
  urls: { order: string; logo: string };
  note: string;
}) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head><body style="margin:0;padding:20px 8px;background:#f6f1e4;font-family:Arial,sans-serif;color:#173e32;line-height:1.6"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#fffcf5"><tr><td style="padding:26px;background:#003c2d;border-bottom:3px solid #e8c261"><img src="${escapeHtml(urls.logo)}" width="240" alt="Les Terres de Caldera" style="display:block;max-width:100%;height:auto;color:#f7e9be"></td></tr><tr><td style="padding:24px"><p style="font-size:13px">Commande ${escapeHtml(orderNumber)}</p><h1 style="font-family:Georgia,serif;font-size:30px;line-height:1.2">${escapeHtml(title)}</h1>${content}${link(urls.order, 'Voir ma commande')}<p style="font-size:12px;color:#60665d">${escapeHtml(note)}</p></td></tr><tr><td style="padding:20px 24px;border-top:1px solid #d8d5c7;font-size:13px">Les Terres de Caldera<br><a href="${PRODUCTION_SITE_URL}" style="color:#173e32">${PRODUCTION_HOST}</a></td></tr></table></td></tr></table></body></html>`;
}
const RETURN_ADDRESS = [
  ORGANIZATION.legalName,
  LEGAL_IDENTITY.address.street,
  `${LEGAL_IDENTITY.address.postalCode} ${LEGAL_IDENTITY.address.locality}`,
  'France',
];
const longDay = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'long',
  timeZone: 'Europe/Paris',
});
const longDate = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'Europe/Paris',
});
/**
 * Return and withdrawal e-mails. The acknowledgment of a withdrawal is the
 * durable medium the law requires: date, items, and what happens next.
 */
function renderReturnEmail(
  type: EmailType,
  data: EmailSnapshot,
  urls: { order: string; logo: string },
) {
  const request = data.returnRequest;
  if (!request) throw new Error('Snapshot de retour absent.');
  const kind = request.withdrawal ? 'rétractation' : 'retour';
  const [title, subjectStart] =
    type === 'RETURN_APPROVED'
      ? ['Votre retour est accepté', 'Retour accepté']
      : type === 'RETURN_REJECTED'
        ? ['Réponse à votre demande de retour', 'Demande de retour']
        : type === 'RETURN_RECEIVED'
          ? ['Nous avons reçu votre colis', 'Colis de retour reçu']
          : type === 'RETURN_REPLACED'
            ? [
                'Votre article de remplacement est en route',
                'Remplacement expédié',
              ]
            : request.withdrawal
              ? ['Nous avons reçu votre rétractation', 'Accusé de rétractation']
              : [
                  'Nous avons reçu votre demande de retour',
                  'Demande de retour',
                ];
  const subject =
    `${subjectStart} ${request.number} — ${data.orderNumber}`.replace(
      /[\r\n]/g,
      ' ',
    );
  const requested = longDate.format(new Date(request.requestedAt));
  const intro =
    type === 'RETURN_REQUESTED'
      ? `Votre demande de ${kind} n° ${request.number} a été enregistrée le ${requested}.`
      : type === 'RETURN_APPROVED'
        ? `Votre demande de ${kind} n° ${request.number} est acceptée.`
        : type === 'RETURN_RECEIVED'
          ? `Votre colis de retour (demande n° ${request.number}) est bien arrivé.`
          : type === 'RETURN_REPLACED'
            ? `Suite à votre demande n° ${request.number}, nous vous avons expédié :`
            : `Nous ne pouvons pas donner suite à votre demande de ${kind} n° ${request.number}.`;
  // CGV art. 14: refunded at the latest 14 days after the withdrawal.
  const refundBy = longDay.format(
    new Date(
      endOfDayAfter(new Date(request.requestedAt), REFUND_DAYS).getTime() - 1,
    ),
  );
  const replacement = type === 'RETURN_REPLACED' ? request.replacement : null;
  // The shop's words, where they answer: not repeated on a received parcel.
  const resolution = type === 'RETURN_RECEIVED' ? null : request.resolution;
  const replacementUrl = replacement?.trackingUrl
    ? validTrackingUrl(replacement.trackingUrl)
    : null;
  const next =
    type === 'RETURN_REJECTED'
      ? []
      : type === 'RETURN_RECEIVED'
        ? [
            request.withdrawal
              ? `Nous vous remboursons au plus tard le ${refundBy}, sur le moyen de paiement utilisé pour la commande.`
              : 'Nous vérifions les articles et revenons vers vous par e-mail avec la suite donnée à votre demande.',
          ]
        : replacement
          ? [
              `Transporteur : ${replacement.carrier}${replacement.trackingNumber ? ` · suivi ${replacement.trackingNumber}` : ''}`,
            ]
          : type === 'RETURN_APPROVED'
            ? [
                'Renvoyez les articles à l’adresse ci-dessous, dans leur état d’origine et avec leurs protections, par un envoi suivi :',
              ]
            : request.withdrawal
              ? [
                  'Renvoyez les articles au plus tard 14 jours après cette demande, à l’adresse ci-dessous, par un envoi suivi. Les frais de retour restent à votre charge.',
                  'Nous vous rembourserons au plus tard 14 jours après votre demande, frais de livraison initiaux compris si toute la commande est retournée. Le remboursement peut attendre la réception des articles ou la preuve de leur envoi.',
                ]
              : [
                  'Nous étudions votre demande et revenons vers vous rapidement avec les instructions de retour. N’expédiez rien avant notre réponse.',
                ];
  const showAddress =
    type === 'RETURN_APPROVED' ||
    (type === 'RETURN_REQUESTED' && request.withdrawal);
  const items = request.items.map((item) => `${item.quantity} × ${item.name}`);
  const content = [
    `<p>${escapeHtml(intro)}</p>`,
    type === 'RETURN_REPLACED'
      ? ''
      : `<p>Motif : ${escapeHtml(request.reason)}</p>`,
    `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`,
    resolution
      ? `<p style="padding:12px 14px;background:#f6f1e4;border-left:3px solid #0b6650;white-space:pre-line">${escapeHtml(resolution)}</p>`
      : '',
    ...next.map((line) => `<p>${escapeHtml(line)}</p>`),
    replacementUrl ? link(replacementUrl, 'Suivre mon colis') : '',
    showAddress
      ? `<p><strong>${RETURN_ADDRESS.map(escapeHtml).join('<br>')}</strong></p><p>Indiquez le numéro ${escapeHtml(request.number)} dans le colis.</p>`
      : '',
  ].join('');
  const text = [
    title,
    `Commande ${data.orderNumber}`,
    intro,
    ...(type === 'RETURN_REPLACED' ? [] : [`Motif : ${request.reason}`]),
    ...items,
    ...(resolution ? [resolution] : []),
    ...next,
    ...(replacementUrl ? [`Suivre mon colis : ${replacementUrl}`] : []),
    ...(showAddress
      ? [
          ...RETURN_ADDRESS,
          `Indiquez le numéro ${request.number} dans le colis.`,
        ]
      : []),
    `Voir ma commande : ${urls.order}`,
    'Les Terres de Caldera',
    `Site : ${PRODUCTION_SITE_URL}`,
  ].join('\n\n');
  return {
    subject,
    html: emailPage({
      subject,
      title,
      content,
      orderNumber: data.orderNumber,
      urls,
      note: 'Conservez cet e-mail : il fait foi de la date de votre demande. Une question ? Écrivez-nous depuis la page contact du site en indiquant votre numéro de commande.',
    }),
    text,
  };
}
/** The customer is told what was refunded and when to expect it. */
function renderRefundEmail(
  data: EmailSnapshot,
  urls: { order: string; logo: string },
) {
  const refund = data.refund;
  if (!refund) throw new Error('Snapshot de remboursement absent.');
  const subject = (
    refund.cancelled
      ? `Commande annulée et remboursée — ${data.orderNumber}`
      : `Remboursement de ${money(refund.amount)} — ${data.orderNumber}`
  ).replace(/[\r\n]/g, ' ');
  const title = refund.cancelled
    ? 'Votre commande est annulée et remboursée'
    : 'Votre remboursement est en route';
  // Said first when the order itself could not be honoured.
  const cancelled = refund.cancelled
    ? 'Nous n’avons pas pu honorer votre commande : elle est annulée et intégralement remboursée. Toutes nos excuses.'
    : null;
  const lines = refund.items
    .map(
      (item) =>
        `<tr><td style="border-top:1px solid #d8d5c7">${escapeHtml(item.name)}</td><td align="center" style="border-top:1px solid #d8d5c7">${item.quantity}</td><td align="right" style="border-top:1px solid #d8d5c7;white-space:nowrap">${escapeHtml(money(item.amount))}</td></tr>`,
    )
    .join('');
  const content = `${cancelled ? `<p>${escapeHtml(cancelled)}</p>` : ''}<p>Nous avons remboursé <strong>${escapeHtml(money(refund.amount))}</strong> sur le moyen de paiement utilisé pour la commande. Selon votre banque, le montant apparaît sous 5 à 10 jours ouvrés.</p>${lines ? `<table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;font-size:14px"><thead><tr><th align="left">Article</th><th>Qté</th><th align="right">Remboursé</th></tr></thead><tbody>${lines}</tbody></table>` : ''}${Number(refund.shipping) > 0 ? `<p>Frais de livraison remboursés : ${escapeHtml(money(refund.shipping))}</p>` : ''}`;
  const html = emailPage({
    subject,
    title,
    content,
    orderNumber: data.orderNumber,
    urls,
    note: 'Une question sur ce remboursement ? Écrivez-nous depuis la page contact du site en indiquant votre numéro de commande.',
  });
  const text = [
    title,
    `Commande ${data.orderNumber}`,
    ...(cancelled ? [cancelled] : []),
    `Montant remboursé : ${money(refund.amount)}, sur le moyen de paiement de la commande. Selon votre banque, il apparaît sous 5 à 10 jours ouvrés.`,
    ...refund.items.map(
      (item) => `${item.quantity} × ${item.name} — ${money(item.amount)}`,
    ),
    ...(Number(refund.shipping) > 0
      ? [`Frais de livraison remboursés : ${money(refund.shipping)}`]
      : []),
    `Voir ma commande : ${urls.order}`,
    'Les Terres de Caldera',
    `Site : ${PRODUCTION_SITE_URL}`,
  ];
  return { subject, html, text: text.join('\n\n') };
}
export function renderEmail(
  type: EmailType,
  data: EmailSnapshot,
  urls: { order: string; logo: string },
) {
  if (type === 'ORDER_REFUNDED') return renderRefundEmail(data, urls);
  if (
    type === 'RETURN_REQUESTED' ||
    type === 'RETURN_APPROVED' ||
    type === 'RETURN_REJECTED' ||
    type === 'RETURN_RECEIVED' ||
    type === 'RETURN_REPLACED'
  )
    return renderReturnEmail(type, data, urls);
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
    : `<p>Votre paiement est confirmé. Nous avons bien reçu votre commande.</p><table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;font-size:14px"><thead><tr><th align="left">Article</th><th>Qté</th><th align="right">Total</th></tr></thead><tbody>${data.items.map((item) => `<tr><td style="border-top:1px solid #d8d5c7">${escapeHtml(item.name)}<br><span style="color:#60665d">${escapeHtml(item.sku)} · ${escapeHtml(item.language)}<br>${escapeHtml(money(item.unitPrice))} / unité</span></td><td align="center" style="border-top:1px solid #d8d5c7">${item.quantity}</td><td align="right" style="border-top:1px solid #d8d5c7;white-space:nowrap">${escapeHtml(money(item.total))}</td></tr>`).join('')}</tbody></table><p>Sous-total : ${escapeHtml(money(data.subtotal))}<br>${discountLines(data).map(escapeHtml).join('<br>')}${discountLines(data).length ? '<br>' : ''}Livraison : ${escapeHtml(shippingText(data))}<br><strong>Total : ${escapeHtml(money(data.total))}</strong></p><h2 style="font-size:18px">Livraison</h2><p>${data.address.map(escapeHtml).join('<br>')}</p><p>${escapeHtml(data.shippingMethod)}</p>`;
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
          ...discountLines(data),
          `Livraison : ${shippingText(data)}`,
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
