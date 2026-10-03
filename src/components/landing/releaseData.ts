// Set pages outside the game silos: /extensions, /extensions/{slug} (only for
// a set without active game) and /calendrier-des-sorties.
import 'server-only';
import { cache } from 'react';
import { presentFamilies } from '@/components/catalog/listingHub';
import type { BreadcrumbItem } from '@/components/ui/Breadcrumb/Breadcrumb';
import type { CatalogScope } from '@/lib/catalog/params';
import { visibleProductWhere } from '@/lib/catalog/queries';
import {
  getCategories,
  getGameSets,
  getSetBySlug,
  toGameRef,
  toSetRef,
  type CatalogSetDetail,
} from '@/lib/catalog/taxonomy';
import { renderMarkdown, type ContentEntry } from '@/lib/content';
import { getPrisma } from '@/lib/db/prisma';
import {
  LANGUAGE_LABELS,
  isReservedFacetSlug,
  isReservedRootSlug,
  landingPath,
} from '@/lib/seo/facets';
import { decideListingIndexation } from '@/lib/seo/indexation';
import { isPlaceholderImage } from '@/lib/seo/jsonld';
import {
  DESCRIPTION_MAX,
  TITLE_MAX,
  categoryHubText,
  formatDateFr,
  listFr,
  truncateAtWord,
  type MetadataImage,
  type MetadataText,
} from '@/lib/seo/metadata';
import { findSlugRedirect } from '@/lib/seo/redirects';
import { getScopeBreakdown, getScopeStats } from '@/lib/seo/registry';
import type { FaqEntry, IndexDecision, ScopeStats } from '@/lib/seo/types';
import {
  CALENDAR_PATH,
  EXTENSIONS_PATH,
  getIndexedPages,
  getSiloGames,
  getToday,
  hasReleaseCalendar,
  scopeGuides,
  type SetEntry,
} from './landingData';
import {
  CALENDAR_YEAR_MIN_SETS,
  calendarYearPath,
  countedFact,
  extensionReleaseSections,
  factText,
  isUpcoming,
  parseCalendarSlug,
  yearCalendarFacts,
  yearCalendarText,
  plural,
  releaseWindow,
  standaloneSetFacts,
  type CountedLink,
  type Fact,
} from './landingText';

/** Only the product count matters to a list decision. */
const countStats = (productCount: number): ScopeStats => ({
  productCount,
  inStockCount: 0,
  preorderCount: 0,
  newArrivalCount: 0,
  minPrice: null,
  maxPrice: null,
  languages: [],
  lastModified: null,
});

const setPagePath = (slug: string) =>
  `${EXTENSIONS_PATH}/${encodeURIComponent(slug)}`;

const isDemoSet = (set: { slug: string; name: string }) =>
  set.slug.startsWith('dev-') || set.name.trimStart().startsWith('[Démo]');

const visibleSetInEnvironment = (set: { slug: string; name: string }) =>
  process.env.NODE_ENV !== 'production' || !isDemoSet(set);

/** Canonical page of a set living under an active game, if any. */
function siloPath(
  set: Pick<CatalogSetDetail, 'game'> & Parameters<typeof toSetRef>[0],
): string | null {
  const game = set.game;
  if (!game?.isActive || isReservedRootSlug(game.slug)) return null;
  // A set slug taken by a language or status would resolve to that facet.
  if (isReservedFacetSlug(set.slug)) return null;
  return landingPath({ game: toGameRef(game), set: toSetRef(set) });
}

// ---------------------------------------------------------------------------
// /extensions

export interface SetGroup {
  /** Anchor of the group: the game slug, « autres » for sets without game. */
  id: string;
  /** Null for the sets without game. */
  gameName: string | null;
  title: string;
  /** Game hub, when indexable. */
  href?: string;
  entries: SetEntry[];
}

export interface ExtensionsIndex {
  groups: SetGroup[];
  /** Announced sets of every game, soonest first. */
  upcoming: SetEntry[];
  /** Released in the rolling recent window, newest first. */
  recent: SetEntry[];
  /** Older or undated released sets, newest first and undated last. */
  released: SetEntry[];
  total: number;
  heading: string;
  text: MetadataText;
  facts: Fact[];
  decision: IndexDecision;
  calendarIndexable: boolean;
}

