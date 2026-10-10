// The shop's FAQ (/questions). Every answer restates the CGV (/cgv, version
// of 21 September 2026) or what the site does, and quotes its labels as the
// visitor sees them. Figures come from the same sources as the pages they
// summarise: delivery from the active shipping methods and the CGV
// constants, returns from RETURN_POLICY, contact from ORGANIZATION.
import 'server-only';
import { cache } from 'react';
import { createSlug } from '@/lib/catalog/createSlug';
import { formatEuro } from '@/lib/seo/metadata';
import {
  LEGAL_IDENTITY,
  ORGANIZATION,
  RETURN_POLICY,
} from '@/lib/seo/policies';
import { getShippingFacts, type ShippingFact } from '@/lib/seo/shipping';
import {
  DELIVERY_PATH,
  DELIVERY_ZONE,
  handlingLabel,
  priceLabel,
  transitLabel,
} from './delivery';

/** Date the answers were last checked against the CGV and the site. */
export const SHOP_FAQ_UPDATED = new Date('2026-10-01T00:00:00Z');

export interface ShopFaqItem {
  id: string;
  question: string;
  /** Markdown: links to the CGV articles and the pages concerned. */
  answer: string;
}
export interface ShopFaqGroup {
  id: string;
  title: string;
  items: ShopFaqItem[];
}

const cgv = (article: number, label = `article ${article}`) =>
  `[${label}](/cgv#article-${article})`;

/** The active methods as listed on /livraison: price, free threshold, transit. */
export function shippingAnswer(methods: readonly ShippingFact[]): string {
  if (!methods.length)
    return `Les modes de livraison disponibles et leurs frais sont indiqués pendant la commande, avant sa validation (${cgv(5)} et ${cgv(10, 'article 10.2')}).`;
  const lines = methods.map((method) => {
    const transit = transitLabel(method);
    return `- **${method.name}** : ${priceLabel(method.price)}${
      method.freeFromAmount
        ? `, offerte dès ${formatEuro(method.freeFromAmount)} d’achat`
        : ''
    }${transit ? ` ; acheminement estimé à ${transit}` : ''}.`;
  });
  return [
    'Les modes proposés aujourd’hui :',
    lines.join('\n'),
    `Les frais sont indiqués avant la validation de la commande (${cgv(5)}) ; le détail figure sur la page [Livraison](${DELIVERY_PATH}).`,
  ].join('\n\n');
}

