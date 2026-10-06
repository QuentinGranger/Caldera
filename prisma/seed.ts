import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  getCategoryImage,
  getProductPlaceholder,
} from '../src/lib/catalog/images';
import {
  PrismaClient,
  type ProductType,
  type ProductLanguage,
  type ProductStatus,
} from '../src/generated/prisma/client';

const connectionString = process.env.DATABASE_URL;
if (!connectionString)
  throw new Error('DATABASE_URL est requise pour le seed.');
if (process.env.NODE_ENV === 'production')
  throw new Error('Ce seed de développement est interdit en production.');
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

// Fictional dates relative to the seed run, so the calendar and preorders always
// have past and upcoming releases.
const today = new Date();
function daysFromToday(days: number) {
  return new Date(
    Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate() + days,
    ),
  );
}
const pokemonFaq = [
  {
    question: 'Quels produits Pokémon puis-je trouver sur Caldera ?',
    answer:
      'Caldera propose une sélection de produits du JCC Pokémon, notamment des boosters, displays, coffrets, bundles, ETB et autres produits scellés. La sélection évolue selon les sorties et les disponibilités.',
  },
  {
    question: 'Comment choisir entre les différentes extensions Pokémon ?',
    answer:
      'Chaque extension possède son propre univers, ses cartes et ses raretés. Vous pouvez consulter les pages dédiées aux extensions pour découvrir leur contenu, leur date de sortie et les produits disponibles sur Caldera.',
  },
];
const familyFaq: Record<string, { question: string; answer: string }[]> = {
  scelles: [
    {
      question:
        'Quels produits trouve-t-on dans la famille des produits scellés ?',
      answer:
        'Cette famille regroupe les boosters, displays, ETB et coffrets scellés présents au catalogue. Les produits affichés évoluent selon les sorties et les disponibilités.',
    },
  ],
  boosters: [
    {
      question: 'Quelles présentations de boosters puis-je consulter ?',
      answer:
        'Cette famille rassemble les boosters à l’unité, blisters, tripacks et bundles proposés au catalogue. Consultez la fiche de chaque produit pour connaître son extension, sa langue et sa disponibilité.',
    },
  ],
  displays: [
    {
      question: 'Qu’est-ce qu’un display de cartes à collectionner ?',
      answer:
        'Un display est une boîte de boosters scellée. Consultez sa fiche produit pour connaître l’extension, la langue et les informations propres à cette boîte.',
    },
  ],
  etb: [
    {
      question: 'Que signifie ETB ?',
      answer:
        'ETB signifie « Elite Trainer Box », ou « Coffret Dresseur d’élite » en français. Consultez la fiche de chaque ETB pour connaître l’extension et le contenu indiqué pour ce produit.',
    },
  ],
  coffrets: [
    {
      question: 'Quels formats trouve-t-on dans la famille des coffrets ?',
      answer:
        'Cette famille rassemble les coffrets de collection, tins et decks présents au catalogue. Le contenu varie selon le produit : consultez sa fiche pour le détail.',
    },
  ],
  cartes: [
    {
      question: 'Où trouver des cartes vendues à l’unité ?',
      answer:
        'Les cartes proposées individuellement sont regroupées dans cette famille. Consultez chaque fiche pour vérifier la carte et les informations disponibles avant de choisir.',
    },
  ],
  accessoires: [
    {
      question: 'Quels accessoires puis-je trouver dans cette famille ?',
      answer:
        'Cette famille regroupe les protège-cartes, classeurs et articles de rangement présents au catalogue. Consultez la fiche de chaque article pour vérifier son usage et ses caractéristiques.',
    },
  ],
};
function demoIntro(subject: string) {
  return `[Démo] Texte éditorial de démonstration pour ${subject}.\n\nIl sert à tester le rendu Markdown des pages : **mise en valeur**, listes et [liens internes](/catalogue).\n\n- Contenu fictif, non relu.\n- À remplacer par un texte écrit pour la boutique.`;
}

