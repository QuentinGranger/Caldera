import type { EmailType } from '@/generated/prisma/client';
import { customerReplyLink } from './reply';
import { escapeHtml } from './templates';

/** What the shop's e-mail tells, frozen when the event happened. */
export type ShopEmailSnapshot = {
  version: 1;
  orderId: string;
  orderNumber: string;
  customer: { email: string; phone: string | null; name: string | null };
  shippingMethod: string;
  total: string;
  shipping: string;
  promotionCode: string | null;
  address: string[];
  items: {
    name: string;
    sku: string;
    language: string;
    quantity: number;
    total: string;
  }[];
  /** SHOP_ORDER_PAID: the ordered variants now out of stock or low. */
  stock?: { sku: string; name: string; available: number }[];
  /** SHOP_ORDER_REVIEW: why the order is held. */
  review?: 'STOCK' | 'STALE_PAYMENT';
  /** SHOP_RETURN_REQUESTED: the customer's request. */
  returnRequest?: {
    id: string;
    number: string;
    reason: string;
    /** ReturnReason: DAMAGED, DEFECTIVE and WRONG_ITEM are complaints. */
    reasonCode?: string;
    withdrawal: boolean;
    message: string | null;
    items: { name: string; quantity: number }[];
  };
  /** SHOP_REFUND_FAILED: the refund Stripe did not make. */
  refund?: { amount: string; code: string };
};

const invalid = () => new Error('Snapshot de notification invalide.');
const isString = (value: unknown): value is string => typeof value === 'string';
const isQuantity = (value: unknown) =>
  Number.isInteger(value) && (value as number) >= 1;

export function parseShopSnapshot(value: unknown): ShopEmailSnapshot {
  if (!value || typeof value !== 'object') throw invalid();
  const row = value as Record<string, unknown>;
  const customer = row.customer as Record<string, unknown> | null;
  if (
    row.version !== 1 ||
    !['orderId', 'orderNumber', 'shippingMethod', 'total', 'shipping'].every(
      (key) => isString(row[key]),
    ) ||
    !(row.promotionCode === null || isString(row.promotionCode)) ||
    !customer ||
    typeof customer !== 'object' ||
    !isString(customer.email) ||
    !(customer.phone === null || isString(customer.phone)) ||
    !(customer.name === null || isString(customer.name)) ||
    !Array.isArray(row.address) ||
    !row.address.every(isString) ||
    !Array.isArray(row.items) ||
    !row.items.every(
      (item) =>
        item &&
        ['name', 'sku', 'language', 'total'].every((key) =>
          isString(item[key]),
        ) &&
        isQuantity(item.quantity),
    )
  )
    throw invalid();
  if (
    row.stock !== undefined &&
    !(
      Array.isArray(row.stock) &&
      row.stock.every(
        (item) =>
          item &&
          isString(item.sku) &&
          isString(item.name) &&
          Number.isInteger(item.available),
      )
    )
  )
    throw invalid();
  if (
    row.review !== undefined &&
    !['STOCK', 'STALE_PAYMENT'].includes(row.review as string)
  )
    throw invalid();
  if (row.returnRequest !== undefined) {
    const request = row.returnRequest as Record<string, unknown> | null;
    if (
      !request ||
      !['id', 'number', 'reason'].every((key) => isString(request[key])) ||
      typeof request.withdrawal !== 'boolean' ||
      !(request.reasonCode === undefined || isString(request.reasonCode)) ||
      !(request.message === null || isString(request.message)) ||
      !Array.isArray(request.items) ||
      !request.items.every(
        (item) => item && isString(item.name) && isQuantity(item.quantity),
      )
    )
      throw invalid();
  }
  if (row.refund !== undefined) {
    const refund = row.refund as Record<string, unknown> | null;
    if (!refund || !isString(refund.amount) || !isString(refund.code))
      throw invalid();
  }
  return value as ShopEmailSnapshot;
}

const money = (value: string) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(
    Number(value),
  );
const oneLine = (value: string) => value.replace(/[\r\n]+/g, ' ');

type Block = { html: string; text: string[] };
const paragraph = (value: string): Block => ({
  html: `<p>${escapeHtml(value)}</p>`,
  text: [value],
});
function list(title: string, lines: string[]): Block {
  return {
    html: `<h2 style="font-size:16px;margin:20px 0 6px">${escapeHtml(title)}</h2><ul style="margin:0;padding-left:20px">${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`,
    text: [title, ...lines.map((line) => `- ${line}`)],
  };
}
function notice(value: string): Block {
  return {
    html: `<p style="padding:12px 14px;background:#fbebd6;border-left:3px solid #c29435">${escapeHtml(value)}</p>`,
    text: [value],
  };
}