/** Sets without game: visible product counts in one query. */
async function gamelessSets(today: Date): Promise<SetEntry[]> {
  const db = getPrisma();
  const sets = await db.tcgSet.findMany({
    where: { isActive: true, gameId: null },
    select: {
      id: true,
      slug: true,
      name: true,
      series: true,
      code: true,
      releaseDate: true,
      logoUrl: true,
    },
    orderBy: [
      { releaseDate: { sort: 'desc', nulls: 'last' } },
      { name: 'asc' },
      { id: 'asc' },
    ],
  });
  const visibleSets = sets.filter(visibleSetInEnvironment);
  if (!visibleSets.length) return [];
  const groups = await db.product.groupBy({
    by: ['tcgSetId'],
    where: {
      AND: [
        visibleProductWhere,
        { tcgSetId: { in: visibleSets.map((s) => s.id) } },
      ],
    },
    _count: { _all: true },
  });
  const counts = new Map(groups.map((g) => [g.tcgSetId, g._count._all]));
  return visibleSets.flatMap((set) => {
    const count = counts.get(set.id) ?? 0;
    const upcoming = Boolean(
      set.releaseDate && isUpcoming(set.releaseDate, today),
    );
    if (!count && !upcoming) return [];
    const path = setPagePath(set.slug);
    const indexable = decideListingIndexation({
      path,
      stats: countStats(count),
    }).index;
    return [
      {
        id: set.id,
        name: set.name,
        series: set.series,
        code: set.code,
        releaseDate: set.releaseDate,
        logoUrl: set.logoUrl,
        gameName: null,
        count,
        href: indexable ? path : undefined,
        upcoming,
      },
    ];
  });
}

/** Sets with products or announced, grouped by game, newest first. */
export const getExtensionsIndex = cache(async (): Promise<ExtensionsIndex> => {
  const today = getToday();
  const [games, indexed, others, calendarIndexable] = await Promise.all([
    getSiloGames(),
    getIndexedPages(),
    gamelessSets(today),
    hasReleaseCalendar(),
  ]);
  const groups: SetGroup[] = await Promise.all(
    games.map(async (game) => {
      const [sets, breakdown] = await Promise.all([
        getGameSets(game.id),
        getScopeBreakdown({ game }),
      ]);
      const counts = new Map(breakdown.sets.map((set) => [set.id, set.count]));
      const visibleSets = sets.filter(visibleSetInEnvironment);
      const gameRef = toGameRef(game);
      const hub = landingPath({ game: gameRef });
      return {
        id: game.slug,
        gameName: game.name,
        title: `Extensions ${game.name}`,
        href: indexed.has(hub) ? hub : undefined,
        entries: visibleSets.flatMap((set): SetEntry[] => {
          const count = counts.get(set.id) ?? 0;
          const upcoming = Boolean(
            set.releaseDate && isUpcoming(set.releaseDate, today),
          );
          if (!count && !upcoming) return [];
          const path = landingPath({ game: gameRef, set: toSetRef(set) });
          return [
            {
              id: set.id,
              name: set.name,
              series: set.series,
              code: set.code,
              releaseDate: set.releaseDate,
              logoUrl: set.logoUrl,
              gameName: game.name,
              count,
              href: indexed.has(path) ? path : undefined,
              upcoming,
            },
          ];
        }),
      };
    }),
  );
  if (others.length)
    groups.push({
      id: 'autres',
      gameName: null,
      title: 'Autres extensions',
      entries: others,
    });
  const listed = groups.filter((group) => group.entries.length);
  const all = [
    ...new Map(
      listed
        .flatMap((group) => group.entries)
        .map((entry) => [entry.id, entry] as const),
    ).values(),
  ];
  const { upcoming, recent, released } = extensionReleaseSections(all, today);
  const gameNames = listed.flatMap((group) =>
    group.gameName ? [group.gameName] : [],
  );
  const named = `Extensions ${listFr(gameNames)}`;
  const heading =
    gameNames.length &&
    gameNames.length <= 3 &&
    !others.length &&
    named.length <= TITLE_MAX
      ? named
      : 'Extensions';
  const next = upcoming[0];
  const facts: Fact[] = [
    all.length
      ? countedFact(
          `${plural(all.length, 'extension', 'extensions')} : `,
          listed.map((group) => ({
            label: group.gameName ?? 'autres',
            count: group.entries.length,
            href: group.href,
          })),
        )
      : ['Aucune extension en ligne pour le moment.'],
    ...(next?.releaseDate
      ? [
          [
            `Prochaine sortie : ${next.name}${next.gameName ? ` (${next.gameName})` : ''}, le ${formatDateFr(next.releaseDate)}.`,
          ],
        ]
      : []),
  ];
  return {
    groups: listed,
    upcoming,
    recent,
    released,
    total: all.length,
    heading,
    text: {
      title: heading,
      description: truncateAtWord(
        facts.map(factText).join(' '),
        DESCRIPTION_MAX,
      ),
    },
    facts,
    decision: decideListingIndexation({
      path: EXTENSIONS_PATH,
      stats: countStats(all.length),
      min: 1,
    }),
    calendarIndexable,
  };
});