type DemoProductType = Exclude<ProductType, 'OTHER'>;
const familyByType: Record<DemoProductType, string> = {
  DISPLAY: 'displays',
  BOOSTER: 'boosters',
  BLISTER: 'boosters',
  TRIPACK: 'boosters',
  BUNDLE: 'boosters',
  ETB: 'etb',
  COLLECTION_BOX: 'coffrets',
  TIN: 'coffrets',
  DECK: 'coffrets',
  SINGLE_CARD: 'cartes',
  ACCESSORY: 'accessoires',
};

const games = [
  {
    slug: 'pokemon',
    name: 'Pokémon',
    shortName: 'Pokémon',
    description:
      'Le jeu de cartes à collectionner Pokémon : produits scellés, cartes à l’unité et accessoires.',
    intro: demoIntro('le hub Pokémon'),
    faq: pokemonFaq,
    sortOrder: 0,
  },
] as const;

type CategorySeed = {
  slug: string;
  name: string;
  parent: string | null;
  sortOrder: number;
  description: string;
  intro?: string;
  faq?: { question: string; answer: string }[];
};
const categories: CategorySeed[] = [
  {
    slug: 'scelles',
    name: 'Produits scellés',
    parent: null,
    sortOrder: 0,
    description: 'Boosters, displays, ETB et coffrets encore scellés.',
    faq: familyFaq.scelles,
  },
  {
    slug: 'boosters',
    name: 'Boosters',
    parent: 'scelles',
    sortOrder: 1,
    description: 'Boosters à l’unité, blisters, tripacks et bundles.',
    intro: demoIntro('la famille Boosters'),
    faq: familyFaq.boosters,
  },
  {
    slug: 'displays',
    name: 'Displays',
    parent: 'scelles',
    sortOrder: 2,
    description: 'Boîtes de boosters scellées.',
    faq: familyFaq.displays,
  },
  {
    slug: 'etb',
    name: 'ETB',
    parent: 'scelles',
    sortOrder: 3,
    description: 'Coffrets Dresseur d’élite.',
    intro: demoIntro('la famille ETB'),
    faq: familyFaq.etb,
  },
  {
    slug: 'coffrets',
    name: 'Coffrets',
    parent: 'scelles',
    sortOrder: 4,
    description: 'Coffrets de collection, tins et decks.',
    faq: familyFaq.coffrets,
  },
  {
    slug: 'cartes',
    name: 'Cartes à l’unité',
    parent: null,
    sortOrder: 5,
    description: 'Cartes vendues à l’unité.',
    faq: familyFaq.cartes,
  },
  {
    slug: 'accessoires',
    name: 'Accessoires',
    parent: null,
    sortOrder: 6,
    description: 'Protège-cartes, classeurs et rangements.',
    faq: familyFaq.accessoires,
  },
];

type SetSeed = {
  slug: string;
  name: string;
  code: string;
  game: string;
  releaseDate: Date;
  intro?: string;
  seoTitle?: string;
  seoDescription?: string;
};
const sets: SetSeed[] = [
  {
    slug: 'dev-terres-de-braise',
    name: '[Démo] Terres de Braise',
    code: 'DEV-BRAISE',
    game: 'pokemon',
    releaseDate: daysFromToday(-60),
    intro: demoIntro('l’extension Terres de Braise'),
  },
  {
    slug: 'dev-vallees-oubliees',
    name: '[Démo] Vallées Oubliées',
    code: 'DEV-VALLEES',
    game: 'pokemon',
    releaseDate: daysFromToday(-240),
    seoTitle: '[Démo] Vallées Oubliées : titre SEO personnalisé',
    seoDescription:
      '[Démo] Description SEO personnalisée, prioritaire sur la description générée.',
  },
  {
    slug: 'dev-aurores-sauvages',
    name: '[Démo] Aurores Sauvages',
    code: 'DEV-AURORES',
    game: 'pokemon',
    releaseDate: daysFromToday(-10),
  },
  {
    slug: 'dev-sentiers-d-opale',
    name: '[Démo] Sentiers d’Opale',
    code: 'DEV-OPALE',
    game: 'pokemon',
    releaseDate: daysFromToday(90),
  },
];