/** Returns that report a problem with the goods: complaints, not changes of mind. */
const COMPLAINTS = ['DAMAGED', 'DEFECTIVE', 'WRONG_ITEM'];

/** Who to answer, with clickable e-mail and phone. */
function customerBlock(data: ShopEmailSnapshot): Block {
  const { name, email, phone } = data.customer;
  const link = (href: string, text: string) =>
    `<a href="${escapeHtml(href)}" style="color:#124731">${escapeHtml(text)}</a>`;
  return {
    html: `<h2 style="font-size:16px;margin:20px 0 6px">Client</h2><p style="margin:0">${[
      ...(name ? [escapeHtml(name)] : []),
      link(`mailto:${email}`, email),
      ...(phone ? [link(`tel:${phone.replace(/[^\d+]/g, '')}`, phone)] : []),
    ].join('<br>')}</p>`,
    text: ['Client', ...(name ? [name] : []), email, ...(phone ? [phone] : [])],
  };
}

function orderBlocks(data: ShopEmailSnapshot): Block[] {
  return [
    list(
      'Articles',
      data.items.map(
        (item) =>
          `${item.quantity} × ${item.name} (${item.sku}, ${item.language}) — ${money(item.total)}`,
      ),
    ),
    paragraph(
      `Total payé : ${money(data.total)}, livraison ${money(data.shipping)} comprise${data.promotionCode ? `, code ${data.promotionCode}` : ''}.`,
    ),
    customerBlock(data),
    ...(data.address.length
      ? [list(`Livraison · ${data.shippingMethod}`, data.address)]
      : []),
  ];
}

const button = (href: string, label: string, primary: boolean) =>
  `<a href="${escapeHtml(href)}" style="display:inline-block;margin:8px 8px 0 0;padding:13px 20px;border-radius:4px;text-decoration:none;font-weight:bold;${
    primary
      ? 'background:#1c654b;color:#fff;border:1px solid #1c654b'
      : 'background:#fff;color:#124731;border:1px solid #1c654b'
  }">${escapeHtml(label)}</a>`;

/**
 * The shop's e-mails: what happened, what to do, the way into the
 * administration, and a ready reply to the customer.
 */
