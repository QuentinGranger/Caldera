import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  selectProductVariant,
  normalizeQuantity,
  canPreparePurchase,
  type ProductVariantView,
} from '../src/lib/product/purchase';
import {
  formatProductDate,
  formatProductWeight,
} from '../src/utils/formatProduct';
import {
  CATALOGUE_LEVEL,
  CATALOGUE_PATH,
  archivedProductTarget,
  familyLineage,
  indexablePaths,
  productBreadcrumb,
  productParents,
  productTrailLevels,
  type ProductPlacement,
} from '../src/lib/product/navigation';
import {
  productSeoText,
  productShareImage,
  productStructuredData,
} from '../src/lib/product/seo';
import {
  HANDLING_LABEL,
  RETURN_LABEL,
  businessDays,
  shippingOptionViews,
} from '../src/lib/product/services';
import { breadcrumbTrail } from '../src/lib/seo/jsonld';
import { absoluteUrl, siteOrigin } from '../src/lib/site';
import type { ProductDetail } from '../src/lib/catalog/queries';
import type { LandingIndex } from '../src/lib/seo/registry';
import type { ShippingFact } from '../src/lib/seo/shipping';
const variant = (sku: string, isDefault = false): ProductVariantView => ({
  id: sku,
  sku,
  language: 'FR',
  condition: 'NEW',
  isDefault,
  price: '59.90',
  compareAtPrice: null,
  availability: 'IN_STOCK',
  maxQuantity: 3,
  lowStockQuantity: null,
  weightGrams: 850,
});
test('variante : deep link, défaut actif, ordre déterministe et absence', () => {
  const fr = variant('FR', true),
    en = variant('EN');
  assert.equal(selectProductVariant([en, fr])?.sku, 'FR');
  assert.equal(selectProductVariant([fr, en], 'EN')?.sku, 'EN');
  assert.equal(selectProductVariant([en, fr], 'JP')?.sku, 'FR');
  assert.equal(selectProductVariant([variant('ZZ'), en])?.sku, 'EN');
  assert.equal(selectProductVariant([]), null);
});
test('quantité : minimum, maximum, valeurs invalides et précommandes limitées', () => {
  for (const value of [0, -2, '', 'abc', '1.5', 'Infinity'])
    assert.equal(normalizeQuantity(value, 3), 1);
  assert.equal(normalizeQuantity(1, 3), 1);
  assert.equal(normalizeQuantity(99, 3), 3);
  assert.equal(normalizeQuantity(3, 3), 3);
  assert.equal(normalizeQuantity(2, 0), 1);
  assert.equal(canPreparePurchase(variant('FR'), 3), true);
  assert.equal(canPreparePurchase(variant('FR'), 4), false);
  assert.equal(canPreparePurchase(variant('FR'), 0), false);
  assert.equal(canPreparePurchase(null, 1), false);
  assert.equal(
    canPreparePurchase({ ...variant('FR'), availability: 'OUT_OF_STOCK' }, 1),
    false,
  );
  assert.equal(
    canPreparePurchase(
      { ...variant('FR'), availability: 'PREORDER', maxQuantity: 0 },
      1,
    ),
    false,
  );
  assert.equal(
    canPreparePurchase({ ...variant('FR'), availability: 'PREORDER' }, 3),
    true,
  );
});
test('date et poids français sans décalage de fuseau', () => {
  assert.equal(
    formatProductDate('2026-09-01T00:00:00.000Z'),
    '1 septembre 2026',
  );
  assert.match(formatProductWeight(850), /^850\s?g$/);
  assert.match(formatProductWeight(1200), /^1,2\s?kg$/);
});

// ---------------------------------------------------------------------------
// Silo placement: breadcrumb and archived product redirect

const pokemon = { id: 'g-pkm', slug: 'pokemon', name: 'Pokémon' };
const families = {
  scelles: {
    id: 'c-sealed',
    slug: 'scelles',
    name: 'Produits scellés',
    parentId: null,
  },
  etb: { id: 'c-etb', slug: 'etb', name: 'ETB', parentId: 'c-sealed' },
  boosters: {
    id: 'c-boosters',
    slug: 'boosters',
    name: 'Boosters',
    parentId: 'c-sealed',
  },
  accessoires: {
    id: 'c-acc',
    slug: 'accessoires',
    name: 'Accessoires',
    parentId: null,
  },
};
const tree = Object.values(families);
const braise = { id: 's-braise', slug: 'braise', name: 'Terres de Braise' };
const indexOf = (landings: string[], hubs: string[] = []): LandingIndex => ({
  landings: landings.map((path) => ({
    path,
    productCount: 3,
    lastModified: null,
  })),
  categoryHubs: hubs.map((path) => ({
    path,
    productCount: 3,
    lastModified: null,
  })),
});
const placement = (
  family: keyof typeof families,
  set: typeof braise | null = braise,
  game: typeof pokemon | null = pokemon,
): ProductPlacement => ({
  game,
  set,
  families: familyLineage(tree, families[family].id),
});
const hrefs = (items: { href?: string }[]) => items.map((item) => item.href);

