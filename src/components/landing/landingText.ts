// Visible text of the game silos (/{game}, /{game}/{facet}…, /categorie,
// /extensions, /calendrier-des-sorties): headings, factual intros, factual FAQ,
// breadcrumbs and release windows. Every sentence is built from the data passed
// in; a fact without data is left out. Pure module.
import type { BreadcrumbItem } from '@/components/ui/Breadcrumb/Breadcrumb';
import {
  LANGUAGE_IN_LABELS,
  LANGUAGE_LABELS,
  STATUS_LABELS,
  landingKind,
  landingPath,
  type FacetLanguage,
} from '@/lib/seo/facets';
import { formatDateFr, formatEuro, listFr } from '@/lib/seo/metadata';
import type {
  CategoryRef,
  FaqEntry,
  LandingScope,
  ScopeStats,
  SetRef,
} from '@/lib/seo/types';

/** H1 length beyond which a list of games is left out of a heading. */
const HEADING_MAX = 60;
const LIST_MAX = 6;

export const plural = (count: number, one: string, many: string) =>
  `${count} ${count > 1 ? many : one}`;

const capitalize = (text: string) =>
  text.charAt(0).toLocaleUpperCase('fr-FR') + text.slice(1);

/** « Boosters » → « boosters » inside a sentence; keeps « ETB », « Elite Trainer Box ». */
export function inSentence(name: string): string {
  const [first = '', ...rest] = name.split(' ');
  if (
    /\p{Lu}/u.test(first.slice(1)) ||
    rest.some((word) => /\p{Lu}/u.test(word))
  )
    return name;
  return first.charAt(0).toLocaleLowerCase('fr-FR') + name.slice(1);
}

const words = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/** Every word of `part` appears in `text`: « Pokémon » in « Pokémon 151 ». */
function mentions(text: string, part: string): boolean {
  const present = new Set(words(text));
  const wanted = words(part);
  return wanted.length > 0 && wanted.every((word) => present.has(word));
}

/** « Pokémon Flammes Obsidiennes »; « Pokémon 151 » is not repeated. */
export function gameAndSet(game: string, set: string): string {
  return mentions(set, game) ? set : `${game} ${set}`;
}

/** « ETB Pokémon », « ETB Pokémon Flammes Obsidiennes ». */
export function familyAndSubject(category: string, subject: string): string {
  return mentions(category, subject) ? category : `${category} ${subject}`;
}

/** Released on or before `today` (both at midnight UTC, @db.Date style). */
export function isUpcoming(date: Date, today: Date): boolean {
  return date.getTime() > today.getTime();
}

/** « sortie le 28 juillet 2026 » or « sortie prévue le 25 décembre 2026 ». */
export function releasePhrase(date: Date, today: Date): string {
  return `${isUpcoming(date, today) ? 'sortie prévue le' : 'sortie le'} ${formatDateFr(date)}`;
}

// ---------------------------------------------------------------------------
// Facts: sentences whose parts may link to an indexable page

export type FactPart = string | { text: string; href: string };
/** One sentence of a factual intro. */
export type Fact = FactPart[];

export interface CountedLink {
  label: string;
  /** Real product count. */
  count: number;
  /** Indexable target, when there is one. */
  href?: string;
}

export interface DatedLink extends CountedLink {
  releaseDate: Date | null;
}

export interface LanguageLink extends CountedLink {
  language: FacetLanguage;
}

/** Adjacent strings merged, so a sentence reads the same once rendered. */
function sentence(...parts: (FactPart | FactPart[])[]): Fact {
  const merged: Fact = [];
  for (const part of parts.flat()) {
    const last = merged.at(-1);
    if (typeof part === 'string' && typeof last === 'string')
      merged[merged.length - 1] = last + part;
    else if (part !== '') merged.push(part);
  }
  return merged;
}

/** Plain text of a fact (tests, meta descriptions). */
export function factText(fact: Fact): string {
  return fact
    .map((part) => (typeof part === 'string' ? part : part.text))
    .join('');
}

