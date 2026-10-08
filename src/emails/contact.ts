import {
  EMAIL_SOCIAL_LINKS_HTML,
  EMAIL_SOCIAL_LINKS_TEXT,
} from './social-links';
import { customerReplyLink } from './reply';
import { escapeHtml } from './templates';

export type ContactMessage = {
  name: string;
  email: string;
  /** The topic chosen in the form, as shown to the customer. */
  topic: string;
  orderNumber: string;
  message: string;
};

const sentAt = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'Europe/Paris',
});

/**
 * A message from the /contact form, for the shop's inbox. "Reply" answers
 * the customer (reply_to), the button opens a ready answer, and an order
 * number leads straight to the order in the administration.
 */
export function renderContactEmail(
  contact: ContactMessage,
  urls: { admin: string; logo: string; site: string },
  now = new Date(),
) {
  const order = contact.orderNumber ? ` — commande ${contact.orderNumber}` : '';
  // Reads well on both sides: in the shop's inbox, and as "Re: …" for the
  // customer once answered.
  const subject = `${contact.topic} — ${contact.name}${order}`.replace(
    /[\r\n]+/g,
    ' ',
  );
  const first = contact.name.trim().split(/\s+/)[0];
  const replyLabel = first ? `Répondre à ${first}` : 'Répondre';
  const replyHref = customerReplyLink({
    to: contact.email,
    subject: `Votre message : ${contact.topic}${contact.orderNumber ? ` (commande ${contact.orderNumber})` : ''}`,
    name: contact.name,
    quote: contact.message,
  });
  const orderHref = contact.orderNumber
    ? `${urls.admin}/admin/commandes?search=${encodeURIComponent(contact.orderNumber)}`
    : null;
  const when = sentAt.format(now);
  const button = (href: string, label: string, primary: boolean) =>
    `<a href="${escapeHtml(href)}" style="display:inline-block;margin:8px 8px 0 0;padding:13px 20px;border-radius:4px;text-decoration:none;font-weight:bold;${
      primary
        ? 'background:#1c654b;color:#fff;border:1px solid #1c654b'
        : 'background:#fff;color:#124731;border:1px solid #1c654b'
    }">${escapeHtml(label)}</a>`;
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head><body style="margin:0;padding:20px 8px;background:#f2f3eb;font-family:Arial,sans-serif;color:#192d25;line-height:1.6"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#fffdf8"><tr><td style="padding:20px 24px;background:#003c2d;border-bottom:3px solid #e8c261"><img src="${escapeHtml(urls.logo)}" width="180" alt="Les Terres de Caldera" style="display:block;max-width:100%;height:auto;color:#f7e9be"></td></tr><tr><td style="padding:24px"><p style="margin:0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#1c654b">Formulaire de contact · ${escapeHtml(contact.topic)}</p><h1 style="font-family:Georgia,serif;font-size:26px;line-height:1.2;margin:8px 0 16px">Message de ${escapeHtml(contact.name)}</h1><p style="margin:0">De : <a href="mailto:${escapeHtml(contact.email)}" style="color:#124731">${escapeHtml(contact.email)}</a><br>Reçu le ${escapeHtml(when)}${contact.orderNumber ? `<br>Commande : <strong>${escapeHtml(contact.orderNumber)}</strong>` : ''}</p><p style="margin:16px 0 0;padding:12px 14px;background:#f6f1e4;border-left:3px solid #0b6650;white-space:pre-line">${escapeHtml(contact.message)}</p><p style="margin:20px 0 8px">${button(replyHref, replyLabel, true)}${orderHref ? button(orderHref, 'Voir la commande', false) : ''}</p><p style="font-size:12px;color:#53635b">« Répondre » dans votre messagerie écrit directement à ${escapeHtml(contact.email)}. Message envoyé depuis <a href="${escapeHtml(urls.site)}" style="color:#53635b">${escapeHtml(new URL(urls.site).host)}</a>.</p></td></tr><tr><td style="padding:20px 24px;border-top:1px solid #d8d5c7;font-size:13px">Les Terres de Caldera${EMAIL_SOCIAL_LINKS_HTML}</td></tr></table></td></tr></table></body></html>`;
  const text = [
    `Message de ${contact.name} (${contact.email})`,
    `Sujet : ${contact.topic}`,
    ...(contact.orderNumber ? [`Commande : ${contact.orderNumber}`] : []),
    `Reçu le ${when}`,
    '',
    contact.message,
    '',
    ...(orderHref ? [`Voir la commande : ${orderHref}`] : []),
    `« Répondre » écrit directement à ${contact.email}.`,
    '',
    EMAIL_SOCIAL_LINKS_TEXT,
  ].join('\n');
  return { subject, html, text };
}
