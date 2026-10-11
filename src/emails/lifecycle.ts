import { campaignUrl } from '@/lib/analytics/campaign';
import { emailLayout } from './layout';
import { escapeHtml } from './templates';
import { EMAIL_SOCIAL_LINKS_TEXT } from './social-links';
import type { LifecycleKind } from '@/lib/lifecycle/policy';
export type LifecycleProduct = {
  name: string;
  price: string;
  url: string;
  quantity?: number;
  stock?: number;
};
const copy: Record<
  LifecycleKind,
  { subject: string; body: string; cta: string }
> = {
  WELCOME: {
    subject: 'Bienvenue sur les Terres de Caldera',
    body: 'Caldera vous aide à découvrir et choisir vos produits du JCC Pokémon. Retrouvez les nouveautés disponibles, créez une alerte sur une fiche épuisée et échangez avec la communauté sur Discord.',
    cta: 'Découvrir Caldera',
  },
  CART_FIRST: {
    subject: 'Votre sélection Caldera vous attend',
    body: 'Vous avez commencé une sélection sans finaliser votre commande. Vous pouvez retrouver les articles ci-dessous. Les prix et disponibilités seront vérifiés à nouveau ; aucun article n’est réservé.',
    cta: 'Reprendre ma sélection',
  },
  CART_SECOND: {
    subject: 'Un dernier rappel pour votre sélection Caldera',
    body: 'Voici un dernier rappel de votre sélection. Si elle vous intéresse toujours, vous pouvez la reprendre ci-dessous. Les prix et disponibilités peuvent évoluer ; aucun article n’est réservé.',
    cta: 'Reprendre ma sélection',
  },
  NEW_ARRIVAL: {
    subject: 'Une nouveauté Pokémon est disponible sur Caldera',
    body: 'Une nouvelle sélection est maintenant disponible. Consultez les fiches pour découvrir son contenu, son prix et les versions proposées.',
    cta: 'Voir les produits disponibles',
  },
  POST_PURCHASE: {
    subject: 'Votre commande est arrivée ?',
    body: 'Votre commande est indiquée comme livrée. Tout s’est bien passé ? Si vous rencontrez un problème, notre service client peut vous aider. Voici aussi quelques produits utiles pour compléter votre sélection.',
    cta: 'Contacter Caldera',
  },
  COMPLEMENTS: {
    subject: 'Pour compléter votre sélection Caldera',
    body: 'Voici des produits liés à votre achat. Vérifiez le format et les dimensions des accessoires avant de choisir : cette sélection ne garantit pas leur compatibilité physique.',
    cta: 'Voir ma sélection',
  },
  FAVORITE_RESTOCK: {
    subject: 'Un de vos favoris est de nouveau disponible',
    body: 'Un produit que vous avez enregistré revient en stock. Consultez sa fiche pour vérifier la disponibilité actuelle ; ce message ne réserve aucun exemplaire.',
    cta: 'Voir le produit',
  },
  FAVORITE_PRICE: {
    subject: 'Le prix d’un de vos favoris a changé',
    body: 'Le tarif de cette version a changé depuis notre dernière vérification. Voici son prix actuel, sans promesse de réduction.',
    cta: 'Voir le produit',
  },
  LOW_STOCK: {
    subject: 'Derniers exemplaires pour un de vos favoris',
    body: 'Le stock disponible de cette version est faible au moment de cet envoi. Il peut évoluer avant votre visite. Aucun exemplaire n’est réservé.',
    cta: 'Voir le produit',
  },
  WIN_BACK: {
    subject: 'Du nouveau depuis votre dernier achat sur Caldera',
    body: 'Voici des nouveautés ou des retours en stock disponibles depuis votre dernier achat. Une sélection courte pour retrouver ce qui vous intéresse.',
    cta: 'Voir les nouveautés',
  },
};
export function renderLifecycleEmail(
  kind: LifecycleKind,
  products: LifecycleProduct[],
  urls: {
    action: string;
    unsubscribe: string;
    preferences: string;
    logo: string;
  },
) {
  urls = {
    ...urls,
    action: campaignUrl(urls.action, `lifecycle_${kind.toLowerCase()}`),
  };
  products = products.map((product) => ({
    ...product,
    url: campaignUrl(product.url, `lifecycle_${kind.toLowerCase()}`),
  }));
  const message = copy[kind];
  const subject =
    kind === 'NEW_ARRIVAL' && products[0]
      ? `Disponible sur Caldera : ${products[0].name}`.replace(/[\r\n]/g, ' ')
      : message.subject;
  const lines = products
    .slice(0, 4)
    .map(
      (p) =>
        `${p.name}${p.quantity ? ` × ${p.quantity}` : ''} — ${p.price}${p.stock !== undefined ? ` · Plus que ${p.stock} exemplaire${p.stock > 1 ? 's' : ''} disponible${p.stock > 1 ? 's' : ''}` : ''}`,
    );
  const button = (url: string, label: string) =>
    `<a href="${escapeHtml(url)}" style="display:inline-block;padding:14px 22px;margin:12px 0;background:#003c2d;color:#fff;text-decoration:none;border-radius:4px">${escapeHtml(label)}</a>`;
  const html = emailLayout({
    subject,
    logo: urls.logo,
    label:
      kind === 'CART_FIRST' || kind === 'CART_SECOND'
        ? 'Votre sélection'
        : kind === 'WELCOME'
          ? 'Bienvenue à Caldera'
          : 'Votre rendez-vous Caldera',
    preheader: message.body,
    content: `<h1>${escapeHtml(subject)}</h1><p>${escapeHtml(message.body)}</p>${products
      .slice(0, 4)
      .map(
        (p) =>
          `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px;border:1px solid #ddd6c4;background:#f6f2e8"><tr><td style="padding:20px"><p style="margin:0 0 8px;font-size:17px;line-height:1.4"><a href="${escapeHtml(p.url)}" style="color:#173e32;text-decoration:none"><strong>${escapeHtml(p.name)}</strong></a></p><p style="margin:0;font-size:21px;font-weight:700;color:#123d31">${escapeHtml(p.price)}${p.quantity ? `<span style="font-size:13px;font-weight:400;color:#526157"> · Quantité : ${p.quantity}</span>` : ''}</p>${p.stock !== undefined ? `<p style="margin:8px 0 0;font-size:13px;color:#76551e">Plus que ${p.stock} exemplaire${p.stock > 1 ? 's' : ''} disponible${p.stock > 1 ? 's' : ''}</p>` : ''}</td></tr></table>`,
      )
      .join('')}${button(urls.action, message.cta)}`,
    footer: `<p style="margin:18px 0 0;font-size:12px;line-height:1.8"><a href="${escapeHtml(urls.preferences)}" style="color:#345b48">Gérer mes préférences</a><br><a href="${escapeHtml(urls.unsubscribe)}" style="color:#345b48">Me désinscrire des e-mails commerciaux</a></p>`,
  });
  return {
    subject,
    html,
    text: [
      subject,
      message.body,
      ...products
        .slice(0, 4)
        .map((p, i) => `${lines[i]}\nVoir le produit : ${p.url}`),
      `${message.cta} : ${urls.action}`,
      `Préférences : ${urls.preferences}`,
      `Désinscription : ${urls.unsubscribe}`,
      EMAIL_SOCIAL_LINKS_TEXT,
    ].join('\n\n'),
  };
}