const linkPart = (item: { label: string; href?: string }): FactPart =>
  item.href ? { text: item.label, href: item.href } : item.label;

/** « a, b et c » over parts. */
function joinParts(items: readonly FactPart[][]): FactPart[] {
  return items.flatMap((item, index) => [
    index === 0 ? '' : index === items.length - 1 ? ' et ' : ', ',
    ...item,
  ]);
}

/** « Boosters (3), ETB (2) et 4 autres » */
function countedList(
  items: readonly CountedLink[],
  max = LIST_MAX,
): FactPart[] {
  const shown = items.slice(0, max);
  const rest = items.length - shown.length;
  return joinParts([
    ...shown.map((item) => [linkPart(item), ` (${item.count})`]),
    ...(rest > 0 ? [[plural(rest, 'autre', 'autres')]] : []),
  ]);
}

/** « {prefix}Boosters (3), ETB (2) et 4 autres{suffix} » */
export function countedFact(
  prefix: string,
  items: readonly CountedLink[],
  suffix = '.',
): Fact {
  return sentence(prefix, countedList(items), suffix);
}

/** « Boosters (3), ETB (2) et 4 autres » as plain text. */
function countedText(items: readonly CountedLink[], max = LIST_MAX): string {
  return factText(countedList(items, max));
}

function priceRange(stats: ScopeStats): string {
  const { minPrice: min, maxPrice: max } = stats;
  if (!min) return '';
  if (!max || Number(max) <= Number(min)) return ` à ${formatEuro(min)}`;
  return `, de ${formatEuro(min)} à ${formatEuro(max)}`;
}

/** « Extension Pokémon de la série X, code Y, sortie le Z. » */
export function setDetailsFact(
  set: Pick<SetRef, 'series' | 'code' | 'releaseDate'>,
  today: Date,
  gameName?: string | null,
): Fact | null {
  if (!set.series && !set.code && !set.releaseDate) return null;
  const head = `Extension${gameName ? ` ${gameName}` : ''}${
    set.series ? ` de la série ${set.series}` : ''
  }`;
  const details = [
    set.code ? `code ${set.code}` : null,
    set.releaseDate ? releasePhrase(set.releaseDate, today) : null,
  ].filter((detail): detail is string => Boolean(detail));
  return [`${[head, ...details].join(', ')}.`];
}

type CountSubject = 'set' | 'category' | 'other';

function countFact(
  stats: ScopeStats,
  qualifier: string,
  subject: CountSubject,
): Fact {
  const count = stats.productCount;
  if (count)
    return [
      `${plural(count, 'produit', 'produits')} ${qualifier}${priceRange(stats)}.`,
    ];
  if (subject === 'set')
    return ['Aucun produit de cette extension n’est en ligne pour le moment.'];
  if (subject === 'category')
    return ['Aucun produit de cette famille n’est en ligne pour le moment.'];
  return ['Aucun produit en ligne pour le moment.'];
}

function familiesFact(
  families: readonly CountedLink[],
  sub: boolean,
): Fact | null {
  if (!families.length) return null;
  const label = sub
    ? families.length > 1
      ? 'Sous-familles'
      : 'Sous-famille'
    : families.length > 1
      ? 'Familles de produits'
      : 'Famille de produits';
  return sentence(`${label} : `, countedList(families), '.');
}

function availabilityParts(
  stats: Pick<ScopeStats, 'inStockCount' | 'preorderCount'>,
): string[] {
  return [
    stats.inStockCount > 0 ? `${stats.inStockCount} en stock` : null,
    stats.preorderCount > 0 ? `${stats.preorderCount} en précommande` : null,
  ].filter((part): part is string => Boolean(part));
}

/** Stock and preorders; a status facet already says it, so it is skipped there. */
function availabilityFact(stats: ScopeStats): Fact | null {
  if (!stats.productCount) return null;
  const parts = availabilityParts(stats);
  return [
    parts.length
      ? `Disponibilité : ${listFr(parts)}.`
      : 'Aucun produit en stock pour le moment.',
  ];
}

