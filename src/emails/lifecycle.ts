import { escapeHtml } from './templates';
import {
  EMAIL_SOCIAL_LINKS_HTML,
  EMAIL_SOCIAL_LINKS_TEXT,
} from './social-links';
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
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head><body style="margin:0;padding:20px 8px;background:#f6f1e4;color:#173e32;font-family:Arial,sans-serif;line-height:1.6"><main style="max-width:640px;margin:auto;background:#fffcf5"><header style="padding:26px;background:#003c2d;border-bottom:3px solid #e8c261"><img src="${escapeHtml(urls.logo)}" width="240" alt="Les Terres de Caldera" style="max-width:100%;height:auto"></header><section style="padding:24px"><h1 style="font-family:Georgia,serif;font-size:30px;line-height:1.2">${escapeHtml(subject)}</h1><p>${escapeHtml(message.body)}</p>${products
    .slice(0, 4)
    .map(
      (p, i) =>
        `<p><a href="${escapeHtml(p.url)}" style="color:#173e32"><strong>${escapeHtml(lines[i] ?? p.name)}</strong></a></p>`,
    )
    .join(
      '',
    )}${button(urls.action, message.cta)}<p style="font-size:12px"><a href="${escapeHtml(urls.preferences)}">Gérer mes préférences</a> · <a href="${escapeHtml(urls.unsubscribe)}">Me désinscrire des e-mails commerciaux</a></p></section><footer style="padding:20px 24px;border-top:1px solid #d8d5c7;font-size:13px">Les Terres de Caldera${EMAIL_SOCIAL_LINKS_HTML}</footer></main></body></html>`;
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
