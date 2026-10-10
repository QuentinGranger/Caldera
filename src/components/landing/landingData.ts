// Data of the game silos: route matching (renamed slugs, facet order), real
// aggregates, indexation, generated text and the links a page may carry.
import 'server-only';
import { visibleSetInEnvironment } from '@/lib/catalog/publicReleases';
import * as Sentry from '@sentry/nextjs';
import { cache } from 'react';
import { presentFamilies } from '@/components/catalog/listingHub';
import type { BreadcrumbItem } from '@/components/ui/Breadcrumb/Breadcrumb';
import type { CatalogScope } from '@/lib/catalog/params';
import {
  getCategories,
  getGameBySlug,
  getGameSets,
  getGames,
  getSetBySlug,
  toCategoryRef,
  toGameRef,
  toSetRef,
  type CatalogCategory,
  type CatalogGame,
  type CatalogGameSet,
} from '@/lib/catalog/taxonomy';
import {
  ContentError,
  getContentForScope,
  renderMarkdown,
  type ContentEntry,
} from '@/lib/content';
import { getPrisma } from '@/lib/db/prisma';
import {
  LANGUAGE_LABELS,
  indexationParent,
  isLanguageSlug,
  isReservedRootSlug,
  isStatusSlug,
  isSupportedScope,
  landingKind,
  landingPath,
  parseLandingSegments,
  type LandingLookup,
} from '@/lib/seo/facets';
import {
  decideLandingIndexation,
  isNotFoundDecision,
} from '@/lib/seo/indexation';
import { isPlaceholderImage } from '@/lib/seo/jsonld';
import {
  gameMetadataText,
  landingMetadataText,
  type MetadataImage,
  type MetadataText,
  type SeoOverrides,
} from '@/lib/seo/metadata';
import { findSlugRedirect } from '@/lib/seo/redirects';
import {
  categoryHubPath,
  getCategoryHubStats,
  getLandingIndex,
  getScopeBreakdown,
  getScopeStats,
  type ScopeBreakdown,
} from '@/lib/seo/registry';
import type {
  CategoryRef,
  FaqEntry,
  IndexDecision,
  LandingKind,
  LandingScope,
  ScopeStats,
  SeoLink,
  SeoLinkGroup,
} from '@/lib/seo/types';
import {
  categoryAncestors,
  factualFaq,
  familyAndSubject,
  isUpcoming,
  landingBreadcrumb,
  landingEyebrow,
  landingFacts,
  landingHeading,
  mergeFaq,
  parisToday,
  releaseWindowStart,
  type CountedLink,
  type DatedLink,
  type Fact,
  type LanguageLink,
} from './landingText';

export const CALENDAR_PATH = '/calendrier-des-sorties';
export const EXTENSIONS_PATH = '/extensions';
const GUIDE_LIMIT = 4;
const RECENT_SETS = 12;
const MAX_LINKS = 12;

/** Current day in France; request-time only (pages call connection() first). */
export const getToday = cache(() => parisToday(new Date()));

/** Indexable landings and /categorie hubs with their product count. */
export const getIndexedPages = cache(async () => {
  const index = await getLandingIndex();
  return new Map(
    [...index.landings, ...index.categoryHubs].map((page) => [
      page.path,
      page.productCount,
    ]),
  );
});

/** Active games that can own a silo (a reserved slug never can). */
export const getSiloGames = cache(async () =>
  (await getGames()).filter((game) => !isReservedRootSlug(game.slug)),
);

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

const segmentsPath = (gameSlug: string, segments: readonly string[]) =>
  ['', gameSlug, ...segments].map(encodeURIComponent).join('/');

// ---------------------------------------------------------------------------
// Matching

export type LandingMatch =
  | {
      type: 'ok';
      game: CatalogGame;
      scope: LandingScope;
      sets: CatalogGameSet[];
      categories: CatalogCategory[];
    }
  | { type: 'redirect'; path: string }
  | { type: 'not-found' };

const NOT_FOUND = { type: 'not-found' } as const;

/**
 * /{game} (joined = '') or /{game}/{a}[/{b}]: renamed game, set or category
 * slugs and a non canonical facet order ask for a redirect.
 */