function languagesFact(languages: readonly CountedLink[]): Fact | null {
  if (!languages.length) return null;
  return sentence(
    `${languages.length > 1 ? 'Langues' : 'Langue'} : `,
    countedList(languages),
    '.',
  );
}

function scopeQualifier(scope: Pick<LandingScope, 'language' | 'status'>) {
  if (scope.status === 'en-stock') return 'en stock';
  if (scope.status === 'precommandes') return 'en précommande';
  if (scope.status === 'nouveautes') return 'parmi les nouveautés';
  if (scope.language) return LANGUAGE_IN_LABELS[scope.language];
  return 'au catalogue';
}

export interface LandingFactsInput {
  scope: LandingScope;
  stats: ScopeStats;
  /**
   * Families present in the scope, most products first: the most specific
   * ones, or the sub-families when the scope has a family.
   */
  families?: readonly CountedLink[];
  /** Sets present in the scope, newest first (not read when the scope has a set). */
  sets?: readonly DatedLink[];
  /** Languages present in the scope (not read when the scope has a language). */
  languages?: readonly CountedLink[];
  /** Game hub: the soonest announced set of the game. */
  nextRelease?: DatedLink | null;
  /** Midnight UTC of the current day in France (parisToday). */
  today: Date;
}

/** Factual intro of a landing: what the data says, nothing more. */
export function landingFacts({
  scope,
  stats,
  families = [],
  sets = [],
  languages = [],
  nextRelease,
  today,
}: LandingFactsInput): Fact[] {
  const kind = landingKind(scope);
  const facts: (Fact | null)[] = [
    scope.set ? setDetailsFact(scope.set, today, scope.game.name) : null,
    countFact(
      stats,
      scopeQualifier(scope),
      kind === 'set' ? 'set' : kind === 'category' ? 'category' : 'other',
    ),
    familiesFact(families, Boolean(scope.category)),
  ];
  if (kind === 'game' && sets.length) {
    const latest = sets.find(
      (set) => set.releaseDate && !isUpcoming(set.releaseDate, today),
    );
    facts.push(
      sentence(
        `${plural(sets.length, 'extension', 'extensions')} au catalogue`,
        latest?.releaseDate
          ? [
              ', la plus récente : ',
              linkPart(latest),
              ` (${releasePhrase(latest.releaseDate, today)})`,
            ]
          : [],
        '.',
      ),
    );
  } else if (!scope.set && sets.length) {
    facts.push(
      sentence(
        `${sets.length > 1 ? 'Extensions' : 'Extension'} : `,
        countedList(sets),
        '.',
      ),
    );
    const upcoming = sets.filter(
      (set) => set.releaseDate && isUpcoming(set.releaseDate, today),
    );
    if (scope.status === 'precommandes' && upcoming.length)
      facts.push(
        sentence(
          upcoming.length > 1 ? 'Sorties prévues : ' : 'Sortie prévue : ',
          joinParts(
            upcoming
              .slice(0, LIST_MAX)
              .map((set) => [
                linkPart(set),
                set.releaseDate ? ` le ${formatDateFr(set.releaseDate)}` : '',
              ]),
          ),
          '.',
        ),
      );
  }
  if (scope.status !== 'en-stock' && scope.status !== 'precommandes')
    facts.push(availabilityFact(stats));
  if (!scope.language) facts.push(languagesFact(languages));
  if (
    kind === 'game' &&
    nextRelease?.releaseDate &&
    isUpcoming(nextRelease.releaseDate, today)
  )
    facts.push(
      sentence(
        'Prochaine sortie annoncée : ',
        linkPart(nextRelease),
        `, le ${formatDateFr(nextRelease.releaseDate)}.`,
      ),
    );
  return facts.filter((fact): fact is Fact => fact !== null);
}

export interface StandaloneSetFactsInput {
  set: Pick<SetRef, 'series' | 'code' | 'releaseDate'>;
  stats: ScopeStats;
  families?: readonly CountedLink[];
  languages?: readonly CountedLink[];
  today: Date;
}

