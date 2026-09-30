// Facts of the home page: every figure, name and link comes from the catalogue
// and the landing index (docs/seo-architecture.md §1 and §7), for the licence
// the shop sells (SHOP_GAME) and licence-free products.
import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { getScopeFacets } from '@/components/catalog/catalogLoad';
import {
  LISTING_HUBS,
  getIndexableListings,
  presentFamilies,
} from '@/components/catalog/listingHub';
import { getProductVisual } from '@/lib/catalog/images';
import { getHomeCategories, visibleProductWhere } from '@/lib/catalog/queries';
import {
  SHOP_GAME,
  isShopGame,
  shopProductWhere,
} from '@/lib/catalog/shopGame';
import {
  getCategories,
  getExtensions,
  getGames,
  toGameRef,
  toSetRef,
} from '@/lib/catalog/taxonomy';
import { getPrisma } from '@/lib/db/prisma';
import { landingPath } from '@/lib/seo/facets';
import {
  getNavigation,
  type Navigation,
  type NavigationFamily,
} from '@/lib/seo/links';
import {
  DESCRIPTION_MAX,
  formatEuro,
  listFr,
  truncateAtWord,
  type ListingKind,
} from '@/lib/seo/metadata';
import { getLandingIndex, getScopeStats } from '@/lib/seo/registry';
import type { ScopeStats } from '@/lib/seo/types';
import { getAllContent } from '@/lib/content';
import type { ContentKind } from '@/lib/content/types';
import type { CatalogProduct } from '@/types/product';

export interface HomeFamily {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string;
  /** Landing of the licence sold, else the multi-game hub. */
  href: string;
  count: number;
}

export interface HomeCollection {
  slug: string;
  name: string;
  gameName: string;
  releaseDate: Date | null;
  /** Indexable /{game}/{set} landing. */
  href: string;
  count: number;
  image: { url: string; alt: string };
}

/** Indexable listings by kind; absent kinds are not linked. */
export type HomeLinks = Partial<Record<ListingKind, string>>;

/** The promise of the hero, also the description of an empty shop. */
export const HOME_PROMISE =
  'Cartes Pokémon, collections et nouveautés sélectionnées pour les collectionneurs et les joueurs.';

/** The offer of the licence sold, in figures. */
export interface ShopOffer {
  /** Null while the game does not exist in the catalogue. */
  stats: Pick<
    ScopeStats,
    'productCount' | 'inStockCount' | 'preorderCount' | 'minPrice' | 'maxPrice'
  > | null;
  /** Most specific families present, most products first. */
  families: readonly { name: string }[];
}

// ---------------------------------------------------------------------------
// Meta description

/** « Boosters » → « boosters » inside a sentence; keeps « ETB ». */
function inSentence(name: string): string {
  const [first = '', ...rest] = name.split(' ');
  if (
    /\p{Lu}/u.test(first.slice(1)) ||
    rest.some((word) => /\p{Lu}/u.test(word))
  )
    return name;
  return first.charAt(0).toLocaleLowerCase('fr-FR') + name.slice(1);
}
const capitalize = (text: string) =>
  text.charAt(0).toLocaleUpperCase('fr-FR') + text.slice(1);
const plural = (count: number, word: string) =>
  `${count} ${word}${count > 1 ? 's' : ''}`;

/** Whole sentences while they fit; the first one is cut at a word if needed. */
function fitSentences(sentences: readonly string[], max = DESCRIPTION_MAX) {
  let result = '';
  for (const sentence of sentences) {
    const next = result ? `${result} ${sentence}` : sentence;
    if (next.length > max) break;
    result = next;
  }
  return result || truncateAtWord(sentences[0] ?? '', max);
}