export const matchLanding = cache(
  async (gameSlug: string, joined: string): Promise<LandingMatch> => {
    const segments = joined ? joined.split('/') : [];
    if (isReservedRootSlug(gameSlug) || segments.length > 2) return NOT_FOUND;
    const game = await getGameBySlug(gameSlug);
    if (!game) {
      const moved = await findSlugRedirect('GAME', gameSlug);
      const target =
        moved && (await getSiloGames()).find((g) => g.id === moved.entityId);
      return target && target.slug !== gameSlug
        ? { type: 'redirect', path: segmentsPath(target.slug, segments) }
        : NOT_FOUND;
    }
    const [sets, categories] = await Promise.all([
      getGameSets(game.id),
      getCategories(),
    ]);
    const gameRef = toGameRef(game);
    if (!segments.length)
      return { type: 'ok', game, scope: { game: gameRef }, sets, categories };
    const lookup: LandingLookup = {
      sets: new Map(sets.map((set) => [set.slug, toSetRef(set)])),
      categories: new Map(categories.map((c) => [c.slug, toCategoryRef(c)])),
    };
    const parsed = parseLandingSegments(segments, lookup);
    if (parsed.type === 'ok')
      return {
        type: 'ok',
        game,
        scope: { game: gameRef, ...parsed.scope },
        sets,
        categories,
      };
    if (parsed.type === 'redirect')
      return {
        type: 'redirect',
        path: segmentsPath(game.slug, parsed.segments),
      };
    // Unknown slugs: a renamed set of this game, then a renamed category.
    const known = (slug: string) =>
      isLanguageSlug(slug) ||
      isStatusSlug(slug) ||
      lookup.sets.has(slug) ||
      lookup.categories.has(slug);
    const decoded = segments.map(decodeSegment);
    const updated = await Promise.all(
      decoded.map(async (slug) => {
        if (known(slug)) return slug;
        const set = await findSlugRedirect('SET', slug);
        const movedSet = set && sets.find((s) => s.id === set.entityId);
        if (movedSet) return movedSet.slug;
        const category = await findSlugRedirect('CATEGORY', slug);
        const movedCategory =
          category && categories.find((c) => c.id === category.entityId);
        return movedCategory ? movedCategory.slug : slug;
      }),
    );
    if (updated.every((slug, index) => slug === decoded[index]))
      return NOT_FOUND;
    const reparsed = parseLandingSegments(updated, lookup);
    if (reparsed.type === 'ok')
      return {
        type: 'redirect',
        path: landingPath({ game: gameRef, ...reparsed.scope }),
      };
    if (reparsed.type === 'redirect')
      return {
        type: 'redirect',
        path: segmentsPath(game.slug, reparsed.segments),
      };
    return NOT_FOUND;
  },
);

// ---------------------------------------------------------------------------
// Landing view

export interface SetEntry {
  id: string;
  name: string;
  series: string | null;
  code: string | null;
  releaseDate: Date | null;
  logoUrl: string | null;
  /** The set's symbol, the small mark printed on its cards. */
  symbolUrl: string | null;
  gameName: string | null;
  /** Visible products. */
  count: number;
  /** Canonical page, only when indexable. */
  href?: string;
  upcoming: boolean;
}

export interface LandingView {
  game: CatalogGame;
  scope: LandingScope;
  kind: LandingKind;
  /** Canonical path of the landing. */
  path: string;
  catalogScope: CatalogScope;
  stats: ScopeStats;
  /** Decision of the unrefined first page. */
  decision: IndexDecision;
  /** Title and description of the first page, without the brand suffix. */
  text: MetadataText;
  image: MetadataImage | null;
  heading: string;
  eyebrow: string;
  /** Short description written in the admin (game, set or family). */
  description: string | null;
  facts: Fact[];
  breadcrumb: BreadcrumbItem[];
  /** Safe HTML of the editorial intro of the single entity of the page. */
  editorialHtml: string;
  faq: FaqEntry[];
  logo: { url: string; alt: string } | null;
  /** A set page: the set's symbol, beside its logo. */
  symbol: { url: string; alt: string } | null;
  guides: ContentEntry[];
  /** Game hub: upcoming sets (soonest first) and recent ones. */
  releases: { upcoming: SetEntry[]; recent: SetEntry[] } | null;
  /** Links of the empty state. */
  fallbackLinks: SeoLink[];
  /** Extra link groups for a landing without product. */
  emptyLinkGroups: SeoLinkGroup[];
  /** Paths of public sets with products or an announced release. */
  setPaths: ReadonlySet<string>;
  calendarIndexable: boolean;
}