// ---------------------------------------------------------------------------
// /extensions/{slug}

export interface StandaloneSetView {
  set: CatalogSetDetail;
  path: string;
  catalogScope: CatalogScope;
  stats: ScopeStats;
  decision: IndexDecision;
  text: MetadataText;
  image: MetadataImage | null;
  facts: Fact[];
  breadcrumb: BreadcrumbItem[];
  editorialHtml: string;
  faq: FaqEntry[];
  guides: ContentEntry[];
}

export type SetResolution =
  | { type: 'ok'; view: StandaloneSetView }
  | { type: 'redirect'; path: string }
  | { type: 'not-found' };

async function buildStandaloneSet(
  set: CatalogSetDetail,
): Promise<StandaloneSetView> {
  const path = setPagePath(set.slug);
  const [stats, breakdown, categories, index] = await Promise.all([
    getScopeStats({ set }),
    getScopeBreakdown({ set }),
    getCategories(),
    getExtensionsIndex(),
  ]);
  const families: CountedLink[] = presentFamilies(
    { categories: breakdown.categories },
    categories,
  ).map((family) => ({ label: family.name, count: family.count }));
  const languages: CountedLink[] = breakdown.languages.flatMap(
    ({ language, count }) =>
      language === 'OTHER' ? [] : [{ label: LANGUAGE_LABELS[language], count }],
  );
  return {
    set,
    path,
    catalogScope: { set: set.slug },
    stats,
    decision: decideListingIndexation({ path, stats }),
    text: categoryHubText({ name: set.name, stats, overrides: set }),
    image:
      set.logoUrl && !isPlaceholderImage(set.logoUrl)
        ? { url: set.logoUrl, alt: `Logo ${set.name}` }
        : null,
    facts: standaloneSetFacts({
      set,
      stats,
      families,
      languages,
      today: getToday(),
    }),
    breadcrumb: [
      { label: 'Accueil', href: '/' },
      ...(index.decision.index
        ? [{ label: 'Extensions', href: EXTENSIONS_PATH }]
        : []),
      { label: set.name },
    ],
    editorialHtml: renderMarkdown(set.intro),
    faq: set.faq,
    guides: await scopeGuides({ set: set.slug }, []),
  };
}

/** /extensions/{slug}: 308 to the game silo, or the page of a set without game. */
export const resolveSetPage = cache(
  async (slug: string): Promise<SetResolution> => {
    const set = await getSetBySlug(slug);
    if (set) {
      const target = siloPath(set);
      return target
        ? { type: 'redirect', path: target }
        : { type: 'ok', view: await buildStandaloneSet(set) };
    }
    const moved = await findSlugRedirect('SET', slug);
    const renamed = moved
      ? await getPrisma().tcgSet.findFirst({
          where: { id: moved.entityId, isActive: true },
          select: { slug: true },
        })
      : null;
    const current =
      renamed && renamed.slug !== slug
        ? await getSetBySlug(renamed.slug)
        : null;
    if (!current) return { type: 'not-found' };
    return {
      type: 'redirect',
      path: siloPath(current) ?? setPagePath(current.slug),
    };
  },
);

