// Metadata builders (docs/seo-architecture.md §5). Every sentence is made of
// facts passed in; nothing is claimed when the matching data is missing.
import type { Metadata } from 'next';
import { preordersEnabled } from '@/lib/catalog/preorders';
import { absoluteUrl } from '@/lib/site';
import type { Availability } from '@/types/product';
import {
  LANGUAGE_IN_LABELS,
  LANGUAGE_LABELS,
  STATUS_LABELS,
  type FacetLanguage,
} from './facets';
import { ORGANIZATION } from './policies';
import type {
  LandingKind,
  LandingScope,
  LanguageCode,
  ScopeStats,
} from './types';

export const SITE_NAME = ORGANIZATION.name;
/** Without the « | Caldera » suffix added by the layout title template. */
export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 160;

/** Public preview copy while examples cannot be purchased. */
export const DEMO_SITE_DESCRIPTION =
  'Découvrez Caldera et nos guides sur les cartes Pokémon. Boutique en préparation : catalogue de démonstration, achats non ouverts.';

export interface MetadataImage {
  /** Site path or absolute URL. */
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}

export const DEFAULT_OG_IMAGE: MetadataImage = {
  url: ORGANIZATION.logo.path,
  alt: ORGANIZATION.name,
  width: ORGANIZATION.logo.width,
  height: ORGANIZATION.logo.height,
};

export interface BuildMetadataInput {
  title: string;
  description: string;
  /** Path of the page itself (no origin), ?page=N included. */
  path: string;
  index: boolean;
  /**
   * IndexDecision.canonicalPath. When it differs from `path` the page is a
   * duplicate: robots stay index, follow (never noindex with a cross canonical).
   */
  canonicalPath?: string;
  image?: MetadataImage | null;
  type?: 'website' | 'article';
  /** Bypass the layout title template. */
  absoluteTitle?: boolean;
}

export function buildMetadata({
  title,
  description,
  path,
  index,
  canonicalPath = path,
  image,
  type = 'website',
  absoluteTitle = false,
}: BuildMetadataInput): Metadata {
  const canonical = absoluteUrl(canonicalPath);
  const shareImage = image ?? DEFAULT_OG_IMAGE;
  const imageUrl = absoluteUrl(shareImage.url);
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical },
    robots: { index: index || canonicalPath !== path, follow: true },
    openGraph: {
      type,
      locale: 'fr_FR',
      siteName: SITE_NAME,
      title,
      description,
      url: canonical,
      images: [
        {
          url: imageUrl,
          ...(shareImage.alt ? { alt: shareImage.alt } : {}),
          ...(shareImage.width ? { width: shareImage.width } : {}),
          ...(shareImage.height ? { height: shareImage.height } : {}),
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
  };
}

// ---------------------------------------------------------------------------
// Formatting utilities

const NBSP = '\u00a0';
const euroNumber = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const frenchDate = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/** « 54,90 € » with non-breaking spaces. */
export function formatEuro(value: string | number): string {
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount)) throw new TypeError('Invalid amount');
  return `${euroNumber.format(amount).replace(/\s/g, NBSP)}${NBSP}€`;
}

/** « 14 novembre 2026 », « 1er mars 2027 »; @db.Date values are read in UTC. */
export function formatDateFr(date: Date | string): string {
  const value = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) throw new TypeError('Invalid date');
  return frenchDate.format(value).replace(/^1 /, '1er ');
}

const collapse = (text: string) => text.replace(/[ \t\r\n]+/g, ' ').trim();

/** Cuts on a space (non-breaking spaces never split), ellipsis within `max`. */
export function truncateAtWord(text: string, max = DESCRIPTION_MAX): string {
  const clean = collapse(text);
  if (clean.length <= max) return clean;
  const cut = clean.lastIndexOf(' ', max - 1);
  const head = cut > 0 ? clean.slice(0, cut) : clean.slice(0, max - 1);
  if (/[.!?]$/.test(head)) return head;
  return `${head.replace(/[\s,;:–—-]+$/, '')}…`;
}