export function catalogScopeOf(scope: LandingScope): CatalogScope {
  return {
    game: scope.game.slug,
    ...(scope.set ? { set: scope.set.slug } : {}),
    ...(scope.category ? { category: scope.category.slug } : {}),
    ...(scope.language ? { language: scope.language } : {}),
    ...(scope.status ? { status: scope.status } : {}),
  };
}

/**
 * Guides of a scope; a family also takes the content of its ancestors. An
 * unreadable content folder is reported and leaves the list empty: the
 * listing still renders.
 */
export async function scopeGuides(
  scope: { game?: string; set?: string },
  families: readonly { slug: string }[],
): Promise<ContentEntry[]> {
  let lists: ContentEntry[][];
  try {
    lists = await Promise.all(
      families.length
        ? families.map((family) =>
            getContentForScope(
              { ...scope, category: family.slug },
              GUIDE_LIMIT,
            ),
          )
        : [getContentForScope(scope, GUIDE_LIMIT)],
    );
  } catch (error) {
    if (!(error instanceof ContentError)) throw error;
    Sentry.captureException(error);
    return [];
  }
  const seen = new Set<string>();
  return lists
    .flat()
    .filter((entry) => !seen.has(entry.href) && seen.add(entry.href))
    .slice(0, GUIDE_LIMIT);
}

/** At least one dated set in the window of /calendrier-des-sorties. */
export const hasReleaseCalendar = cache(async () => {
  const games = await getSiloGames();
  if (!games.length) return false;
  const count = await getPrisma().tcgSet.count({
    where: {
      isActive: true,
      gameId: { in: games.map((game) => game.id) },
      releaseDate: { gte: releaseWindowStart(getToday()) },
      ...(process.env.NODE_ENV === 'production'
        ? {
            NOT: [
              { slug: { startsWith: 'dev-' } },
              { name: { startsWith: '[Démo]' } },
            ],
          }
        : {}),
    },
  });
  return count > 0;
});

/** Share image of an entity; replacement visuals never stand for it. */
function imageOf(
  url: string | null | undefined,
  alt: string,
): MetadataImage | null {
  return url && !isPlaceholderImage(url) ? { url, alt } : null;
}