test('lignée de famille : la famille puis ses parents, vide hors arbre actif', () => {
  assert.deepEqual(
    familyLineage(tree, 'c-etb').map((c) => c.slug),
    ['etb', 'scelles'],
  );
  assert.deepEqual(familyLineage(tree, 'c-inconnue'), []);
  assert.deepEqual(familyLineage(tree, null), []);
});

test('parents indexables : extension + famille, extension, famille du jeu, jeu, hub', () => {
  const full = indexablePaths(
    indexOf(
      ['/pokemon', '/pokemon/braise', '/pokemon/braise/etb', '/pokemon/etb'],
      ['/categorie/etb'],
    ),
  );
  const parents = productParents(placement('etb'), full);
  assert.deepEqual(
    parents.map((parent) => [parent.kind, parent.path, parent.label]),
    [
      ['set-category', '/pokemon/braise/etb', 'ETB'],
      ['set', '/pokemon/braise', 'Terres de Braise'],
      ['category', '/pokemon/etb', 'ETB'],
      ['game', '/pokemon', 'Pokémon'],
      ['category-hub', '/categorie/etb', 'ETB'],
    ],
  );
  assert.equal(
    archivedProductTarget(placement('etb'), full),
    '/pokemon/braise/etb',
  );
  // Nearest indexable ancestor when the family itself has no landing.
  const ancestor = indexablePaths(
    indexOf(['/pokemon', '/pokemon/braise', '/pokemon/braise/scelles']),
  );
  assert.deepEqual(
    productParents(placement('etb'), ancestor).map((parent) => parent.path),
    ['/pokemon/braise/scelles', '/pokemon/braise', '/pokemon'],
  );
});

test('redirection d’un produit archivé : meilleur parent indexable, sinon catalogue', () => {
  const index = (landings: string[], hubs: string[] = []) =>
    indexablePaths(indexOf(landings, hubs));
  assert.equal(
    archivedProductTarget(
      placement('etb'),
      index(['/pokemon', '/pokemon/braise']),
    ),
    '/pokemon/braise',
  );
  assert.equal(
    archivedProductTarget(
      placement('boosters'),
      index(['/pokemon', '/pokemon/scelles']),
    ),
    '/pokemon/scelles',
  );
  assert.equal(
    archivedProductTarget(placement('boosters', null), index(['/pokemon'])),
    '/pokemon',
  );
  assert.equal(
    archivedProductTarget(
      placement('accessoires', null, null),
      index(['/pokemon'], ['/categorie/accessoires']),
    ),
    '/categorie/accessoires',
  );
  // A game hub that is not indexable leaves the multi-game family hub.
  assert.equal(
    archivedProductTarget(placement('etb'), index([], ['/categorie/scelles'])),
    '/categorie/scelles',
  );
  assert.equal(
    archivedProductTarget(placement('etb'), index([])),
    CATALOGUE_PATH,
  );
});