// ---------------------------------------------------------------------------
// /calendrier-des-sorties

export interface CalendarEntry extends SetEntry {
  releaseDate: Date;
  gameName: string;
  gameSlug: string;
  inStockCount: number;
  preorderCount: number;
}

export interface ReleaseCalendar {
  upcoming: CalendarEntry[];
  recent: CalendarEntry[];
  heading: string;
  text: MetadataText;
  facts: Fact[];
  decision: IndexDecision;
}

/** Every dated set of the active games, with its product counts. */
const getDatedSets = cache(async () => {
  const today = getToday();
  const [games, indexed] = await Promise.all([
    getSiloGames(),
    getIndexedPages(),
  ]);
  const perGame = await Promise.all(
    games.map(async (game) => {
      const [sets, all, stock, preorders] = await Promise.all([
        getGameSets(game.id),
        getScopeBreakdown({ game }),
        getScopeBreakdown({ game, status: 'en-stock' }),
        getScopeBreakdown({ game, status: 'precommandes' }),
      ]);
      const counts = (breakdown: typeof all) =>
        new Map(breakdown.sets.map((set) => [set.id, set.count]));
      const [total, inStock, preorder] = [all, stock, preorders].map(counts);
      const gameRef = toGameRef(game);
      return sets.flatMap((set): CalendarEntry[] => {
        const releaseDate = set.releaseDate;
        if (!releaseDate) return [];
        const path = landingPath({ game: gameRef, set: toSetRef(set) });
        return [
          {
            id: set.id,
            name: set.name,
            series: set.series,
            code: set.code,
            releaseDate,
            logoUrl: set.logoUrl,
            gameName: game.name,
            gameSlug: game.slug,
            count: total?.get(set.id) ?? 0,
            inStockCount: inStock?.get(set.id) ?? 0,
            preorderCount: preorder?.get(set.id) ?? 0,
            href: indexed.has(path) ? path : undefined,
            upcoming: isUpcoming(releaseDate, today),
          },
        ];
      });
    }),
  );
  return { games, entries: perGame.flat() };
});

/** Dated sets of the active games: upcoming ones, then the last 12 months. */
export const getReleaseCalendar = cache(async (): Promise<ReleaseCalendar> => {
  const today = getToday();
  const { games, entries } = await getDatedSets();
  const { upcoming, recent } = releaseWindow(entries, today);
  const gameNames = games
    .map((game) => game.name)
    .filter((name) =>
      [...upcoming, ...recent].some((entry) => entry.gameName === name),
    );
  const named = `Calendrier des sorties ${listFr(gameNames)}`;
  const heading =
    gameNames.length && gameNames.length <= 3 && named.length <= TITLE_MAX
      ? named
      : 'Calendrier des sorties';
  const next = upcoming[0];
  const sentences = [
    upcoming.length
      ? `${plural(upcoming.length, 'extension annoncée', 'extensions annoncées')}${
          next
            ? `, la prochaine : ${next.name} (${next.gameName}) le ${formatDateFr(next.releaseDate)}`
            : ''
        }.`
      : 'Aucune sortie annoncée pour le moment.',
    recent.length
      ? `${plural(recent.length, 'extension sortie', 'extensions sorties')} au cours des 12 derniers mois.`
      : null,
  ].filter((text): text is string => Boolean(text));
  return {
    upcoming,
    recent,
    heading,
    text: {
      title: heading,
      description: truncateAtWord(sentences.join(' '), DESCRIPTION_MAX),
    },
    facts: sentences.map((text) => [text]),
    decision: decideListingIndexation({
      path: CALENDAR_PATH,
      stats: countStats(upcoming.length + recent.length),
      min: 1,
    }),
  };
});

