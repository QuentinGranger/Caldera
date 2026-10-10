/** Editorial choices share the existing product tags: no parallel catalogue. */
export const SHOPPING_INTENTS = [
  {
    guide: 'etb-display-ou-booster',
    slug: 'pour-commencer',
    title: 'Pour commencer',
    description:
      'Votre premier choix commence par une envie : jouer ou découvrir des cartes.',
    advice:
      'Pour jouer, vérifiez qu’il s’agit d’un deck prêt à jouer. Un booster seul ne constitue pas un deck.',
  },
  {
    guide: 'debuter-collection-cartes-pokemon',
    slug: 'pour-collectionner',
    title: 'Pour collectionner',
    description:
      'Choisissez une extension, un Pokémon ou une illustration qui vous plaît.',
    advice:
      'Comparez la langue, le contenu et le format. Le contenu aléatoire des boosters ne garantit aucune carte précise.',
  },
  {
    guide: 'conserver-produits-scelles',
    slug: 'a-garder-scelle',
    title: 'À garder scellé',
    description:
      'Vous préférez conserver le produit dans son emballage d’origine ?',
    advice:
      'Prévoyez une protection adaptée, à l’abri de l’humidité et de la lumière. Vérifiez aussi les dimensions pour choisir sa protection.',
  },
] as const;
export type ShoppingIntent = (typeof SHOPPING_INTENTS)[number]['slug'];
export const MERCHANDISING = {
  'nouveaute-de-la-semaine': {
    title: 'Nouveauté de la semaine',
    description:
      'Les nouveautés publiées sur Caldera au cours des sept derniers jours, disponibles en stock.',
    note: 'La date correspond à la publication sur Caldera, pas nécessairement à la sortie de l’extension.',
  },
  'derniers-exemplaires': {
    title: 'Derniers exemplaires',
    description:
      'Les références dont les variantes actives atteignent leur seuil de stock faible.',
    note: 'Le stock disponible tient compte des quantités réservées. Un produit épuisé disparaît de cette sélection.',
  },
  'retour-en-stock': {
    title: 'Retour en stock',
    description:
      'Des références dont une variante est revenue en stock au cours des trente derniers jours.',
    note: 'Un retour repose sur un réapprovisionnement enregistré après une rupture, avec un stock antérieur documenté.',
  },
  'du-moment': {
    title: 'Sélection du moment',
    description:
      'Les produits choisis par l’équipe de Caldera pour vous aider à explorer le catalogue.',
    note: 'Une sélection éditoriale, sans classement de popularité ni promesse de rareté.',
  },
  ...Object.fromEntries(
    SHOPPING_INTENTS.map((intent) => [
      intent.slug,
      {
        title: intent.title,
        description: intent.description,
        note: intent.advice,
      },
    ]),
  ),
} as Record<
  | ShoppingIntent
  | 'nouveaute-de-la-semaine'
  | 'derniers-exemplaires'
  | 'retour-en-stock'
  | 'du-moment',
  { title: string; description: string; note: string }
>;
export type MerchandisingKey = keyof typeof MERCHANDISING;
export const merchandisingPath = (key: MerchandisingKey) =>
  `/selections/${key}`;
export const isMerchandisingKey = (value: string): value is MerchandisingKey =>
  Object.hasOwn(MERCHANDISING, value);
export const isIntentTag = (slug: string) =>
  SHOPPING_INTENTS.some((intent) => intent.slug === slug);

export const isStockMerchandising = (key: MerchandisingKey) =>
  key === 'nouveaute-de-la-semaine' ||
  key === 'derniers-exemplaires' ||
  key === 'retour-en-stock';