/** /extensions/{slug} of a set without an active game. */
export function standaloneSetFacts({
  set,
  stats,
  families = [],
  languages = [],
  today,
}: StandaloneSetFactsInput): Fact[] {
  return [
    setDetailsFact(set, today),
    countFact(stats, 'au catalogue', 'set'),
    familiesFact(families, false),
    availabilityFact(stats),
    languagesFact(languages),
  ].filter((fact): fact is Fact => fact !== null);
}

export interface CategoryHubFactsInput {
  stats: ScopeStats;
  /** Games with products in the family, most products first. */
  games: readonly CountedLink[];
  /** Products without game (multi-game accessories…). */
  gamelessCount: number;
  /** Sub-families with products. */
  families?: readonly CountedLink[];
  languages?: readonly CountedLink[];
}

/** /categorie/{slug}: counts, games, sub-families, stock and languages. */
export function categoryHubFacts({
  stats,
  games,
  gamelessCount,
  families = [],
  languages = [],
}: CategoryHubFactsInput): Fact[] {
  const gameless = gamelessCount
    ? plural(gamelessCount, 'produit multi-jeux', 'produits multi-jeux')
    : null;
  const facts: (Fact | null)[] = [
    countFact(stats, 'au catalogue', 'category'),
    games.length
      ? sentence(
          `${games.length > 1 ? 'Jeux' : 'Jeu'} : `,
          joinParts([
            ...games.map((game) => [linkPart(game), ` (${game.count})`]),
            ...(gameless ? [[gameless]] : []),
          ]),
          '.',
        )
      : gameless
        ? [`${capitalize(gameless)}.`]
        : null,
    familiesFact(families, true),
    availabilityFact(stats),
    languagesFact(languages),
  ];
  return facts.filter((fact): fact is Fact => fact !== null);
}

// ---------------------------------------------------------------------------
// Headings

/** H1 matching the intent of the landing. */
export function landingHeading(scope: LandingScope): string {
  const game = scope.game.name;
  const subject = scope.set ? gameAndSet(game, scope.set.name) : game;
  const category = scope.category?.name;
  const family = category ? familyAndSubject(category, subject) : null;
  if (scope.status === 'en-stock')
    return `${family ?? (scope.set ? subject : `Produits ${game}`)} en stock`;
  if (scope.status === 'precommandes')
    return family ? `${family} en précommande` : `Précommandes ${subject}`;
  if (scope.status === 'nouveautes')
    return `Nouveautés ${
      category ? familyAndSubject(inSentence(category), subject) : subject
    }`;
  if (scope.language) {
    const inLanguage = LANGUAGE_IN_LABELS[scope.language];
    return `${family ?? (scope.set ? subject : `Produits ${game}`)} ${inLanguage}`;
  }
  return family ?? subject;
}

/** Small line above the H1. */
export function landingEyebrow(scope: LandingScope): string {
  const game = scope.game.name;
  if (scope.set) return `Extension ${game}`;
  if (scope.category) return `Famille de produits ${game}`;
  if (scope.language || scope.status) return `Catalogue ${game}`;
  return 'Jeu de cartes à collectionner';
}

/** /categorie/{slug}: the family and its games, when they fit and say it all. */
export function categoryHubHeading(
  name: string,
  gameNames: readonly string[],
  hasGamelessProducts: boolean,
): string {
  if (hasGamelessProducts || !gameNames.length || gameNames.length > 3)
    return name;
  const heading =
    gameNames.length === 1 && gameNames[0]
      ? familyAndSubject(name, gameNames[0])
      : `${name} ${listFr(gameNames)}`;
  return heading.length <= HEADING_MAX ? heading : name;
}

// ---------------------------------------------------------------------------
// Factual FAQ: only questions the data answers

export interface LandingFaqInput {
  scope: LandingScope;
  stats: ScopeStats;
  families?: readonly CountedLink[];
  sets?: readonly DatedLink[];
  languages?: readonly LanguageLink[];
  today: Date;
}