// ---------------------------------------------------------------------------
// /calendrier-des-sorties/{année} and /calendrier-des-sorties/{jeu}-{année}

export interface YearCalendar {
  year: number;
  game: { slug: string; name: string } | null;
  path: string;
  upcoming: CalendarEntry[];
  released: CalendarEntry[];
  heading: string;
  text: MetadataText;
  facts: Fact[];
  decision: IndexDecision;
}

/** Releases of one year, for all games or one; null when there is none. */
export const getYearCalendar = cache(
  async (slug: string): Promise<YearCalendar | null> => {
    const parsed = parseCalendarSlug(slug);
    if (!parsed) return null;
    const today = getToday();
    const { games, entries } = await getDatedSets();
    const game = parsed.gameSlug
      ? games.find((candidate) => candidate.slug === parsed.gameSlug)
      : null;
    if (parsed.gameSlug && !game) return null;
    const inYear = entries.filter(
      (entry) =>
        entry.releaseDate.getUTCFullYear() === parsed.year &&
        (!game || entry.gameSlug === game.slug),
    );
    if (!inYear.length) return null;
    const byDate = (a: CalendarEntry, b: CalendarEntry) =>
      a.releaseDate.getTime() - b.releaseDate.getTime();
    const upcoming = inYear
      .filter((entry) => isUpcoming(entry.releaseDate, today))
      .sort(byDate);
    const released = inYear
      .filter((entry) => !isUpcoming(entry.releaseDate, today))
      .sort(byDate);
    const gameNames = [...new Set(inYear.map((entry) => entry.gameName))];
    const text = yearCalendarText({
      year: parsed.year,
      gameName: game?.name ?? null,
      gameNames,
      upcoming,
      released,
    });
    const path = calendarYearPath(parsed.year, game?.slug);
    const soleGame = [...new Set(inYear.map((entry) => entry.gameSlug))];
    // One game only that year: its own page (« sorties Pokémon 2026 ») is the
    // canonical one, the all-games page points to it.
    const decision =
      !game && soleGame.length === 1
        ? {
            index: false,
            reason: 'duplicate-of-game-year',
            canonicalPath: calendarYearPath(parsed.year, soleGame[0]),
          }
        : decideListingIndexation({
            path,
            stats: countStats(inYear.length),
            min: CALENDAR_YEAR_MIN_SETS,
          });
    return {
      year: parsed.year,
      game: game ? { slug: game.slug, name: game.name } : null,
      path,
      upcoming,
      released,
      heading: text.title,
      text,
      facts: yearCalendarFacts(upcoming, released, parsed.year),
      decision,
    };
  },
);

/** Year pages that have releases, all games first then per game, newest first. */
export const getCalendarYears = cache(
  async (): Promise<
    { path: string; label: string; count: number; indexable: boolean }[]
  > => {
    const { games, entries } = await getDatedSets();
    const count = (year: number, gameSlug?: string) =>
      entries.filter(
        (entry) =>
          entry.releaseDate.getUTCFullYear() === year &&
          (!gameSlug || entry.gameSlug === gameSlug),
      ).length;
    const years = [
      ...new Set(entries.map((entry) => entry.releaseDate.getUTCFullYear())),
    ].sort((a, b) => b - a);
    const pages = years.flatMap((year) => [
      { year, game: null as (typeof games)[number] | null },
      ...games.map((game) => ({ year, game })),
    ]);
    return pages.flatMap(({ year, game }) => {
      const total = count(year, game?.slug);
      const gamesThatYear = new Set(
        entries
          .filter((entry) => entry.releaseDate.getUTCFullYear() === year)
          .map((entry) => entry.gameSlug),
      ).size;
      // With a single game that year, only its own page is listed.
      if (!total || (!game && gamesThatYear === 1)) return [];
      return [
        {
          path: calendarYearPath(year, game?.slug),
          label: game ? `Sorties ${game.name} ${year}` : `Sorties ${year}`,
          count: total,
          indexable: total >= CALENDAR_YEAR_MIN_SETS,
        },
      ];
    });
  },
);