export function renderShopEmail(
  type: EmailType,
  data: ShopEmailSnapshot,
  urls: { admin: string; logo: string },
) {
  let subject: string, title: string, blocks: Block[], action: string;
  let target = `/admin/commandes/${data.orderId}`;
  // What the customer reads when the shop answers from this e-mail.
  let reply: { subject: string; quote?: string | null } = {
    subject: `Votre commande ${data.orderNumber}`,
  };
  let replyFirst = false;
  if (type === 'SHOP_ORDER_PAID') {
    subject = `Nouvelle commande ${data.orderNumber} — ${money(data.total)}`;
    title = 'Nouvelle commande à préparer';
    action = 'Préparer la commande';
    blocks = [
      paragraph(
        'Le paiement est confirmé : la commande attend sa préparation.',
      ),
      ...(data.stock?.length
        ? [
            notice(
              `Stock après cette commande : ${data.stock
                .map(
                  (item) =>
                    `${item.name} (${item.sku}) — ${item.available > 0 ? `${item.available} restant${item.available > 1 ? 's' : ''}` : 'rupture'}`,
                )
                .join(' ; ')}.`,
            ),
          ]
        : []),
      ...orderBlocks(data),
    ];
  } else if (type === 'SHOP_ORDER_REVIEW') {
    subject = `À vérifier : commande ${data.orderNumber}`;
    title = 'Commande à vérifier';
    action = 'Vérifier la commande';
    blocks = [
      notice(
        data.review === 'STALE_PAYMENT'
          ? 'Une tentative de paiement de plus de 23 heures ne peut plus être reprise automatiquement. Vérifiez dans Stripe si un paiement a abouti avant toute action.'
          : 'Le paiement est reçu, mais le stock réservé ne couvre plus toute la commande. Elle n’est ni préparée ni confirmée au client tant qu’elle n’est pas vérifiée.',
      ),
      ...orderBlocks(data),
    ];
  } else if (type === 'SHOP_RETURN_REQUESTED') {
    const request = data.returnRequest;
    if (!request) throw new Error('Snapshot de retour absent.');
    const complaint = COMPLAINTS.includes(request.reasonCode ?? '');
    target = `/admin/retours/${request.id}`;
    subject = `${request.withdrawal ? 'Rétractation' : complaint ? 'Réclamation' : 'Demande de retour'} ${request.number} — commande ${data.orderNumber}`;
    title = request.withdrawal
      ? 'Un client se rétracte'
      : complaint
        ? 'Nouvelle réclamation'
        : 'Nouvelle demande de retour';
    action = 'Traiter le retour';
    // A complaint is answered first, the paperwork follows.
    replyFirst = complaint;
    reply = {
      subject: `Votre demande ${request.number} — commande ${data.orderNumber}`,
      quote: request.message,
    };
    blocks = [
      paragraph(`Motif : ${request.reason}`),
      list(
        'Articles concernés',
        request.items.map((item) => `${item.quantity} × ${item.name}`),
      ),
      ...(request.message
        ? [
            {
              html: `<h2 style="font-size:16px;margin:20px 0 6px">Message du client</h2><p style="margin:0;padding:12px 14px;background:#f6f1e4;border-left:3px solid #0b6650;white-space:pre-line">${escapeHtml(request.message)}</p>`,
              text: ['Message du client :', request.message],
            },
          ]
        : []),
      ...(request.withdrawal
        ? [
            notice(
              'Rétractation : le client a reçu l’adresse de retour. Le remboursement est dû au plus tard 14 jours après sa demande ; il peut attendre la réception des articles ou la preuve de leur envoi.',
            ),
          ]
        : [
            paragraph(
              'Le client attend votre réponse avant d’expédier quoi que ce soit.',
            ),
          ]),
      customerBlock(data),
    ];
  } else if (type === 'SHOP_REFUND_FAILED') {
    const refund = data.refund;
    if (!refund) throw new Error('Snapshot de remboursement absent.');
    subject = `Remboursement refusé — commande ${data.orderNumber}`;
    title = 'Un remboursement n’a pas abouti';
    action = 'Ouvrir la commande';
    target = `/admin/commandes/${data.orderId}#remboursements`;
    reply = { subject: `Votre remboursement — commande ${data.orderNumber}` };
    blocks = [
      notice(
        `Stripe n’a pas remboursé ${money(refund.amount)} (motif : ${refund.code}). Le client n’a pas reçu cet argent ; le montant redevient remboursable depuis la fiche commande.`,
      ),
      customerBlock(data),
    ];
  } else throw new Error('Type de notification inconnu.');
  subject = oneLine(subject);
  const url = `${urls.admin}${target}`;
  const first = data.customer.name?.trim().split(/\s+/)[0];
  const replyLabel = first ? `Répondre à ${first}` : 'Répondre au client';
  const replyHref = customerReplyLink({
    to: data.customer.email,
    subject: reply.subject,
    name: data.customer.name,
    quote: reply.quote,
  });
  const buttons = replyFirst
    ? button(replyHref, replyLabel, true) + button(url, action, false)
    : button(url, action, true) + button(replyHref, replyLabel, false);
  const note =
    '« Répondre » dans votre messagerie écrit aussi au client, mais en citant cette notification : le bouton ci-dessus ouvre un message vierge, sans rien d’interne.';
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head><body style="margin:0;padding:20px 8px;background:#f2f3eb;font-family:Arial,sans-serif;color:#192d25;line-height:1.6"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#fffdf8"><tr><td style="padding:20px 24px;background:#003c2d;border-bottom:3px solid #e8c261"><img src="${escapeHtml(urls.logo)}" width="180" alt="Les Terres de Caldera" style="display:block;max-width:100%;height:auto;color:#f7e9be"></td></tr><tr><td style="padding:24px"><p style="margin:0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#1c654b">Administration · commande ${escapeHtml(data.orderNumber)}</p><h1 style="font-family:Georgia,serif;font-size:26px;line-height:1.2;margin:8px 0 16px">${escapeHtml(title)}</h1>${blocks.map((block) => block.html).join('')}<p style="margin:20px 0 8px">${buttons}</p><p style="font-size:12px;color:#53635b">${escapeHtml(note)}</p></td></tr></table></td></tr></table></body></html>`;
  const text = [
    title,
    `Commande ${data.orderNumber}`,
    ...blocks.map((block) => block.text.join('\n')),
    `${action} : ${url}`,
    `${replyLabel} : ${data.customer.email} (objet : ${reply.subject})`,
    'Notification automatique de la boutique. « Répondre » écrit au client en citant cette notification.',
  ].join('\n\n');
  return { subject, html, text, replyTo: data.customer.email };
}