/** The questions, in the order of an order: before, during, after. */
export function buildShopFaq(methods: readonly ShippingFact[]): ShopFaqGroup[] {
  const email = ORGANIZATION.email;
  const days = RETURN_POLICY.days;
  const { street, postalCode, locality } = LEGAL_IDENTITY.address;
  const groups: { title: string; items: [string, string][] }[] = [
    {
      title: 'Commander',
      items: [
        [
          'Faut-il un compte pour commander ?',
          'Non, vous pouvez commander sans compte. Le compte est gratuit et jamais obligatoire : il réunit vos commandes, y compris celles passées sans compte avec la même adresse e-mail une fois celle-ci vérifiée, votre adresse de livraison et vos alertes de stock. [Créer un compte](/compte/inscription)',
        ],
        [
          'Un produit ajouté au panier est-il réservé ?',
          `Non. L’ajout au panier ne constitue pas une réservation : le stock est attribué à la validation de la commande et à l’autorisation du paiement (${cgv(4)}). Un produit peut donc s’épuiser entre-temps.`,
        ],
        [
          'Comment savoir si un produit est disponible ?',
          `Chaque produit affiche sa disponibilité : « En stock », « Dernières pièces » ou « Rupture ». Les produits sont proposés dans la limite des stocks disponibles (${cgv(4)}).`,
        ],
        [
          'Y a-t-il un montant minimum de commande ?',
          `Non, aucun montant minimum n’est imposé (${cgv(5)}).`,
        ],
        [
          'Les prix incluent-ils la TVA ?',
          `Les prix sont indiqués en euros TTC. CALDERA bénéficie de la franchise en base de TVA : aucune TVA n’est facturée tant que ce régime s’applique (TVA non applicable, article 293 B du Code général des impôts). Les frais de livraison sont indiqués séparément, avant la validation de la commande (${cgv(5)}).`,
        ],
        [
          'Comment utiliser un code promo ?',
          `Saisissez-le dans le champ « Code promo » pendant la commande. Les conditions de chaque offre (durée, produits concernés, montant minimum, cumul) sont précisées lors de l’opération, et une promotion ne s’applique pas à une commande déjà validée (${cgv(6)}).`,
        ],
      ],
    },
    {
      title: 'Paiement et facture',
      items: [
        [
          'Quels moyens de paiement acceptez-vous ?',
          `Les paiements sont traités par Stripe. Selon leur activation et votre éligibilité, peuvent être proposés la carte bancaire, Apple Pay, Google Pay, PayPal et Klarna : les moyens effectivement disponibles s’affichent à l’étape du paiement (${cgv(9)}).`,
        ],
        [
          'Mes données bancaires sont-elles protégées ?',
          `Vous payez dans le formulaire sécurisé de Stripe, et CALDERA ne stocke pas les numéros complets de carte bancaire (${cgv(9, 'articles 9')} et ${cgv(24, '24')}).`,
        ],
        [
          'Quand suis-je débité ?',
          `Le paiement est exigible lors de la commande : le montant total, frais de livraison compris, est réglé à sa validation (${cgv(9)}). Un e-mail de confirmation récapitule ensuite votre commande (${cgv(7)}).`,
        ],
        [
          'Vais-je recevoir une facture ?',
          'Oui. Elle est établie dès la confirmation du paiement et se télécharge depuis la page de votre commande, rubrique « Vos documents ».',
        ],
      ],
    },
    {
      title: 'Livraison',
      items: [
        [
          'Où livrez-vous ?',
          `Uniquement en ${DELIVERY_ZONE} pour le moment (${cgv(10, 'article 10.1')}).`,
        ],
        [
          'Sous quel délai ma commande est-elle expédiée ?',
          `Les commandes sont préparées et expédiées sous ${handlingLabel()} après confirmation du paiement (${cgv(10, 'article 10.3')}). Ce délai ne comprend pas l’acheminement par le transporteur, dont l’estimation est indiquée lors de la commande (${cgv(10, 'article 10.4')}).`,
        ],
        [
          'Quels sont les modes et les frais de livraison ?',
          shippingAnswer(methods),
        ],
        [
          'Comment suivre ma commande ?',
          'Chaque e-mail de commande contient un lien « Voir ma commande », valable 180 jours. À l’expédition, un e-mail vous indique le transporteur et, lorsqu’il est disponible, le numéro de suivi avec un lien « Suivre mon colis ». Avec un compte, vos commandes se retrouvent aussi dans « Mes commandes ».',
        ],
        [
          'Mon colis est arrivé abîmé : que faire ?',
          `Vérifiez l’état extérieur du colis à sa réception. Pour un colis ou un article endommagé, incorrect ou non conforme, signalez-le depuis la page de votre commande (rubrique « Retour ou rétractation ») ou écrivez-nous à ${email}, avec votre numéro de commande et, si utile, des photos (${cgv(11)}). Les garanties légales de conformité et des vices cachés s’appliquent (${cgv(16)}).`,
        ],
      ],
    },
    {
      title: 'Retours et remboursements',
      items: [
        [
          'Puis-je changer d’avis après réception ?',
          `Oui. Vous disposez de ${days} jours à compter de la réception pour vous rétracter, sans avoir à vous justifier (${cgv(12)}). Vous pouvez le faire depuis la page de votre commande (« Se rétracter du contrat ici »), avec le [formulaire de rétractation](/retractation), par e-mail à ${email} ou par toute autre déclaration dénuée d’ambiguïté.`,
        ],
        [
          'Comment renvoyer un produit ?',
          // The return deadline (the return e-mail), not the withdrawal period.
          `Après votre demande, renvoyez les articles sans retard excessif, au plus tard 14 jours après celle-ci, à CALDERA, ${street}, ${postalCode} ${locality}. Utilisez un envoi suivi et retournez-les dans leur état d’origine, avec leurs protections. Les frais de retour sont à votre charge (${cgv(12, 'article 12.3')}).`,
        ],
        [
          'Puis-je retourner un produit scellé que j’ai ouvert ?',
          `L’ouverture d’un produit scellé ne supprime pas automatiquement le droit de rétractation. En revanche, l’ouverture ou l’altération irréversible de son emballage peut être prise en compte pour une éventuelle dépréciation, déduite du remboursement (${cgv(13)}). Une carte à l’unité se renvoie de préférence dans les protections avec lesquelles elle a été expédiée.`,
        ],
        [
          'Quand serai-je remboursé ?',
          `Après une rétractation, le remboursement, frais de livraison compris dans les limites prévues par la loi, intervient sans retard injustifié et au plus tard dans le délai légal ; il peut attendre la réception du produit ou la preuve de son expédition (${cgv(14)}). Pour une annulation ou un produit indisponible, il intervient au plus tard 14 jours après être devenu dû (${cgv(15)}). Il est effectué sur le moyen de paiement utilisé à la commande ; le montant apparaît ensuite sur votre compte sous 5 à 10 jours ouvrés selon votre banque.`,
        ],
        [
          'Et si un produit commandé n’est plus disponible ?',
          `Si un produit devient indisponible après la validation et le paiement de la commande, vous en êtes informé dans les meilleurs délais et il est intégralement remboursé ; s’il constituait toute la commande, celle-ci est annulée et remboursée intégralement (${cgv(4)}).`,
        ],
      ],
    },
    {
      title: 'Alertes et nouveautés',
      items: [
        [
          'Un produit est épuisé : comment être prévenu de son retour ?',
          'Sur sa fiche, la version épuisée propose « Être prévenu du retour » : vous recevez un seul e-mail, lorsqu’elle revient. Sans compte, confirmez d’abord votre adresse grâce à l’e-mail reçu ; avec un compte, l’alerte est envoyée à l’adresse du compte et se retrouve dans « Alertes de stock ».',
        ],
        [
          'Comment suivre les nouveautés et les réassorts ?',
          'Inscrivez-vous à [la lettre de Caldera](/#newsletter) : nouvelles extensions, réassorts et sélections, par e-mail. L’inscription ne devient active qu’après votre clic dans l’e-mail de confirmation, et vous pouvez vous désinscrire à tout moment.',
        ],
        [
          'Puis-je garder une sélection de produits ?',
          'Oui, avec le cœur présent sur chaque produit. Sans compte, vos [favoris](/favoris) sont conservés pendant votre session ; une fois connecté, ils sont enregistrés dans votre compte.',
        ],
      ],
    },
    {
      title: 'Contact et données',
      items: [
        [
          'Comment vous contacter ?',
          `Par le [formulaire de contact](/contact), en choisissant le motif de votre demande (une commande, un produit ou le stock, la livraison ou autre chose), ou par e-mail à ${email}. Pour une commande, indiquez son numéro (${cgv(17)}).`,
        ],
        [
          'Comment exercer mes droits sur mes données personnelles ?',
          `La [politique de confidentialité](/confidentialite) détaille les données collectées, leurs finalités, leurs durées de conservation et vos droits. Vos demandes peuvent être adressées à ${email} (${cgv(24)}).`,
        ],
      ],
    },
  ];
  const ids = new Set<string>();
  const unique = (text: string) => {
    const id = createSlug(text, ids);
    ids.add(id);
    return id;
  };
  return groups.map((group) => ({
    id: unique(group.title),
    title: group.title,
    items: group.items.map(([question, answer]) => ({
      id: unique(question),
      question,
      answer,
    })),
  }));
}

/** The FAQ with the shipping methods active today. */
export const getShopFaq = cache(async (): Promise<ShopFaqGroup[]> =>
  buildShopFaq(await getShippingFacts()),
);

/** Plain text of an answer, for the FAQPage data: links keep their words. */
export function plainAnswer(markdown: string): string {
  return markdown
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/^- /gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}