/** Figures of the licence sold first; the promise while nothing is online. */
export function homeDescription({ stats, families }: ShopOffer): string {
  const familyList = families.length
    ? capitalize(
        listFr(families.slice(0, 4).map(({ name }) => inSentence(name))),
      )
    : null;
  if (!stats?.productCount)
    return fitSentences([HOME_PROMISE, 'Livraison en France métropolitaine.']);
  const availability = [
    stats.inStockCount > 0 && `${stats.inStockCount} en stock`,
    stats.preorderCount > 0 && `${stats.preorderCount} en précommande`,
  ].filter((part): part is string => Boolean(part));
  const range =
    stats.minPrice && stats.maxPrice && stats.maxPrice !== stats.minPrice
      ? ` de ${formatEuro(stats.minPrice)} à ${formatEuro(stats.maxPrice)}`
      : stats.minPrice
        ? ` à ${formatEuro(stats.minPrice)}`
        : '';
  return fitSentences(
    [
      `Cartes ${SHOP_GAME.name} : ${plural(stats.productCount, 'produit')}${range}${
        availability.length ? `, dont ${listFr(availability)}` : ''
      }.`,
      familyList && `${familyList}.`,
      'Livraison en France métropolitaine.',
    ].filter((sentence): sentence is string => Boolean(sentence)),
  );
}

async function getShopOffer(): Promise<ShopOffer> {
  const game = (await getGames()).find(({ slug }) => slug === SHOP_GAME.slug);
  if (!game) return { stats: null, families: [] };
  const [stats, facets, categories] = await Promise.all([
    getScopeStats({ game: { id: game.id } }),
    getScopeFacets({ game: game.slug }),
    getCategories(),
  ]);
  return { stats, families: presentFamilies(facets, categories) };
}

export async function getHomeDescription(): Promise<string> {
  return homeDescription(await getShopOffer());
}

// ---------------------------------------------------------------------------
// Families

type Target = { href: string; count: number };

function flatten(families: readonly NavigationFamily[]): NavigationFamily[] {
  return families.flatMap((family) => [family, ...flatten(family.children)]);
}

/**
 * Target of each family slug: its landing for the licence sold, else its
 * multi-game hub, for a family of licence-free products only.
 */
export function familyTargets(navigation: Navigation): Map<string, Target> {
  const targets = new Map<string, Target>();
  for (const game of navigation.games)
    if (game.slug === SHOP_GAME.slug)
      for (const family of flatten(game.families))
        targets.set(family.slug, { href: family.href, count: family.count });
  for (const hub of flatten(navigation.categoryHubs))
    if (!targets.has(hub.slug))
      targets.set(hub.slug, { href: hub.href, count: hub.count });
  return targets;
}

async function getHomeFamilies(navigation: Navigation): Promise<HomeFamily[]> {
  const categories = await getHomeCategories(shopProductWhere);
  const targets = familyTargets(navigation);
  return categories.flatMap((category) => {
    const target = targets.get(category.slug);
    return target
      ? [
          {
            id: category.id,
            name: category.name,
            description: category.description,
            imageUrl: category.imageUrl,
            href: target.href,
            count: target.count,
          },
        ]
      : [];
  });
}

// ---------------------------------------------------------------------------
// Latest sets

const imageOrder = [
  { isPrimary: 'desc' },
  { sortOrder: 'asc' },
  { id: 'asc' },
] satisfies Prisma.ProductImageOrderByWithRelationInput[];

