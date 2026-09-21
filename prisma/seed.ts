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
type Example = {
  slug: string;
  name: string;
  type: ProductType;
  category: string;
  sku: string;
  price: string;
  stock: number;
  set?: string;
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
    category: 'etb',
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
    category: 'boosters',
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
    category: 'scelles',
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
    category: 'coffrets',
    sku: 'DEV-COF-AURORES-FR',
    price: '39.90',
    stock: 0,
    set: 'dev-aurores-sauvages',
    newArrival: true,
    preorder: true,
  },
  {
    slug: 'dev-bundle-vallees',
    name: '[Démo] Bundle — Vallées Oubliées',
    type: 'BUNDLE',
    category: 'scelles',
    sku: 'DEV-BUN-VALLEES-FR',
    price: '29.90',
    stock: 1,
    set: 'dev-vallees-oubliees',
  },
  {
    slug: 'dev-tin-exploration',
    name: '[Démo] Tin — Exploration',
    type: 'TIN',
    category: 'coffrets',
    sku: 'DEV-TIN-EXPLORATION-FR',
    price: '24.90',
    stock: 8,
  },
  {
    slug: 'dev-deck-aurores',
    name: '[Démo] Deck — Aurores Sauvages',
    type: 'DECK',
    category: 'scelles',
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
    category: 'accessoires',
    sku: 'DEV-ACC-PROTECTIONS-FR',
    price: '9.90',
    stock: 10,
    restock: true,
  },
  {
    slug: 'dev-carte-illustration',
    name: '[Démo] Carte — Illustration volcanique',
    type: 'SINGLE_CARD',
    category: 'cartes',
    sku: 'DEV-CAR-VOLCAN-FR',
    price: '44.90',
    stock: 1,
    featured: true,
  },
  {
    slug: 'dev-brouillon',
    name: '[Démo] Produit en préparation',
    type: 'ETB',
    category: 'etb',
    sku: 'DEV-ETB-BROUILLON-FR',
    price: '49.90',
    stock: 5,
    status: 'DRAFT',
  },
  {
    slug: 'dev-archive',
    name: '[Démo] Ancienne édition',
    type: 'BOOSTER',
    category: 'boosters',
    sku: 'DEV-BST-ARCHIVE-FR',
    price: '4.90',
    stock: 4,
    status: 'ARCHIVED',
  },
  {
    slug: 'dev-variante-inactive',
    name: '[Démo] Variante désactivée',
    type: 'BLISTER',
    category: 'scelles',
    sku: 'DEV-BLI-INACTIF-FR',
    price: '8.90',
    stock: 9,
    inactive: true,
  },
  {
    slug: 'dev-blister-horizons',
    name: '[Démo] Blister — Horizons',
    type: 'BLISTER',
    category: 'scelles',
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
    category: 'scelles',
    sku: 'DEV-TRI-EXPEDITION-FR',
    price: '17.90',
    stock: 2,
    set: 'dev-vallees-oubliees',
  },
  {
    slug: 'dev-display-aurores-jp',
    name: '[Démo] Display — Aurores japonaises',
    type: 'DISPLAY',
    category: 'scelles',
    sku: 'DEV-DIS-AURORES-JP',
    price: '89.90',
    stock: 8,
    set: 'dev-aurores-sauvages',
    language: 'JP',
  },
  {
    slug: 'dev-classeur-foret',
    name: '[Démo] Classeur — Forêt',
    type: 'ACCESSORY',
    category: 'accessoires',
    sku: 'DEV-ACC-CLASSEUR-FR',
    price: '29.90',
    stock: 5,
  },
  {
    slug: 'dev-deck-vallees-en',
    name: '[Démo] Deck — Vallées anglaises',
    type: 'DECK',
    category: 'scelles',
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
    category: 'coffrets',
    sku: 'DEV-COF-EXPLORATEUR-FR',
    price: '39.90',
    stock: 4,
  },
  {
    slug: 'dev-bundle-aurores',
    name: '[Démo] Bundle — Aurores',
    type: 'BUNDLE',
    category: 'scelles',
    sku: 'DEV-BUN-AURORES-FR',
    price: '34.90',
    stock: 0,
    set: 'dev-aurores-sauvages',
    preorder: true,
  },
  {
    slug: 'dev-booster-aurores',
    name: '[Démo] Booster — Aurores',
    type: 'BOOSTER',
    category: 'boosters',
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
      code: 'MONDIAL_RELAY_PICKUP',
      name: 'Mondial Relay — Point Relais® ou Locker',
      type: 'PICKUP' as const,
      price: '0.00',
      freeFromAmount: null,
      estimatedMinDays: null,
      estimatedMaxDays: null,
      sortOrder: 0,
      countries: ['FR'],
      isActive: false,
      isDevelopment: false,
      description:
        'À configurer avec le tarif et les délais de votre contrat avant activation.',
    },
    {
      code: 'DEV-STANDARD',
      name: '[Démo] Livraison standard',
      type: 'HOME_DELIVERY' as const,
      price: '5.90',
      freeFromAmount: '150.00',
      estimatedMinDays: 2,
      estimatedMaxDays: 4,
      sortOrder: 10,
      countries: ['FR', 'BE'],
      isActive: true,
      isDevelopment: true,
      description:
        'Tarif et délai de démonstration, sans contrat transporteur.',
    },
    {
      code: 'DEV-EXPRESS',
      name: '[Démo] Livraison express',
      type: 'EXPRESS' as const,
      price: '12.90',
      freeFromAmount: null,
      estimatedMinDays: 1,
      estimatedMaxDays: 2,
      sortOrder: 20,
      countries: ['FR'],
      isActive: true,
      isDevelopment: true,
      description:
        'Tarif et délai de démonstration, sans contrat transporteur.',
    },
  ]) {
    const { countries, ...fields } = method;
    await db.shippingMethod.upsert({
      where: { code: method.code },
      update: {},
      create: {
        ...fields,
        countries: { connect: countries.map((code) => ({ code })) },
      },
    });
  }

  await db.$transaction(
    async (tx) => {
      const categoryIds = new Map<string, string>();
      for (const [slug, name, parent, sortOrder] of [
        ['pokemon', 'Pokémon', null, 0],
        ['scelles', 'Produits scellés', 'pokemon', 1],
        ['cartes', 'Cartes à l’unité', 'pokemon', 2],
        ['accessoires', 'Accessoires', null, 3],
        ['etb', 'ETB', 'scelles', 4],
        ['boosters', 'Boosters', 'scelles', 5],
        ['coffrets', 'Coffrets', 'scelles', 6],
      ] as const) {
        const category = await tx.category.upsert({
          where: { slug },
          update: {},
          create: {
            slug,
            name,
            sortOrder,
            parentId: parent ? categoryIds.get(parent) : null,
            imageUrl: getCategoryImage(slug),
            description: 'Découvrez ce territoire de la collection.',
          },
        });
        categoryIds.set(slug, category.id);
      }
      const setIds = new Map<string, string>();
      for (const [slug, name, code] of [
        ['dev-terres-de-braise', '[Démo] Terres de Braise', 'DEV-BRAISE'],
        ['dev-vallees-oubliees', '[Démo] Vallées Oubliées', 'DEV-VALLEES'],
        ['dev-aurores-sauvages', '[Démo] Aurores Sauvages', 'DEV-AURORES'],
      ]) {
        const set = await tx.tcgSet.upsert({
          where: { slug: slug! },
          update: {},
          create: {
            slug: slug!,
            name: name!,
            code,
            series: 'Série fictive de développement',
            description:
              'Extension fictive pour tester Caldera. Ce n’est pas une extension Pokémon officielle.',
          },
        });
        setIds.set(slug!, set.id);
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
        const product = await tx.product.upsert({
          where: { slug: example.slug },
          update: {},
          create: {
            name: example.name,
            slug: example.slug,
            productType: example.type,
            categoryId: categoryIds.get(example.category)!,
            tcgSetId: example.set ? setIds.get(example.set) : null,
            status: example.status ?? 'ACTIVE',
            featured: example.featured ?? false,
            newArrival: example.newArrival ?? false,
            preorder: example.preorder ?? false,
            publishedAt: new Date(Date.UTC(2026, 8, 19, 0, 0, index)),
            releaseDate: new Date('2026-09-01T00:00:00Z'),
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
  console.log(
    'Seed : 20 produits de développement, 23 variantes, 7 catégories, 3 extensions fictives. Les enregistrements existants sont préservés.',
  );
}
try {
  await main();
} finally {
  await db.$disconnect();
}