type Example = {
  slug: string;
  name: string;
  type: DemoProductType;
  sku: string;
  price: string;
  stock: number;
  set?: string;
  /** Only for products without a set; a set always dictates the game. */
  game?: string;
  releaseDate?: Date;
  status?: ProductStatus;
  featured?: boolean;
  newArrival?: boolean;
  preorder?: boolean;
  inactive?: boolean;
  restock?: boolean;
  language?: ProductLanguage;
};
const examples: Example[] = [
  {
    slug: 'dev-etb-terres-de-braise',
    name: '[Démo] ETB — Terres de Braise',
    type: 'ETB',
    sku: 'DEV-ETB-BRAISE-FR',
    price: '59.90',
    stock: 7,
    set: 'dev-terres-de-braise',
    featured: true,
    newArrival: true,
    restock: true,
  },
  {
    slug: 'dev-booster-terres-de-braise',
    name: '[Démo] Booster — Terres de Braise',
    type: 'BOOSTER',
    sku: 'DEV-BST-BRAISE-FR',
    price: '5.90',
    stock: 25,
    set: 'dev-terres-de-braise',
    newArrival: true,
    restock: true,
  },
  {
    slug: 'dev-display-vallees',
    name: '[Démo] Display — Vallées Oubliées',
    type: 'DISPLAY',
    sku: 'DEV-DIS-VALLEES-FR',
    price: '189.90',
    stock: 0,
    set: 'dev-vallees-oubliees',
    featured: true,
  },
  {
    slug: 'dev-coffret-aurores',
    name: '[Démo] Coffret — Aurores Sauvages',
    type: 'COLLECTION_BOX',
    sku: 'DEV-COF-AURORES-FR',
    price: '39.90',
    stock: 0,
    set: 'dev-aurores-sauvages',
    releaseDate: daysFromToday(21),
    newArrival: true,
    preorder: true,
  },
  {
    slug: 'dev-bundle-vallees',
    name: '[Démo] Bundle — Vallées Oubliées',
    type: 'BUNDLE',
    sku: 'DEV-BUN-VALLEES-FR',
    price: '29.90',
    stock: 1,
    set: 'dev-vallees-oubliees',
  },
  {
    slug: 'dev-tin-exploration',
    name: '[Démo] Tin — Exploration',
    type: 'TIN',
    sku: 'DEV-TIN-EXPLORATION-FR',
    price: '24.90',
    stock: 8,
    game: 'pokemon',
    releaseDate: daysFromToday(-150),
  },
  {
    slug: 'dev-deck-aurores',
    name: '[Démo] Deck — Aurores Sauvages',
    type: 'DECK',
    sku: 'DEV-DECK-AURORES-FR',
    price: '19.90',
    stock: 6,
    set: 'dev-aurores-sauvages',
    newArrival: true,
  },
  {
    slug: 'dev-protege-cartes',
    name: '[Démo] Protège-cartes — Vert forêt',
    type: 'ACCESSORY',
    sku: 'DEV-ACC-PROTECTIONS-FR',
    price: '9.90',
    stock: 10,
    restock: true,
  },
  {
    slug: 'dev-carte-illustration',
    name: '[Démo] Carte — Illustration volcanique',
    type: 'SINGLE_CARD',
    sku: 'DEV-CAR-VOLCAN-FR',
    price: '44.90',
    stock: 1,
    game: 'pokemon',
    releaseDate: daysFromToday(-60),
    featured: true,
  },
  {
    slug: 'dev-brouillon',
    name: '[Démo] Produit en préparation',
    type: 'ETB',
    sku: 'DEV-ETB-BROUILLON-FR',
    price: '49.90',
    stock: 5,
    game: 'pokemon',
    status: 'DRAFT',
  },
  {
    slug: 'dev-archive',
    name: '[Démo] Ancienne édition',
    type: 'BOOSTER',
    sku: 'DEV-BST-ARCHIVE-FR',
    price: '4.90',
    stock: 4,
    game: 'pokemon',
    releaseDate: daysFromToday(-400),
    status: 'ARCHIVED',
  },
  {
    slug: 'dev-variante-inactive',
    name: '[Démo] Variante désactivée',
    type: 'BLISTER',
    sku: 'DEV-BLI-INACTIF-FR',
    price: '8.90',
    stock: 9,
    game: 'pokemon',
    inactive: true,
  },
  {
    slug: 'dev-blister-horizons',
    name: '[Démo] Blister — Horizons',
    type: 'BLISTER',
    sku: 'DEV-BLI-HORIZONS-EN',
    price: '7.90',
    stock: 3,
    set: 'dev-vallees-oubliees',
    language: 'EN',
  },
  {
    slug: 'dev-tripack-expedition',
    name: '[Démo] Tripack — Expédition',
    type: 'TRIPACK',
    sku: 'DEV-TRI-EXPEDITION-FR',
    price: '17.90',
    stock: 2,
    set: 'dev-vallees-oubliees',
  },
  {
    slug: 'dev-display-aurores-jp',
    name: '[Démo] Display — Aurores japonaises',
    type: 'DISPLAY',
    sku: 'DEV-DIS-AURORES-JP',
    price: '89.90',
    stock: 8,
    set: 'dev-aurores-sauvages',
    releaseDate: daysFromToday(-40),
    language: 'JP',
  },
  {
    slug: 'dev-classeur-foret',
    name: '[Démo] Classeur — Forêt',
    type: 'ACCESSORY',
    sku: 'DEV-ACC-CLASSEUR-FR',
    price: '29.90',
    stock: 5,
    game: 'pokemon',
  },
  {
    slug: 'dev-deck-vallees-en',
    name: '[Démo] Deck — Vallées anglaises',
    type: 'DECK',
    sku: 'DEV-DECK-VALLEES-EN',
    price: '22.90',
    stock: 0,
    set: 'dev-vallees-oubliees',
    language: 'EN',
  },
  {
    slug: 'dev-coffret-explorateur',
    name: '[Démo] Coffret — Explorateur',
    type: 'COLLECTION_BOX',
    sku: 'DEV-COF-EXPLORATEUR-FR',
    price: '39.90',
    stock: 4,
    game: 'pokemon',
    releaseDate: daysFromToday(-90),
  },
  {
    slug: 'dev-bundle-aurores',
    name: '[Démo] Bundle — Aurores',
    type: 'BUNDLE',
    sku: 'DEV-BUN-AURORES-FR',
    price: '34.90',
    stock: 0,
    set: 'dev-aurores-sauvages',
    releaseDate: daysFromToday(35),
    preorder: true,
  },
  {
    slug: 'dev-booster-aurores',
    name: '[Démo] Booster — Aurores',
    type: 'BOOSTER',
    sku: 'DEV-BST-AURORES-FR',
    price: '5.90',
    stock: 4,
    set: 'dev-aurores-sauvages',
  },
];

