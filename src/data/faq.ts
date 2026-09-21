export type FaqItem = {
  question: string;
  answer: string[];
};

export type FaqSection = {
  id: string;
  title: string;
  eyebrow: string;
  items: FaqItem[];
};

export const faqSections: FaqSection[] = [
  {
    id: 'commandes',
    title: 'Commandes',
    eyebrow: 'Préparer son expédition',
    items: [
      {
        question: 'Comment passer une commande ?',
        answer: [
          'Ajoutez les produits que vous souhaitez à votre panier, puis suivez les différentes étapes du paiement.',
          'Une fois votre commande validée, vous recevrez une confirmation à l’adresse e-mail renseignée lors de votre achat.',
        ],
      },
      {
        question: 'Puis-je modifier ma commande après l’avoir passée ?',
        answer: [
          'Si votre commande n’a pas encore été préparée ou expédiée, contactez-nous rapidement.',
          'Nous ferons notre possible pour modifier ou annuler la commande, mais nous ne pouvons pas garantir que cela sera encore possible une fois sa préparation commencée.',
        ],
      },
      {
        question: 'Je n’ai pas reçu mon e-mail de confirmation. Que faire ?',
        answer: [
          'Vérifiez d’abord votre dossier spam ou courrier indésirable.',
          'Si vous ne trouvez toujours rien, contactez-nous en indiquant l’adresse e-mail utilisée lors de la commande.',
        ],
      },
      {
        question: 'Un produit dans mon panier est-il réservé ?',
        answer: [
          'Non. Ajouter un produit au panier ne garantit pas sa réservation.',
          'Le stock est définitivement attribué lorsque la commande et le paiement sont validés.',
        ],
      },
    ],
  },
  {
    id: 'produits-pokemon-jcc',
    title: 'Produits Pokémon et JCC',
    eyebrow: 'Objets de collection',
    items: [
      {
        question: 'Les produits vendus sont-ils authentiques ?',
        answer: [
          'Oui. Les Terres de Caldera commercialisent uniquement des produits que nous considérons comme authentiques et provenant de sources professionnelles ou vérifiées.',
          'Nous ne vendons volontairement aucune contrefaçon.',
        ],
      },
      {
        question: 'Vendez-vous des produits scellés ?',
        answer: [
          'Oui.',
          'Selon les stocks disponibles, vous pourrez notamment retrouver des boosters, bundles, coffrets, collections, displays, ETB, mini-tins et autres produits scellés.',
        ],
      },
      {
        question: 'Vendez-vous aussi des cartes à l’unité ?',
        answer: [
          'Le catalogue peut proposer des cartes à l’unité en complément des produits scellés.',
          'Lorsque l’état d’une carte est important, celui-ci est précisé directement sur sa fiche produit.',
        ],
      },
      {
        question:
          'Les illustrations des produits correspondent-elles exactement au produit reçu ?',
        answer: [
          'Nous faisons notre maximum pour utiliser des visuels fidèles.',
          'Certaines images peuvent toutefois être utilisées à titre illustratif, notamment lorsque plusieurs variantes d’un même produit existent. Le titre et la description de la fiche produit restent les éléments de référence.',
        ],
      },
      {
        question:
          'Une carte rare est-elle garantie dans un booster ou un coffret ?',
        answer: [
          'Non.',
          'Le contenu aléatoire des boosters dépend entièrement de leur fabrication par l’éditeur.',
          'L’achat d’un produit scellé ne garantit donc pas l’obtention d’une carte particulière, sauf lorsque celle-ci est explicitement incluse dans le produit.',
        ],
      },
      {
        question:
          'Pouvez-vous garantir la valeur future d’une carte ou d’un produit scellé ?',
        answer: [
          'Non.',
          'Les prix du marché des cartes et produits de collection peuvent évoluer à la hausse comme à la baisse.',
          'Les Terres de Caldera ne garantissent aucune valeur de revente ni aucune performance financière future.',
        ],
      },
    ],
  },
  {
    id: 'stock-disponibilite',
    title: 'Stock et disponibilité',
    eyebrow: 'Ressources des territoires',
    items: [
      {
        question: 'Les stocks affichés sur le site sont-ils réels ?',
        answer: [
          'Notre objectif est d’afficher un stock correspondant aux produits réellement disponibles.',
          'Dans de rares situations, notamment lors de sorties très demandées, plusieurs commandes peuvent être enregistrées presque simultanément. Si un problème de stock survient après votre achat, nous vous contacterons rapidement.',
        ],
      },
      {
        question: 'Un produit est épuisé. Sera-t-il de nouveau disponible ?',
        answer: [
          'Cela dépend du produit et des possibilités de réapprovisionnement.',
          'Certains produits peuvent revenir en stock tandis que d’autres ne sont disponibles qu’en quantités limitées.',
        ],
      },
      {
        question: 'Proposez-vous des précommandes ?',
        answer: [
          'Lorsque des précommandes sont proposées, cela est clairement indiqué sur la fiche du produit avec les informations disponibles concernant sa sortie et son expédition.',
          'Une date annoncée par un fabricant, distributeur ou éditeur peut parfois évoluer indépendamment de notre volonté.',
        ],
      },
    ],
  },
  {
    id: 'prix',
    title: 'Prix',
    eyebrow: 'Valeur des découvertes',
    items: [
      {
        question: 'Comment fixez-vous vos prix ?',
        answer: [
          'Nos prix prennent notamment en compte notre coût d’achat, la disponibilité des produits, les frais liés à leur commercialisation et les conditions du marché.',
          'Certains produits de collection très recherchés peuvent donc évoluer en prix au fil du temps.',
        ],
      },
      {
        question:
          'Pourquoi certains produits sont-ils plus chers que leur prix de sortie ?',
        answer: [
          'Certains produits deviennent difficiles à obtenir après leur sortie ou sont disponibles en quantités très limitées.',
          'Leur prix peut alors évoluer en fonction de leur disponibilité et du marché.',
        ],
      },
      {
        question: 'Les prix affichés peuvent-ils changer ?',
        answer: [
          'Oui.',
          'Le prix d’un produit peut évoluer entre deux réapprovisionnements ou en fonction des conditions d’approvisionnement.',
          'Une commande déjà payée conserve évidemment le prix qui était affiché au moment de son achat.',
        ],
      },
    ],
  },
  {
    id: 'paiement',
    title: 'Paiement',
    eyebrow: 'Passage sécurisé',
    items: [
      {
        question: 'Quels moyens de paiement acceptez-vous ?',
        answer: [
          'Les moyens de paiement disponibles sont affichés directement au moment du passage de la commande.',
        ],
      },
      {
        question: 'Le paiement est-il sécurisé ?',
        answer: [
          'Les paiements en ligne sont traités via des prestataires de paiement spécialisés.',
          'Les Terres de Caldera ne stockent pas directement les informations complètes de votre carte bancaire.',
        ],
      },
      {
        question: 'Mon paiement a été refusé. Que faire ?',
        answer: [
          'Vérifiez les informations saisies ainsi que les éventuelles restrictions appliquées par votre banque.',
          'Vous pouvez également réessayer ou utiliser un autre moyen de paiement lorsqu’il est proposé.',
        ],
      },
    ],
  },
  {
    id: 'livraison',
    title: 'Livraison',
    eyebrow: 'Acheminer votre collection',
    items: [
      {
        question: 'Où livrez-vous ?',
        answer: [
          'Les destinations actuellement disponibles sont indiquées lors de la validation de votre commande.',
        ],
      },
      {
        question: 'Quels transporteurs utilisez-vous ?',
        answer: [
          'Les modes de livraison disponibles apparaissent au moment de votre commande selon votre adresse, la nature du colis et les options actuellement proposées par Les Terres de Caldera.',
        ],
      },
      {
        question: 'Combien coûte la livraison ?',
        answer: [
          'Les frais de livraison sont calculés avant le paiement en fonction notamment de la destination, du transporteur choisi et des caractéristiques de votre commande.',
          'Vous connaîtrez donc toujours le montant avant de confirmer votre achat.',
        ],
      },
      {
        question: 'Quand ma commande sera-t-elle expédiée ?',
        answer: [
          'Nous préparons les commandes aussi rapidement que possible.',
          'Une estimation ou un statut de commande pourra être communiqué selon le mode de livraison utilisé.',
          'Pour les produits en précommande, l’expédition intervient lorsque les produits sont effectivement disponibles.',
        ],
      },
      {
        question: 'Puis-je suivre mon colis ?',
        answer: [
          'Lorsqu’un suivi est proposé par le transporteur, vous recevrez les informations correspondantes dès que votre colis aura été pris en charge.',
        ],
      },
    ],
  },
  {
    id: 'reception-colis',
    title: 'Réception du colis',
    eyebrow: 'À l’arrivée',
    items: [
      {
        question: 'Mon colis est arrivé endommagé. Que dois-je faire ?',
        answer: [
          'Prenez des photos du colis avant son ouverture si son état extérieur semble anormal.',
          'Prenez également des photos des produits concernés et contactez-nous rapidement en précisant votre numéro de commande.',
          'Ces éléments nous permettront d’étudier la situation avec vous et, lorsque nécessaire, avec le transporteur.',
        ],
      },
      {
        question: 'Il manque un produit dans ma commande.',
        answer: [
          'Contactez-nous avec votre numéro de commande en indiquant le produit manquant.',
          'Nous vérifierons la préparation de votre commande afin de vous proposer une solution adaptée.',
        ],
      },
      {
        question: 'J’ai reçu le mauvais produit.',
        answer: [
          'Contactez-nous avec votre numéro de commande et, si possible, une photo du produit reçu.',
          'Nous vous indiquerons la procédure à suivre.',
        ],
      },
    ],
  },
  {
    id: 'retours-remboursements',
    title: 'Retours et remboursements',
    eyebrow: 'Revenir sur ses pas',
    items: [
      {
        question: 'Puis-je retourner une commande ?',
        answer: [
          'Les modalités de retour dépendent de la nature du produit, de son état et des dispositions légales applicables.',
          'Pour qu’un produit puisse éventuellement être repris, il doit notamment être conservé dans l’état requis pour son retour.',
          'Consultez nos conditions générales de vente ou contactez-nous avant tout renvoi.',
        ],
      },
      {
        question: 'Puis-je retourner un produit Pokémon que j’ai ouvert ?',
        answer: [
          'Un produit scellé qui a été ouvert, descellé ou dont l’emballage a été altéré ne peut généralement pas être considéré de la même manière qu’un produit encore intact.',
          'Contactez-nous avant tout retour afin que nous puissions examiner votre situation.',
        ],
      },
      {
        question: 'Sous combien de temps suis-je remboursé ?',
        answer: [
          'Lorsqu’un remboursement est validé, celui-ci est effectué via le moyen de paiement approprié.',
          'Le délai d’apparition du remboursement sur votre compte dépend ensuite notamment de votre banque ou de votre prestataire de paiement.',
        ],
      },
    ],
  },
  {
    id: 'compte-client',
    title: 'Compte client',
    eyebrow: 'Carnet de voyage',
    items: [
      {
        question: 'Dois-je créer un compte pour commander ?',
        answer: [
          'Les possibilités disponibles sont indiquées directement lors du passage de commande.',
          'Créer un compte permet notamment de retrouver plus facilement vos informations et le suivi de vos commandes lorsque ces fonctionnalités sont disponibles.',
        ],
      },
      {
        question: 'J’ai oublié mon mot de passe.',
        answer: [
          'Utilisez la fonction « Mot de passe oublié » depuis l’espace de connexion.',
          'Vous recevrez les instructions nécessaires à l’adresse e-mail associée à votre compte.',
        ],
      },
    ],
  },
  {
    id: 'protection-donnees',
    title: 'Protection des données',
    eyebrow: 'Vos informations',
    items: [
      {
        question: 'Comment mes données personnelles sont-elles utilisées ?',
        answer: [
          'Nous utilisons uniquement les informations nécessaires au fonctionnement de la boutique, notamment pour gérer vos commandes, vos paiements, leur livraison et la relation client.',
          'Vous pouvez consulter notre politique de confidentialité pour obtenir davantage d’informations.',
        ],
      },
      {
        question:
          'Mes coordonnées bancaires sont-elles enregistrées par Les Terres de Caldera ?',
        answer: [
          'Les informations bancaires nécessaires au paiement sont traitées par les prestataires de paiement utilisés par la boutique.',
          'Les Terres de Caldera ne stockent pas directement le numéro complet de votre carte bancaire.',
        ],
      },
    ],
  },
  {
    id: 'caldera',
    title: 'Les Terres de Caldera',
    eyebrow: 'L’univers de la boutique',
    items: [
      {
        question: 'Qu’est-ce que Les Terres de Caldera ?',
        answer: [
          'Les Terres de Caldera est une boutique dédiée aux jeux de cartes à collectionner et à leur univers.',
          'Notre objectif est de proposer une expérience qui va au-delà d’un simple catalogue : découvrir des produits, suivre l’actualité du JCC, explorer nos contenus et développer sa collection dans un univers propre à Caldera.',
        ],
      },
      {
        question: 'Pourquoi le nom « Les Terres de Caldera » ?',
        answer: [
          'Caldera est l’univers original imaginé autour de la boutique.',
          'Forêts, montagnes, terres volcaniques, routes commerciales et territoires oubliés composent cet univers d’exploration qui accompagne l’identité de la marque.',
        ],
      },
      {
        question: 'Pokémon appartient-il aux Terres de Caldera ?',
        answer: [
          'Non.',
          'Pokémon et les marques associées appartiennent à leurs propriétaires respectifs.',
          'Les Terres de Caldera est une boutique indépendante et n’est pas affiliée, sponsorisée ou administrée par The Pokémon Company, Nintendo, Game Freak ou Creatures Inc., sauf indication contraire concernant un éventuel partenariat officiel.',
        ],
      },
    ],
  },
];