test('fil d’Ariane : niveaux indexables seulement, replis famille du jeu, hub et catalogue', () => {
  const crumbs = (
    place: ProductPlacement,
    landings: string[],
    hubs: string[] = [],
    catalogue = true,
  ) => {
    const levels = productTrailLevels(
      productParents(place, indexablePaths(indexOf(landings, hubs))),
    );
    return productBreadcrumb(
      !levels.length && catalogue ? [CATALOGUE_LEVEL] : levels,
      'ETB Terres de Braise',
    );
  };
  const full = crumbs(placement('etb'), [
    '/pokemon',
    '/pokemon/braise',
    '/pokemon/braise/etb',
    '/pokemon/etb',
  ]);
  assert.deepEqual(
    full.map((item) => item.label),
    ['Accueil', 'Pokémon', 'Terres de Braise', 'ETB', 'ETB Terres de Braise'],
  );
  assert.deepEqual(hrefs(full), [
    '/',
    '/pokemon',
    '/pokemon/braise',
    '/pokemon/braise/etb',
    undefined,
  ]);
  // Indexable set without an indexable set + family: no game family after it.
  assert.deepEqual(
    hrefs(
      crumbs(placement('etb'), ['/pokemon', '/pokemon/braise', '/pokemon/etb']),
    ),
    ['/', '/pokemon', '/pokemon/braise', undefined],
  );
  // No indexable set: the family of the game follows the game.
  assert.deepEqual(
    hrefs(crumbs(placement('etb'), ['/pokemon', '/pokemon/scelles'])),
    ['/', '/pokemon', '/pokemon/scelles', undefined],
  );
  assert.deepEqual(
    hrefs(
      crumbs(
        placement('accessoires', null, null),
        ['/pokemon'],
        ['/categorie/accessoires'],
      ),
    ),
    ['/', '/categorie/accessoires', undefined],
  );
  assert.deepEqual(hrefs(crumbs(placement('accessoires', null, null), [])), [
    '/',
    '/catalogue',
    undefined,
  ]);
  assert.deepEqual(
    hrefs(crumbs(placement('accessoires', null, null), [], [], false)),
    ['/', undefined],
  );
  // The component's BreadcrumbList ends on the product URL.
  const trail = breadcrumbTrail(full, '/produit/etb-terres-de-braise');
  assert.deepEqual(
    trail.map((item) => item.path),
    [
      '/',
      '/pokemon',
      '/pokemon/braise',
      '/pokemon/braise/etb',
      '/produit/etb-terres-de-braise',
    ],
  );
});

// ---------------------------------------------------------------------------
// Metadata, structured data and services

const detail = (overrides: Partial<ProductDetail> = {}): ProductDetail => ({
  id: 'p-1',
  name: 'Coffret Dresseur d’élite Terres de Braise',
  slug: 'etb-terres-de-braise',
  category: 'ETB',
  tags: [],
  image: '/assets/products/placeholder-sealed.png',
  imageAlt: 'Visuel',
  price: '54.90',
  compareAtPrice: null,
  priceFrom: true,
  availability: 'IN_STOCK',
  quickAddVariantId: 'v-fr',
  productType: 'ETB',
  preorder: false,
  newArrival: false,
  categoryInfo: {
    id: 'c-etb',
    name: 'ETB',
    slug: 'etb',
    parentId: 'c-sealed',
  },
  game: pokemon,
  tcgSet: {
    id: 's-braise',
    name: 'Terres de Braise',
    slug: 'braise',
    code: null,
    series: null,
    logoUrl: null,
    gameId: 'g-pkm',
    releaseDate: '2026-11-14T00:00:00.000Z',
  },
  seoTitle: null,
  seoDescription: null,
  updatedAt: '2026-09-20T00:00:00.000Z',
  description: 'Neuf boosters et accessoires de jeu.',
  shortDescription: null,
  releaseDate: '2026-11-14T00:00:00.000Z',
  images: [
    {
      url: '/assets/products/placeholder-sealed.png',
      alt: 'Visuel de remplacement',
      sortOrder: 0,
      isPrimary: true,
    },
    {
      url: 'https://blob.example/etb.jpg',
      alt: 'ETB Terres de Braise',
      sortOrder: 1,
      isPrimary: false,
    },
  ],
  variants: [
    { ...variant('ETB-FR', true), price: '59.90', barcode: '4006381333931' },
    {
      ...variant('ETB-EN'),
      language: 'EN',
      price: '54.90',
      availability: 'OUT_OF_STOCK',
      maxQuantity: 0,
      barcode: '123',
    },
  ],
  ...overrides,
});

test('metadata produit : prix « dès », disponibilité réelle et surcharges', () => {
  const text = productSeoText(detail());
  assert.ok(!text.title.includes('Caldera'));
  assert.ok(text.title.length <= 60);
  assert.match(text.description, /dès 54,90\s€/u);
  assert.match(text.description, /En stock\./);
  assert.match(text.description, /Langues : français et anglais\./);
  const preorder = productSeoText(
    detail({ availability: 'PREORDER', preorder: true, priceFrom: false }),
  );
  assert.match(preorder.description, /à 54,90\s€/u);
  assert.match(
    preorder.description,
    /En précommande, sortie le 14 novembre 2026\./,
  );
  assert.ok(
    !productSeoText(
      detail({ availability: 'OUT_OF_STOCK' }),
    ).description.includes('En stock'),
  );
  assert.deepEqual(
    productSeoText(
      detail({
        seoTitle: 'Titre choisi',
        seoDescription: 'Description choisie',
      }),
    ),
    { title: 'Titre choisi', description: 'Description choisie' },
  );
  assert.deepEqual(productShareImage(detail()), {
    url: 'https://blob.example/etb.jpg',
    alt: 'ETB Terres de Braise',
  });
  assert.equal(
    productShareImage(detail({ images: [detail().images[0]!] })),
    null,
  );
});