export function factualFaq({
  scope,
  stats,
  families = [],
  sets = [],
  languages = [],
  today,
}: LandingFaqInput): FaqEntry[] {
  const kind = landingKind(scope);
  const entries: FaqEntry[] = [];
  const count = stats.productCount;
  if (kind === 'set' && scope.set) {
    const { name, releaseDate } = scope.set;
    if (releaseDate && isUpcoming(releaseDate, today))
      entries.push({
        question: `Quand sort l’extension ${name} ?`,
        answer: `La sortie de l’extension ${name} est prévue le ${formatDateFr(releaseDate)}.${
          stats.preorderCount
            ? ` ${plural(stats.preorderCount, 'produit est', 'produits sont')} en précommande.`
            : ''
        }`,
      });
    else if (releaseDate)
      entries.push({
        question: `Quand est sortie l’extension ${name} ?`,
        answer: `L’extension ${name} est sortie le ${formatDateFr(releaseDate)}.`,
      });
    if (count) {
      const availability = availabilityParts(stats);
      entries.push({
        question: `Quels produits ${name} sont disponibles ?`,
        answer: [
          `${capitalize(plural(count, 'produit', 'produits'))} de l’extension ${name} au catalogue${
            families.length ? ` : ${countedText(families, 8)}` : ''
          }.`,
          availability.length
            ? `Disponibilité : ${listFr(availability)}.`
            : 'Aucun n’est en stock pour le moment.',
        ].join(' '),
      });
    }
    if (languages.length)
      entries.push({
        question: `En quelles langues trouver l’extension ${name} ?`,
        answer: `${capitalize(
          listFr(
            languages.map(
              (language) =>
                `${plural(language.count, 'produit', 'produits')} ${
                  LANGUAGE_IN_LABELS[language.language]
                }`,
            ),
          ),
        )}.`,
      });
  }
  if (kind === 'category' && scope.category) {
    const game = scope.game.name;
    const family = familyAndSubject(scope.category.name, game);
    const lowerFamily = familyAndSubject(inSentence(scope.category.name), game);
    for (const language of languages) {
      if (language.language === 'FR') continue;
      const inLanguage = LANGUAGE_IN_LABELS[language.language];
      entries.push({
        question: `Existe-t-il des ${lowerFamily} ${inLanguage} ?`,
        answer: `Oui : ${
          language.count > 1
            ? `${language.count} produits de la famille ${family} sont proposés`
            : `1 produit de la famille ${family} est proposé`
        } ${inLanguage}.`,
      });
    }
    if (sets.length)
      entries.push({
        question: `Dans quelles extensions trouver des ${lowerFamily} ?`,
        answer: `${capitalize(
          countedText(
            sets.map((set) => ({ ...set, href: undefined })),
            8,
          ),
        )}.`,
      });
  }
  return entries;
}