/** Whole sentences while they fit; the first one is cut at a word if needed. */
function joinSentences(sentences: readonly string[], max = DESCRIPTION_MAX) {
  let result = '';
  for (const sentence of sentences.map(collapse).filter(Boolean)) {
    const next = result ? `${result} ${sentence}` : sentence;
    if (next.length > max) break;
    result = next;
  }
  return result || truncateAtWord(sentences.find(Boolean) ?? '', max);
}

const capitalize = (text: string) =>
  text.charAt(0).toLocaleUpperCase('fr-FR') + text.slice(1);

/** « Boosters » → « boosters » inside a sentence; keeps « ETB », « Elite Trainer Box ». */
function inSentence(name: string): string {
  const [first = '', ...rest] = name.split(' ');
  if (
    /\p{Lu}/u.test(first.slice(1)) ||
    rest.some((word) => /\p{Lu}/u.test(word))
  )
    return name;
  return first.charAt(0).toLocaleLowerCase('fr-FR') + name.slice(1);
}

/** « a », « a et b », « a, b et c » */
export function listFr(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`;
}

const STOP_WORDS = new Set([
  'a',
  'au',
  'aux',
  'd',
  'de',
  'des',
  'du',
  'en',
  'et',
  'l',
  'la',
  'le',
  'les',
  'of',
  'pour',
  'the',
  'un',
  'une',
]);

/** Significant words, accents and plural marks removed. */
function wordsOf(text: string): Set<string> {
  return new Set(
    text
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\b(?:elite trainer box|coffret dresseur d elite)\b/g, 'etb')
      .split(' ')
      .filter((word) => word && !STOP_WORDS.has(word))
      .map((word) => (word.length > 3 ? word.replace(/[sx]$/, '') : word)),
  );
}

function sharesWord(text: string, part: string): boolean {
  const words = wordsOf(text);
  return [...wordsOf(part)].some((word) => words.has(word));
}

function containsAll(text: string, part: string): boolean {
  const words = wordsOf(text);
  const partWords = [...wordsOf(part)];
  return partWords.length > 0 && partWords.every((word) => words.has(word));
}

/** Joins parts, dropping one already contained in another (« Pokémon » in « Pokémon 151 »). */
function phrase(...parts: (string | null | undefined | false)[]): string {
  const present = parts.filter((part): part is string => Boolean(part));
  return present
    .filter(
      (part, index) =>
        !present.some(
          (other, otherIndex) =>
            otherIndex !== index &&
            containsAll(other, part) &&
            (!containsAll(part, other) || otherIndex < index),
        ),
    )
    .join(' ');
}

/** Longest list of names (3 at most) that keeps the title within TITLE_MAX. */
function fitList(
  build: (list: string) => string,
  names: readonly string[],
): string | null {
  for (let count = Math.min(3, names.length); count > 0; count--) {
    const title = build(listFr(names.slice(0, count)));
    if (title.length <= TITLE_MAX) return title;
  }
  return null;
}

function firstFitting(...candidates: (string | null | undefined)[]): string {
  const present = candidates.filter((c): c is string => Boolean(c));
  return present.find((c) => c.length <= TITLE_MAX) ?? present.at(-1) ?? '';
}

// ---------------------------------------------------------------------------
// Facts shared by the descriptions

export interface SeoOverrides {
  seoTitle?: string | null;
  seoDescription?: string | null;
}

export interface MetadataText {
  title: string;
  description: string;
}

function withOverrides(
  text: MetadataText,
  overrides?: SeoOverrides | null,
): MetadataText {
  const title = collapse(overrides?.seoTitle ?? '');
  const description = collapse(overrides?.seoDescription ?? '');
  return {
    title: title || text.title,
    description: description || text.description,
  };
}

const facetLanguages = (languages: readonly LanguageCode[]) =>
  [...new Set(languages)].filter(
    (language): language is FacetLanguage => language !== 'OTHER',
  );

function priceRange(min: string | null, max: string | null): string | null {
  if (!min) return null;
  if (!max || Number(max) <= Number(min)) return `à ${formatEuro(min)}`;
  return `de ${formatEuro(min)} à ${formatEuro(max)}`;
}

function languagesSentence(languages: readonly LanguageCode[]): string | null {
  const labels = facetLanguages(languages).map((l) => LANGUAGE_LABELS[l]);
  if (!labels.length) return null;
  return `${labels.length > 1 ? 'Langues' : 'Langue'} : ${listFr(labels)}.`;
}

interface StatsSentenceOptions {
  subject: string;
  releaseDate?: Date | null;
  skipStock?: boolean;
  skipPreorder?: boolean;
  skipLanguages?: boolean;
}

function statsSentences(
  stats: ScopeStats,
  {
    subject,
    releaseDate,
    skipStock,
    skipPreorder,
    skipLanguages,
  }: StatsSentenceOptions,
): string[] {
  if (process.env.CATALOG_DEMO_MODE === '1')
    return [
      `${subject} : catalogue de démonstration. Produits d’exemple non commercialisés, aucun achat possible.`,
    ];
  const count = stats.productCount;
  const range = count ? priceRange(stats.minPrice, stats.maxPrice) : null;
  const first = count
    ? `${subject} : ${count} produit${count > 1 ? 's' : ''}${range ? ` ${range}` : ''}.`
    : `${subject} : aucun produit disponible pour le moment.`;
  const availability = [
    !skipStock && stats.inStockCount > 0 && `${stats.inStockCount} en stock`,
    preordersEnabled() &&
      !skipPreorder &&
      stats.preorderCount > 0 &&
      `${stats.preorderCount} en précommande`,
  ].filter((part): part is string => Boolean(part));
  return [
    first,
    releaseDate ? `Sortie : ${formatDateFr(releaseDate)}.` : null,
    availability.length ? `${capitalize(availability.join(', '))}.` : null,
    skipLanguages ? null : languagesSentence(stats.languages),
  ].filter((sentence): sentence is string => Boolean(sentence));
}

// ---------------------------------------------------------------------------
// Landings: game hub and facets

function landingSubject(scope: LandingScope, kind: LandingKind): string {
  const game = scope.game.name;
  const set = scope.set?.name;
  const category = scope.category?.name;
  const language = scope.language ? LANGUAGE_IN_LABELS[scope.language] : null;
  // « Boosters Pokémon en stock », « Précommandes boosters Pokémon ».
  const statusLead = (...parts: (string | undefined)[]) => {
    if (scope.status === 'en-stock')
      return `${phrase(category, ...parts)} en stock`;
    return `${STATUS_LABELS[scope.status ?? 'nouveautes']} ${phrase(
      category && inSentence(category),
      ...parts,
    )}`;
  };
  switch (kind) {
    case 'game':
      return game;
    case 'set':
      return containsAll(set ?? '', game) ? (set ?? game) : `${set} (${game})`;
    case 'category':
      return phrase(category, game);
    case 'language':
      return `${game} ${language}`;
    case 'status':
      return statusLead(game);
    case 'set-category':
      return phrase(category, game, set);
    case 'set-language':
      return `${phrase(game, set)} ${language}`;
    case 'set-status':
      return statusLead(game, set);
    case 'category-language':
      return `${phrase(category, game)} ${language}`;
    case 'category-status':
      return statusLead(game);
  }
}

function landingTitle(
  scope: LandingScope,
  kind: LandingKind,
  subject: string,
  stats: ScopeStats,
  families: readonly string[],
): string {
  const names = families.map(inSentence);
  // « stock » only when something is actually in stock.
  const priceAnd =
    stats.inStockCount > 0 ? 'prix et stock' : 'prix et disponibilité';
  switch (kind) {
    case 'game':
      // No « en stock » here: every family listed is not necessarily in stock.
      return firstFitting(
        fitList((list) => `${subject} : ${list}`, names),
        stats.productCount ? `${subject} : prix et disponibilité` : null,
        subject,
      );
    case 'set':
      if (!stats.productCount)
        return firstFitting(
          scope.set?.releaseDate
            ? `${subject} : sortie le ${formatDateFr(scope.set.releaseDate)}`
            : null,
          subject,
        );
      return firstFitting(
        fitList((list) => `${subject} : ${list} – ${priceAnd}`, names),
        `${subject} – ${priceAnd}`,
        subject,
      );
    case 'category':
      return firstFitting(`${subject} : prix et disponibilité`, subject);
    case 'set-category':
      return firstFitting(`${subject} – ${priceAnd}`, subject);
    case 'language':
    case 'status':
      return firstFitting(
        fitList((list) => `${subject} : ${list}`, names),
        subject,
      );
    default:
      return subject;
  }
}

/**
 * Title and description of a /{game}[/{facet}[/{facet}]] landing.
 * `availableCategoryNames`: families actually present in the scope, most
 * relevant first.
 */
export function landingMetadataText(
  scope: LandingScope,
  kind: LandingKind,
  stats: ScopeStats,
  availableCategoryNames: readonly string[] = [],
  overrides?: SeoOverrides | null,
): MetadataText {
  const subject = landingSubject(scope, kind);
  const title = landingTitle(
    scope,
    kind,
    subject,
    stats,
    availableCategoryNames,
  );
  const description = joinSentences(
    statsSentences(stats, {
      subject: capitalize(subject),
      releaseDate: kind === 'set' ? scope.set?.releaseDate : null,
      skipStock: scope.status === 'en-stock',
      skipPreorder: scope.status === 'precommandes',
      skipLanguages: Boolean(scope.language),
    }),
  );
  return withOverrides({ title: capitalize(title), description }, overrides);
}

export interface GameMetadataInput {
  game: LandingScope['game'];
  stats: ScopeStats;
  availableCategoryNames?: readonly string[];
  overrides?: SeoOverrides | null;
}

export function gameMetadataText({
  game,
  stats,
  availableCategoryNames = [],
  overrides,
}: GameMetadataInput): MetadataText {
  return landingMetadataText(
    { game },
    'game',
    stats,
    availableCategoryNames,
    overrides,
  );
}

// ---------------------------------------------------------------------------
// Transversal pages

export interface CategoryHubTextInput {
  name: string;
  stats: ScopeStats;
  /** Games with products in this family, most relevant first. */
  gameNames?: readonly string[];
  overrides?: SeoOverrides | null;
}

export function categoryHubText({
  name,
  stats,
  gameNames = [],
  overrides,
}: CategoryHubTextInput): MetadataText {
  const title = firstFitting(
    gameNames.length > 1
      ? fitList((list) => `${name} ${list}`, gameNames)
      : null,
    gameNames.length === 1
      ? `${phrase(name, gameNames[0])} : prix et disponibilité`
      : null,
    stats.productCount ? `${name} : prix et disponibilité` : null,
    name,
  );
  const description = joinSentences(statsSentences(stats, { subject: name }));
  return withOverrides({ title, description }, overrides);
}

export type ListingKind =
  'catalogue' | 'nouveautes' | 'precommandes' | 'en-stock';

export interface ListingTextInput {
  listing: ListingKind;
  stats: ScopeStats;
  gameNames?: readonly string[];
  availableCategoryNames?: readonly string[];
  overrides?: SeoOverrides | null;
}

const LISTING_LABELS: Record<Exclude<ListingKind, 'en-stock'>, string> = {
  catalogue: 'Catalogue',
  nouveautes: 'Nouveautés',
  precommandes: 'Précommandes',
};

export function listingText({
  listing,
  stats,
  gameNames = [],
  availableCategoryNames = [],
  overrides,
}: ListingTextInput): MetadataText {
  const games = listFr(gameNames.slice(0, 2));
  const subject =
    listing === 'en-stock'
      ? games
        ? `${games} en stock`
        : 'Produits en stock'
      : phrase(LISTING_LABELS[listing], games);
  const title = firstFitting(
    fitList(
      (list) => `${subject} : ${list}`,
      availableCategoryNames.map(inSentence),
    ),
    subject,
  );
  const description = joinSentences(
    statsSentences(stats, {
      subject,
      skipStock: listing === 'en-stock',
      skipPreorder: listing === 'precommandes',
    }),
  );
  return withOverrides({ title, description }, overrides);
}

/** Distinct titles and descriptions for ?page=N. */
export function paginatedText(text: MetadataText, page: number): MetadataText {
  if (!Number.isSafeInteger(page) || page < 2) return text;
  return {
    title: `${text.title} – page ${page}`,
    description: truncateAtWord(`Page ${page} – ${text.description}`),
  };
}

// ---------------------------------------------------------------------------
// Product

export interface ProductMetadataInput {
  name: string;
  categoryName?: string | null;
  setName?: string | null;
  gameName?: string | null;
  /** Languages of the active variants. */
  languages: readonly LanguageCode[];
  /** Lowest active variant price, decimal string. */
  price: string | null;
  /** Active variants have different prices. */
  priceFrom?: boolean;
  availability: Availability;
  preorder: boolean;
  releaseDate?: Date | null;
  overrides?: SeoOverrides | null;
}

const LANGUAGE_TOKENS: Record<FacetLanguage, string[]> = {
  FR: ['francai', 'fr', 'vf'],
  EN: ['anglai', 'eng'],
  JP: ['japonai', 'jp', 'jap'],
  DE: ['allemand'],
  ES: ['espagnol'],
  IT: ['italien'],
};

export function productMetadataText({
  name,
  categoryName,
  setName,
  gameName,
  languages,
  price,
  priceFrom = false,
  availability,
  preorder,
  releaseDate,
  overrides,
}: ProductMetadataInput): MetadataText {
  const cleanName = collapse(name);
  const nameWords = wordsOf(cleanName);
  const productLanguages = facetLanguages(languages);
  const language =
    productLanguages.length === 1 &&
    productLanguages[0] &&
    !LANGUAGE_TOKENS[productLanguages[0]].some((token) => nameWords.has(token))
      ? LANGUAGE_LABELS[productLanguages[0]]
      : null;

  // Qualifiers that repeat no word of the name nor of a previous qualifier.
  const qualifiers: { key: 'category' | 'game' | 'set'; text: string }[] = [];
  let seen = cleanName;
  for (const [key, value] of [
    ['category', categoryName],
    ['game', gameName],
    ['set', setName],
  ] as const) {
    const text = collapse(value ?? '');
    if (!text || sharesWord(seen, text)) continue;
    qualifiers.push({ key, text });
    seen = `${seen} ${text}`;
  }

  const compose = (keys: ReadonlySet<string>, withLanguage: boolean) => {
    const tail = qualifiers.filter((q) => keys.has(q.key)).map((q) => q.text);
    return `${cleanName}${tail.length ? ` – ${tail.join(' ')}` : ''}${
      withLanguage && language ? ` (${language})` : ''
    }`;
  };
  const title = firstFitting(
    compose(new Set(['category', 'game', 'set']), true),
    compose(new Set(['category', 'game']), true),
    compose(new Set(['game']), true),
    compose(new Set(), true),
    cleanName,
  );

  const descriptor = [
    phrase(
      qualifiers.find((q) => q.key === 'category')?.text,
      qualifiers.find((q) => q.key === 'game')?.text,
    ),
    qualifiers.some((q) => q.key === 'set')
      ? `extension ${qualifiers.find((q) => q.key === 'set')?.text}`
      : '',
  ]
    .filter(Boolean)
    .join(', ');
  const isPreorder =
    availability === 'PREORDER' ||
    (preorder && availability !== 'OUT_OF_STOCK');
  const availabilitySentence = isPreorder
    ? `En précommande${releaseDate ? `, sortie le ${formatDateFr(releaseDate)}` : ''}.`
    : availability === 'IN_STOCK' || availability === 'LOW_STOCK'
      ? 'En stock.'
      : null;
  const description = joinSentences(
    [
      `${cleanName}${descriptor ? ` (${descriptor})` : ''}${
        price ? ` ${priceFrom ? 'dès' : 'à'} ${formatEuro(price)}` : ''
      }.`,
      availabilitySentence,
      languagesSentence(languages),
    ].filter((sentence): sentence is string => Boolean(sentence)),
  );
  return withOverrides({ title, description }, overrides);
}