async function buildLandingView(
  match: Extract<LandingMatch, { type: 'ok' }>,
): Promise<LandingView> {
  const { game, scope, sets, categories } = match;
  const kind = landingKind(scope);
  const path = landingPath(scope);
  const parent = indexationParent(scope);
  const needsParent = kind !== 'game' && kind !== 'set' && kind !== 'category';
  const category = scope.category
    ? (categories.find((c) => c.id === scope.category?.id) ?? null)
    : null;
  const today = getToday();
  const [
    stats,
    parentStats,
    listingStats,
    breakdown,
    indexed,
    setDetail,
    categoryHub,
    calendarIndexable,
  ] = await Promise.all([
    getScopeStats(scope),
    needsParent && parent ? getScopeStats(parent) : null,
    kind === 'status' && scope.status
      ? getScopeStats({ status: scope.status })
      : null,
    getScopeBreakdown(scope),
    getIndexedPages(),
    scope.set ? getSetBySlug(scope.set.slug) : null,
    kind === 'category' && category ? getCategoryHubStats(category.slug) : null,
    hasReleaseCalendar(),
  ]);
  const decision = decideLandingIndexation({
    scope,
    stats,
    parentStats,
    listingStats,
    entityExists: true,
  });
  const isIndexable = (target: string) => indexed.has(target);
  /** Indexable landing of a scope other than the page itself. */
  const hrefOf = (target: LandingScope) => {
    if (!isSupportedScope(target)) return undefined;
    const targetPath = landingPath(target);
    return targetPath !== path && indexed.has(targetPath)
      ? targetPath
      : undefined;
  };

  const bySlug = new Map(categories.map((c) => [c.slug, c]));
  // A family page lists its sub-families; the others the most specific ones.
  const familyRows: { slug: string; name: string; count: number }[] = category
    ? breakdown.categories
        .filter((c) => c.parentId === category.id)
        .sort((a, b) => b.count - a.count)
    : presentFamilies({ categories: breakdown.categories }, categories);
  const families: CountedLink[] = familyRows.flatMap((row) => {
    const ref = bySlug.get(row.slug);
    if (!ref) return [];
    return [
      {
        label: row.name,
        count: row.count,
        href: hrefOf({ ...scope, category: toCategoryRef(ref) }),
      },
    ];
  });
  // Newest first; the game hub also counts them.
  const setLinks: DatedLink[] = scope.set
    ? []
    : breakdown.sets.map((set) => ({
        label: set.name,
        count: set.count,
        releaseDate: set.releaseDate,
        href: hrefOf({ ...scope, set: toSetRef(set) }),
      }));
  const languages: LanguageLink[] = scope.language
    ? []
    : breakdown.languages.flatMap(({ language, count }) =>
        language === 'OTHER'
          ? []
          : [
              {
                language,
                label: LANGUAGE_LABELS[language],
                count,
                href: hrefOf({ ...scope, language }),
              },
            ],
      );

  const setCounts = new Map(breakdown.sets.map((set) => [set.id, set.count]));
  const setEntry = (set: CatalogGameSet): SetEntry => ({
    id: set.id,
    name: set.name,
    series: set.series,
    code: set.code,
    releaseDate: set.releaseDate,
    logoUrl: set.logoUrl,
    symbolUrl: set.symbolUrl,
    gameName: game.name,
    count: setCounts.get(set.id) ?? 0,
    href: hrefOf({ game: scope.game, set: toSetRef(set) }),
    upcoming: Boolean(set.releaseDate && isUpcoming(set.releaseDate, today)),
  });
  let releases: LandingView['releases'] = null;
  let nextRelease: DatedLink | null = null;
  if (kind === 'game') {
    const entries = sets.filter(visibleSetInEnvironment).map(setEntry);
    const upcoming = entries.filter((entry) => entry.upcoming).reverse();
    releases = {
      upcoming,
      recent: entries
        .filter((entry) => !entry.upcoming && entry.count > 0)
        .slice(0, RECENT_SETS),
    };
    const next = upcoming[0];
    nextRelease = next
      ? {
          label: next.name,
          count: next.count,
          releaseDate: next.releaseDate,
          href: next.href,
        }
      : null;
  }

  // A family's own SEO fields and image describe this landing only when the
  // game is the only one selling it (its /categorie hub points here).
  const ownFamily =
    kind === 'category' && categoryHub?.singleGameSlug === game.slug;
  const overrides: SeoOverrides | null =
    kind === 'game'
      ? game
      : kind === 'set'
        ? setDetail
        : ownFamily
          ? category
          : null;
  const familyNames = families.map((family) => family.label);
  const text =
    kind === 'game'
      ? gameMetadataText({
          game: scope.game,
          stats,
          availableCategoryNames: familyNames,
          overrides,
        })
      : landingMetadataText(scope, kind, stats, familyNames, overrides);
  const ancestors = category
    ? categoryAncestors(categories, category).map(toCategoryRef)
    : [];
  const entity =
    kind === 'game'
      ? {
          description: game.description,
          intro: game.intro,
          faq: game.faq,
          image: imageOf(game.logoUrl, `Logo ${game.name}`),
        }
      : kind === 'set' && setDetail
        ? {
            description: setDetail.description,
            intro: setDetail.intro,
            faq: setDetail.faq,
            image: imageOf(setDetail.logoUrl, `Logo ${setDetail.name}`),
          }
        : kind === 'category' && category
          ? {
              description: category.description,
              intro: category.intro,
              faq: category.faq,
              image: ownFamily
                ? imageOf(category.imageUrl, category.name)
                : null,
            }
          : null;
  const currentSet = scope.set
    ? sets.find((set) => set.id === scope.set?.id)
    : undefined;
  const setLogo = currentSet?.logoUrl ?? null;
  const setSymbol = currentSet?.symbolUrl ?? null;

  const gameHub = hrefOf({ game: scope.game });
  const fallbackLinks: SeoLink[] = [
    ...(gameHub
      ? [{ href: gameHub, label: `Tous les produits ${game.name}` }]
      : []),
    ...(calendarIndexable
      ? [{ href: CALENDAR_PATH, label: 'Calendrier des sorties' }]
      : []),
  ];
  const emptyLinkGroups: SeoLinkGroup[] = [];
  if (!stats.productCount && (kind === 'set' || kind === 'category')) {
    const familyLinks = categories.flatMap((c): SeoLink[] => {
      const href = hrefOf({ game: scope.game, category: toCategoryRef(c) });
      return href
        ? [
            {
              href,
              label: familyAndSubject(c.name, game.name),
              count: indexed.get(href),
            },
          ]
        : [];
    });
    emptyLinkGroups.push({
      title: `Familles de produits ${game.name}`,
      links: familyLinks.slice(0, MAX_LINKS),
    });
    if (category) {
      const hub = categoryHubPath(category.slug);
      const others = (await getSiloGames())
        .filter((other) => other.id !== game.id)
        .flatMap((other): SeoLink[] => {
          const href = hrefOf({
            game: toGameRef(other),
            category: toCategoryRef(category),
          });
          return href
            ? [
                {
                  href,
                  label: familyAndSubject(category.name, other.name),
                  count: indexed.get(href),
                },
              ]
            : [];
        });
      emptyLinkGroups.push({
        title: `${category.name} des autres jeux`,
        links: [
          ...(indexed.has(hub)
            ? [
                {
                  href: hub,
                  label: `${category.name} pour tous les jeux`,
                  count: indexed.get(hub),
                },
              ]
            : []),
          ...others,
        ].slice(0, MAX_LINKS),
      });
    }
  }

  return {
    game,
    scope,
    kind,
    path,
    catalogScope: catalogScopeOf(scope),
    stats,
    decision,
    text,
    image:
      entity?.image ??
      imageOf(setLogo, `Logo ${scope.set?.name ?? ''}`) ??
      imageOf(game.logoUrl, `Logo ${game.name}`),
    heading: landingHeading(scope),
    eyebrow: landingEyebrow(scope),
    description: entity?.description ?? null,
    facts: landingFacts({
      scope,
      stats,
      families,
      sets: setLinks,
      languages,
      nextRelease,
      today,
    }),
    breadcrumb: landingBreadcrumb({ scope, ancestors, isIndexable }),
    editorialHtml: renderMarkdown(entity?.intro),
    faq: mergeFaq(
      entity?.faq ?? [],
      factualFaq({
        scope,
        stats,
        families,
        sets: setLinks,
        languages,
        today,
      }),
    ),
    logo: setLogo
      ? { url: setLogo, alt: `Logo ${scope.set?.name ?? ''}` }
      : null,
    symbol: setSymbol
      ? {
          url: setSymbol,
          alt: `Symbole de l’extension ${scope.set?.name ?? ''}`,
        }
      : null,
    guides: await scopeGuides(
      { game: game.slug, ...(scope.set ? { set: scope.set.slug } : {}) },
      category ? [category, ...[...ancestors].reverse()] : [],
    ),
    releases,
    fallbackLinks,
    emptyLinkGroups: emptyLinkGroups.filter((group) => group.links.length),
    setPaths: new Set(
      sets
        .filter(visibleSetInEnvironment)
        .filter(
          (set) =>
            (setCounts.get(set.id) ?? 0) > 0 ||
            (set.releaseDate && isUpcoming(set.releaseDate, today)),
        )
        .map((set) => landingPath({ game: scope.game, set: toSetRef(set) })),
    ),
    calendarIndexable,
  };
}

export type LandingResolution =
  | { type: 'ok'; view: LandingView }
  | { type: 'redirect'; path: string }
  | { type: 'not-found' };

/** Cached per request: generateMetadata and the page share one resolution. */
export const resolveLanding = cache(
  async (gameSlug: string, joined: string): Promise<LandingResolution> => {
    const match = await matchLanding(gameSlug, joined);
    if (match.type !== 'ok') return match;
    const view = await buildLandingView(match);
    // A facet combination without any product does not exist.
    return isNotFoundDecision(view.decision) ? NOT_FOUND : { type: 'ok', view };
  },
);

/** Breakdown rows as counted links (sub-families of a family hub…). */
export function breakdownFamilies(
  breakdown: ScopeBreakdown,
  parent: Pick<CategoryRef, 'id'>,
  href: (slug: string) => string | undefined,
): CountedLink[] {
  return breakdown.categories
    .filter((c) => c.parentId === parent.id)
    .sort((a, b) => b.count - a.count)
    .map((c) => ({ label: c.name, count: c.count, href: href(c.slug) }));
}
