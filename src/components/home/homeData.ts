// Facts of the home page: every figure, name and link comes from the catalogue
// and the landing index (docs/seo-architecture.md §1 and §7).
import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import {
  LISTING_HUBS,
  getIndexableListings,
  getListingHub,
  type ListingHub,
} from '@/components/catalog/listingHub';
import { getProductVisual } from '@/lib/catalog/images';
import { getHomeCategories, visibleProductWhere } from '@/lib/catalog/queries';
import {
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
import { getLandingIndex } from '@/lib/seo/registry';

export interface HomeFamily {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string;
  /** Multi-game hub, or the game landing when a single game has it. */
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

export interface HomeCopy {
  /** Games named in the H1 (one or two), null otherwise. */
  games: string | null;
  /** Hero paragraph. */
  summary: string;
  /** Meta description. */
  description: string;
}

// ---------------------------------------------------------------------------
// Copy

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

export function homeCopy(
  hub: Pick<ListingHub, 'stats' | 'games' | 'families'>,
): HomeCopy {
  const { stats } = hub;
  const gameNames = hub.games.games.map(({ game }) => game.name);
  const games =
    gameNames.length && gameNames.length <= 2 ? listFr(gameNames) : null;
  const families = hub.families.slice(0, 4).map((family) => family.name);
  const familyList = families.length
    ? capitalize(listFr(families.map(inSentence)))
    : null;
  const availability = [
    stats.inStockCount > 0 && `${stats.inStockCount} en stock`,
    stats.preorderCount > 0 && `${stats.preorderCount} en précommande`,
  ].filter((part): part is string => Boolean(part));
  const count = stats.productCount
    ? `${plural(stats.productCount, 'produit')}${
        availability.length ? `, dont ${listFr(availability)}` : ''
      }`
    : null;
  const range =
    stats.minPrice && stats.maxPrice && stats.maxPrice !== stats.minPrice
      ? ` de ${formatEuro(stats.minPrice)} à ${formatEuro(stats.maxPrice)}`
      : stats.minPrice
        ? ` à ${formatEuro(stats.minPrice)}`
        : '';
  const gamesSentence =
    !games && gameNames.length ? `Jeux : ${listFr(gameNames)}.` : null;

  const summary = count
    ? [
        gamesSentence,
        familyList ? `${familyList} : ${count}.` : `${capitalize(count)}.`,
      ]
        .filter(Boolean)
        .join(' ')
    : 'Aucun produit n’est en ligne pour le moment.';

  const subject = `Cartes ${games ?? 'à collectionner'}`;
  const description = fitSentences(
    [
      count
        ? `${subject} : ${plural(stats.productCount, 'produit')}${range}${
            availability.length ? `, dont ${listFr(availability)}` : ''
          }.`
        : `${subject}.`,
      gamesSentence,
      familyList && `${familyList}.`,
      'Livraison en France métropolitaine.',
    ].filter((sentence): sentence is string => Boolean(sentence)),
  );
  return { games, summary, description };
}

// ---------------------------------------------------------------------------
// Families

type Target = { href: string; count: number };

function flatten(families: readonly NavigationFamily[]): NavigationFamily[] {
  return families.flatMap((family) => [family, ...flatten(family.children)]);
}

/** Target of each family slug: its multi-game hub, else its largest game landing. */
export function familyTargets(navigation: Navigation): Map<string, Target> {
  const targets = new Map<string, Target>();
  for (const game of navigation.games)
    for (const family of flatten(game.families)) {
      const current = targets.get(family.slug);
      if (!current || family.count > current.count)
        targets.set(family.slug, { href: family.href, count: family.count });
    }
  for (const hub of flatten(navigation.categoryHubs))
    targets.set(hub.slug, { href: hub.href, count: hub.count });
  return targets;
}

async function getHomeFamilies(navigation: Navigation): Promise<HomeFamily[]> {
  const categories = await getHomeCategories();
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

/** Most recent sets whose landing is indexable, with one of their products. */
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
      if (!game) return [];
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

export interface HomeData {
  hub: ListingHub;
  copy: HomeCopy;
  families: HomeFamily[];
  collections: HomeCollection[];
  links: HomeLinks;
}

async function getHomeLinks(): Promise<HomeLinks> {
  const listings = await getIndexableListings();
  return Object.fromEntries(
    [...listings.keys()].map((kind) => [kind, LISTING_HUBS[kind].path]),
  );
}

export async function getHomeData(): Promise<HomeData> {
  const [hub, navigation, collections, links] = await Promise.all([
    getListingHub('catalogue'),
    getNavigation(),
    getHomeCollections(2),
    getHomeLinks(),
  ]);
  return {
    hub,
    copy: homeCopy(hub),
    families: await getHomeFamilies(navigation),
    collections,
    links,
  };
}