/** Most recent sets of the licence sold whose landing is indexable, with one of their products. */
async function getHomeCollections(limit: number): Promise<HomeCollection[]> {
  const [sets, games, index] = await Promise.all([
    getExtensions(),
    getGames(),
    getLandingIndex(),
  ]);
  const pages = new Map(index.landings.map((page) => [page.path, page]));
  const gamesById = new Map(games.map((game) => [game.id, game]));
  const picked = sets
    .flatMap((set) => {
      const game = set.gameId ? gamesById.get(set.gameId) : undefined;
      if (game?.slug !== SHOP_GAME.slug) return [];
      const href = landingPath({ game: toGameRef(game), set: toSetRef(set) });
      const page = pages.get(href);
      return page ? [{ set, game, href, count: page.productCount }] : [];
    })
    .slice(0, limit);
  const products = await Promise.all(
    picked.map(({ set }) =>
      getPrisma().product.findFirst({
        where: { AND: [visibleProductWhere, { tcgSetId: set.id }] },
        select: {
          name: true,
          productType: true,
          images: {
            select: { url: true, alt: true },
            orderBy: imageOrder,
            take: 1,
          },
        },
        orderBy: [
          { featured: 'desc' },
          { publishedAt: { sort: 'desc', nulls: 'last' } },
          { id: 'asc' },
        ],
      }),
    ),
  );
  return picked.flatMap(({ set, game, href, count }, position) => {
    const product = products[position];
    if (!product) return [];
    return [
      {
        slug: set.slug,
        name: set.name,
        gameName: game.name,
        releaseDate: set.releaseDate,
        href,
        count,
        image: getProductVisual(
          product.productType,
          product.name,
          product.images[0],
        ),
      },
    ];
  });
}

// ---------------------------------------------------------------------------
// Journal: the latest news, else the latest guides (never glossary entries
// or questions, which are reference pages rather than reading), about the
// licence sold or about no licence in particular.

export interface HomeJournalEntry {
  href: string;
  title: string;
  description: string;
  kind: ContentKind;
  published: Date;
}

export interface HomeJournal {
  /** Section index: /actualites or /guides. */
  href: string;
  news: boolean;
  entries: HomeJournalEntry[];
}

const READING_KINDS: readonly ContentKind[] = [
  'guide',
  'dossier',
  'comparatif',
];

async function getHomeJournal(limit: number): Promise<HomeJournal | null> {
  const content = await getAllContent();
  const latest = (kinds: readonly ContentKind[]) =>
    content
      .filter((entry) => kinds.includes(entry.kind) && isShopGame(entry.games))
      .sort((a, b) => b.published.getTime() - a.published.getTime())
      .slice(0, limit)
      .map(({ href, title, description, kind, published }) => ({
        href,
        title,
        description,
        kind,
        published,
      }));
  const news = latest(['actualite']);
  if (news.length) return { href: '/actualites', news: true, entries: news };
  const guides = latest(READING_KINDS);
  return guides.length
    ? { href: '/guides', news: false, entries: guides }
    : null;
}

// ---------------------------------------------------------------------------
// Products shown in several sections

/**
 * Each product once on the page: a later section drops what an earlier one
 * already shows, so the visitor never meets the same card twice.
 */
export function distinctSections<
  const Sections extends readonly (readonly CatalogProduct[])[],
>(sections: Sections): { [Index in keyof Sections]: CatalogProduct[] } {
  const seen = new Set<string>();
  return sections.map((products) =>
    products.filter((product) => {
      if (seen.has(product.id)) return false;
      seen.add(product.id);
      return true;
    }),
  ) as { [Index in keyof Sections]: CatalogProduct[] };
}

/** Demonstration data is named « [Démo] … » by the development seed. */
export function isDemoCatalogue(products: readonly CatalogProduct[]) {
  return products.some((product) => product.name.startsWith('[Démo]'));
}

// ---------------------------------------------------------------------------

export interface HomeData {
  families: HomeFamily[];
  collections: HomeCollection[];
  links: HomeLinks;
  journal: HomeJournal | null;
}

async function getHomeLinks(): Promise<HomeLinks> {
  const listings = await getIndexableListings();
  return Object.fromEntries(
    [...listings.keys()].map((kind) => [kind, LISTING_HUBS[kind].path]),
  );
}

export async function getHomeData(): Promise<HomeData> {
  const [navigation, collections, links, journal] = await Promise.all([
    getNavigation(),
    getHomeCollections(2),
    getHomeLinks(),
    getHomeJournal(3),
  ]);
  return {
    families: await getHomeFamilies(navigation),
    collections,
    links,
    journal,
  };
}