async function main() {
  // Development shipping rules only; existing merchant edits stay untouched.
  for (const country of [
    { code: 'FR', name: 'France' },
    { code: 'BE', name: 'Belgique' },
  ]) {
    await db.shippingCountry.upsert({
      where: { code: country.code },
      update: {},
      create: country,
    });
  }
  for (const method of [
    {
      code: 'DEV-STANDARD',
      name: '[Démo] Livraison standard',
      type: 'HOME_DELIVERY' as const,
      price: '5.90',
      freeFromAmount: '150.00',
      estimatedMinDays: 2,
      estimatedMaxDays: 4,
      sortOrder: 0,
      countries: ['FR', 'BE'],
    },
    {
      code: 'DEV-EXPRESS',
      name: '[Démo] Livraison express',
      type: 'EXPRESS' as const,
      price: '12.90',
      freeFromAmount: null,
      estimatedMinDays: 1,
      estimatedMaxDays: 2,
      sortOrder: 1,
      countries: ['FR'],
    },
  ]) {
    const { countries, ...fields } = method;
    await db.shippingMethod.upsert({
      where: { code: method.code },
      update: {},
      create: {
        ...fields,
        description:
          'Tarif et délai de démonstration, sans contrat transporteur.',
        isDevelopment: true,
        countries: { connect: countries.map((code) => ({ code })) },
      },
    });
  }

  await db.$transaction(
    async (tx) => {
      const gameIds = new Map<string, string>();
      for (const { faq, ...game } of games) {
        const row = await tx.game.upsert({
          where: { slug: game.slug },
          update: {},
          create: { ...game, ...(faq ? { faq } : {}) },
        });
        gameIds.set(game.slug, row.id);
      }

      // Databases seeded before the game axis had a "pokemon" root category:
      // lift its families to the root and retire it once it is empty.
      const legacyRoot = await tx.category.findUnique({
        where: { slug: 'pokemon' },
        select: { id: true },
      });
      if (legacyRoot) {
        await tx.category.updateMany({
          where: {
            parentId: legacyRoot.id,
            slug: { in: ['scelles', 'cartes'] },
          },
          data: { parentId: null },
        });
        await tx.category.updateMany({
          where: {
            id: legacyRoot.id,
            children: { none: {} },
            products: { none: {} },
          },
          data: { isActive: false },
        });
      }

      const categoryIds = new Map<string, string>();
      for (const { parent, ...category } of categories) {
        const row = await tx.category.upsert({
          where: { slug: category.slug },
          update: {},
          create: {
            ...category,
            parentId: parent ? categoryIds.get(parent) : null,
            imageUrl: getCategoryImage(category.slug),
          },
        });
        categoryIds.set(category.slug, row.id);
      }

      const setIds = new Map<string, string>();
      const setGames = new Map<string, string>();
      for (const { game, ...set } of sets) {
        const gameId = gameIds.get(game)!;
        const row = await tx.tcgSet.upsert({
          where: { slug: set.slug },
          update: {},
          create: {
            ...set,
            gameId,
            series: 'Série fictive de développement',
            description:
              'Extension fictive pour tester Caldera. Ce n’est pas une extension officielle.',
          },
        });
        // Sets created by an earlier seed have no game yet.
        await tx.tcgSet.updateMany({
          where: { id: row.id, gameId: null },
          data: { gameId },
        });
        setIds.set(set.slug, row.id);
        setGames.set(set.slug, gameId);
      }

      const development = await tx.tag.upsert({
        where: { slug: 'demonstration' },
        update: {},
        create: { slug: 'demonstration', name: 'Démonstration' },
      });
      const restock = await tx.tag.upsert({
        where: { slug: 'reassort' },
        update: {},
        create: { slug: 'reassort', name: 'Réassort' },
      });
      for (const [index, example] of examples.entries()) {
        const categoryId = categoryIds.get(familyByType[example.type])!;
        const gameId = example.set
          ? setGames.get(example.set)!
          : example.game
            ? gameIds.get(example.game)!
            : null;
        const set = sets.find((s) => s.slug === example.set);
        const product = await tx.product.upsert({
          where: { slug: example.slug },
          update: {},
          create: {
            name: example.name,
            slug: example.slug,
            productType: example.type,
            categoryId,
            tcgSetId: example.set ? setIds.get(example.set) : null,
            gameId,
            status: example.status ?? 'ACTIVE',
            featured: example.featured ?? false,
            newArrival: example.newArrival ?? false,
            preorder: example.preorder ?? false,
            publishedAt: new Date(Date.UTC(2026, 8, 19, 0, 0, index)),
            releaseDate: example.releaseDate ?? set?.releaseDate ?? null,
            shortDescription: 'Exemple de développement, non commercialisé.',
            description:
              'Produit fictif destiné aux essais du catalogue Caldera. Le prix, le stock et le visuel sont des données de développement.',
            tags: {
              connect: [
                { id: development.id },
                ...(example.restock ? [{ id: restock.id }] : []),
              ],
            },
            images: {
              create: {
                url: getProductPlaceholder(example.type),
                alt: `Visuel provisoire Caldera — ${example.name}`,
                isPrimary: true,
                sortOrder: 0,
              },
            },
          },
        });
        // Earlier seeds filed several families under "scelles" and had no game.
        await tx.product.updateMany({
          where: {
            id: product.id,
            category: { slug: 'scelles' },
            categoryId: { not: categoryId },
          },
          data: { categoryId },
        });
        if (gameId)
          await tx.product.updateMany({
            where: { id: product.id, gameId: null },
            data: { gameId },
          });
        await tx.productVariant.upsert({
          where: { sku: example.sku },
          update: {},
          create: {
            productId: product.id,
            sku: example.sku,
            price: example.price,
            compareAtPrice: index === 0 ? '69.90' : null,
            costPrice: '2.00',
            stockQuantity: example.stock,
            isActive: !example.inactive,
            isDefault: true,
            language: example.language ?? 'FR',
            weightGrams: 150,
          },
        });
        if (example.slug === 'dev-coffret-aurores') {
          await tx.productVariant.upsert({
            where: { sku: 'DEV-COF-AURORES-EN' },
            update: {},
            create: {
              productId: product.id,
              sku: 'DEV-COF-AURORES-EN',
              language: 'EN',
              price: '39.90',
              stockQuantity: 3,
              weightGrams: 850,
            },
          });
        }
        if (index === 0) {
          for (const [id, url, alt, sortOrder] of [
            [
              '50000000-0000-4000-8000-000000000001',
              '/assets/products/placeholder-accessories.png',
              'Illustration de démonstration Caldera — accessoires',
              1,
            ],
            [
              '50000000-0000-4000-8000-000000000002',
              '/assets/products/placeholder-card.png',
              'Illustration de démonstration Caldera — carte',
              2,
            ],
          ] as const) {
            await tx.productImage.upsert({
              where: { id },
              update: {},
              create: { id, productId: product.id, url, alt, sortOrder },
            });
          }
          await tx.productVariant.upsert({
            where: { sku: 'DEV-ETB-BRAISE-EN' },
            update: {},
            create: {
              productId: product.id,
              sku: 'DEV-ETB-BRAISE-EN',
              language: 'EN',
              price: '54.90',
              compareAtPrice: '64.90',
              stockQuantity: 2,
            },
          });
          await tx.productVariant.upsert({
            where: { sku: 'DEV-ETB-BRAISE-JP-INACTIF' },
            update: {},
            create: {
              productId: product.id,
              sku: 'DEV-ETB-BRAISE-JP-INACTIF',
              language: 'JP',
              price: '1.00',
              stockQuantity: 999,
              isActive: false,
            },
          });
        }
      }
    },
    { timeout: 30_000 },
  );
  const variantCount = await db.productVariant.count({
    where: { sku: { startsWith: 'DEV-' } },
  });
  console.log(
    `Seed : ${examples.length} produits de développement, ${variantCount} variantes, ${categories.length} catégories, ${games.length} jeux, ${sets.length} extensions fictives. Les enregistrements existants sont préservés.`,
  );
}
try {
  await main();
} finally {
  await db.$disconnect();
}