test('JSON-LD produit : une offre par variante active, GTIN valide, précommande et livraison', () => {
  const shipping: ShippingFact = {
    code: 'COLISSIMO',
    name: 'Colissimo',
    description: null,
    type: 'HOME_DELIVERY',
    price: '5.90',
    freeFromAmount: '55.00',
    estimatedMinDays: 2,
    estimatedMaxDays: 4,
    minDays: 2,
    maxDays: 4,
    countries: ['FR'],
    destinations: [{ code: 'FR', name: 'France' }],
  };
  const node = productStructuredData(detail(), [shipping]);
  assert.ok(node);
  const json = JSON.parse(JSON.stringify(node));
  assert.equal(json['@type'], 'Product');
  assert.equal(json.url, absoluteUrl('/produit/etb-terres-de-braise'));
  assert.deepEqual(json.brand, { '@type': 'Brand', name: 'Pokémon' });
  assert.equal(json.category, 'ETB');
  assert.deepEqual(json.image, ['https://blob.example/etb.jpg']);
  assert.equal(json.offers.length, 2);
  const [fr, en] = json.offers;
  assert.equal(fr.sku, 'ETB-FR');
  assert.equal(fr.gtin13, '4006381333931');
  assert.equal(fr.price, '59.90');
  assert.equal(fr.availability, 'https://schema.org/InStock');
  assert.equal(fr.seller['@id'], `${siteOrigin()}/#organization`);
  assert.equal(fr.hasMerchantReturnPolicy.merchantReturnDays, 14);
  // Free from 55 € on the 59,90 € offer, paid on the 54,90 € one.
  assert.equal(fr.shippingDetails[0].shippingRate.value, 0);
  assert.equal(en.shippingDetails[0].shippingRate.value, 5.9);
  assert.equal(en.availability, 'https://schema.org/OutOfStock');
  assert.ok(!('gtin13' in en) && !('gtin' in en));
  assert.ok(!/review|rating/i.test(JSON.stringify(json)));

  const preorder = JSON.parse(
    JSON.stringify(
      productStructuredData(
        detail({
          preorder: true,
          variants: [
            {
              ...variant('ETB-FR', true),
              availability: 'PREORDER',
              barcode: null,
            },
          ],
        }),
      ),
    ),
  );
  assert.equal(preorder.offers.availability, 'https://schema.org/PreOrder');
  assert.equal(preorder.offers.availabilityStarts, '2026-11-14');
  assert.equal(preorder.sku, 'ETB-FR');
  assert.equal(productStructuredData(detail({ variants: [] })), null);
});

test('livraison et retours affichés : mêmes faits que les offres', () => {
  assert.equal(businessDays(1, 1), '1 jour ouvré');
  assert.equal(businessDays(1, 2), '1 à 2 jours ouvrés');
  assert.equal(businessDays(3, 3), '3 jours ouvrés');
  const [view] = shippingOptionViews([
    {
      code: 'RELAIS',
      name: 'Point Relais',
      description: null,
      type: 'HOME_DELIVERY',
      price: '4.50',
      freeFromAmount: '100.00',
      estimatedMinDays: 3,
      estimatedMaxDays: 5,
      minDays: 3,
      maxDays: 5,
      countries: ['FR'],
      destinations: [{ code: 'FR', name: 'France' }],
    },
  ]);
  assert.ok(view);
  assert.equal(view.name, 'Point Relais');
  assert.deepEqual(view.destinations, ['France']);
  assert.match(view.details[0] ?? '', /^4,50\s€$/u);
  assert.match(view.details[1] ?? '', /^offerte dès 100,00\s€ d’achat$/u);
  assert.equal(view.details[2], 'livraison en 3 à 5 jours ouvrés');
  const [unknownTransit] = shippingOptionViews([
    {
      code: 'X',
      name: 'Coursier',
      description: null,
      type: 'EXPRESS',
      price: '9.00',
      freeFromAmount: null,
      estimatedMinDays: null,
      estimatedMaxDays: null,
      minDays: null,
      maxDays: null,
      countries: ['FR'],
      destinations: [{ code: 'FR', name: 'France' }],
    },
  ]);
  assert.equal(unknownTransit?.details.length, 1);
  assert.match(HANDLING_LABEL, /1 à 2 jours ouvrés/);
  assert.match(RETURN_LABEL, /14 jours/);
});