/** Editorial entries first; a question asked twice is kept once. */
export function mergeFaq(...lists: readonly (readonly FaqEntry[])[]) {
  const seen = new Set<string>();
  return lists.flat().filter((entry) => {
    const key = words(entry.question).join(' ');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Breadcrumb

/** Ancestors of a category, root first (cycle-safe). */
export function categoryAncestors<
  T extends { id: string; parentId: string | null },
>(categories: readonly T[], category: { parentId: string | null }): T[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const chain: T[] = [];
  const visited = new Set<string>();
  let parentId = category.parentId;
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = byId.get(parentId);
    if (!parent) break;
    chain.unshift(parent);
    parentId = parent.parentId;
  }
  return chain;
}

export interface LandingTrailInput {
  scope: LandingScope;
  /** Ancestors of the scope family, root first. */
  ancestors?: readonly CategoryRef[];
  /** An intermediate level is shown only when its page is indexable. */
  isIndexable: (path: string) => boolean;
}

/** Accueil › Jeu › Extension › Famille › Langue or statut. */
export function landingBreadcrumb({
  scope,
  ancestors = [],
  isIndexable,
}: LandingTrailInput): BreadcrumbItem[] {
  const { game, set, category } = scope;
  const levels: { label: string; scope: LandingScope }[] = [
    { label: game.name, scope: { game } },
  ];
  if (set) levels.push({ label: set.name, scope: { game, set } });
  if (category) {
    if (!set)
      for (const ancestor of ancestors)
        levels.push({
          label: ancestor.name,
          scope: { game, category: ancestor },
        });
    levels.push({
      label: category.name,
      scope: { game, ...(set ? { set } : {}), category },
    });
  }
  if (scope.language)
    levels.push({ label: capitalize(LANGUAGE_LABELS[scope.language]), scope });
  if (scope.status) levels.push({ label: STATUS_LABELS[scope.status], scope });
  return [
    { label: 'Accueil', href: '/' },
    ...levels.flatMap((level, index): BreadcrumbItem[] => {
      if (index === levels.length - 1) return [{ label: level.label }];
      const path = landingPath(level.scope);
      return isIndexable(path) ? [{ label: level.label, href: path }] : [];
    }),
  ];
}

// ---------------------------------------------------------------------------
// Release calendar

const PARIS_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Paris',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Midnight UTC of the current calendar day in France, comparable to @db.Date values. */
export function parisToday(now: Date): Date {
  const parts = Object.fromEntries(
    PARIS_DAY.formatToParts(now).map((part) => [part.type, part.value]),
  );
  return new Date(
    Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)),
  );
}

/** First day of the « last 12 months » window. */
export function releaseWindowStart(today: Date): Date {
  return new Date(
    Date.UTC(
      today.getUTCFullYear() - 1,
      today.getUTCMonth(),
      today.getUTCDate(),
    ),
  );
}

/**
 * Upcoming releases, soonest first, then the releases of the last 12 months,
 * most recent first. Ties keep the input order.
 */
export function releaseWindow<T extends { releaseDate: Date }>(
  entries: readonly T[],
  today: Date,
): { upcoming: T[]; recent: T[] } {
  const since = releaseWindowStart(today).getTime();
  const time = (entry: T) => entry.releaseDate.getTime();
  return {
    upcoming: entries
      .filter((entry) => isUpcoming(entry.releaseDate, today))
      .sort((a, b) => time(a) - time(b)),
    recent: entries
      .filter(
        (entry) =>
          !isUpcoming(entry.releaseDate, today) && time(entry) >= since,
      )
      .sort((a, b) => time(b) - time(a)),
  };
}

const MONTH = new Intl.DateTimeFormat('fr-FR', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

export interface MonthGroup<T> {
  /** « 2026-12 » */
  key: string;
  /** « Décembre 2026 » */
  label: string;
  entries: T[];
}

/** Consecutive entries of the same month, in the given order. */
export function groupByMonth<T extends { releaseDate: Date }>(
  entries: readonly T[],
): MonthGroup<T>[] {
  const groups: MonthGroup<T>[] = [];
  for (const entry of entries) {
    const key = entry.releaseDate.toISOString().slice(0, 7);
    let group = groups.at(-1);
    if (group?.key !== key) {
      group = {
        key,
        label: capitalize(MONTH.format(entry.releaseDate)),
        entries: [],
      };
      groups.push(group);
    }
    group.entries.push(entry);
  }
  return groups;
}

/** « 5 produits : 3 en stock, 2 en précommande » for a calendar entry. */
export function releaseStockText({
  count,
  inStockCount,
  preorderCount,
}: {
  count: number;
  inStockCount: number;
  preorderCount: number;
}): string {
  if (!count) return 'Aucun produit en ligne';
  const parts = availabilityParts({ inStockCount, preorderCount });
  return `${plural(count, 'produit', 'produits')}${
    parts.length ? ` : ${parts.join(', ')}` : ', aucun en stock'
  }`;
}

/** Path with the request query, e.g. to keep ?page=2 on a slug redirect. */
export function withSearchParams(
  path: string,
  params: Record<string, string | string[] | undefined>,
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params))
    for (const entry of Array.isArray(value) ? value : value ? [value] : [])
      query.append(key, entry);
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}
