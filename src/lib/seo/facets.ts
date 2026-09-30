// Facet vocabulary and URL grammar of the game silos (docs/seo-architecture.md §3).
// Pure module: no database access, safe on server and client.
import type {
  CategoryRef,
  LandingKind,
  LandingScope,
  LanguageCode,
  SetRef,
  StatusSlug,
} from './types';

export type FacetLanguage = Exclude<LanguageCode, 'OTHER'>;
export type FacetDimension = 'set' | 'category' | 'language' | 'status';

/** Canonical order of the facets in a landing URL. */
export const FACET_ORDER: readonly FacetDimension[] = [
  'set',
  'category',
  'language',
  'status',
];

export const LANGUAGE_SLUGS: Readonly<Record<FacetLanguage, string>> = {
  FR: 'francais',
  EN: 'anglais',
  JP: 'japonais',
  DE: 'allemand',
  ES: 'espagnol',
  IT: 'italien',
};

export const LANGUAGE_BY_SLUG: ReadonlyMap<string, FacetLanguage> = new Map(
  (Object.entries(LANGUAGE_SLUGS) as [FacetLanguage, string][]).map(
    ([code, slug]) => [slug, code],
  ),
);

/** Lower-case language names, used inside sentences: « Boosters en japonais ». */
export const LANGUAGE_LABELS: Readonly<Record<FacetLanguage, string>> = {
  FR: 'français',
  EN: 'anglais',
  JP: 'japonais',
  DE: 'allemand',
  ES: 'espagnol',
  IT: 'italien',
};

/** « en japonais » */
export const LANGUAGE_IN_LABELS: Readonly<Record<FacetLanguage, string>> = {
  FR: 'en français',
  EN: 'en anglais',
  JP: 'en japonais',
  DE: 'en allemand',
  ES: 'en espagnol',
  IT: 'en italien',
};

export const STATUS_SLUGS: readonly StatusSlug[] = [
  'en-stock',
  'precommandes',
  'nouveautes',
];

export const STATUS_LABELS: Readonly<Record<StatusSlug, string>> = {
  'en-stock': 'En stock',
  precommandes: 'Précommandes',
  nouveautes: 'Nouveautés',
};

/**
 * First path segments that a game slug can never take: every root segment of
 * src/app, the planned SEO routes and the technical paths served by Next.js,
 * Vercel or public/.
 */
export const RESERVED_ROOT_SLUGS: ReadonlySet<string> = new Set([
  // src/app
  'admin',
  'alertes',
  'api',
  'catalogue',
  'categorie',
  'cgv',
  'checkout',
  'commande',
  'compte',
  'confidentialite',
  'contact',
  'extensions',
  'fonts',
  'media',
  'mentions-legales',
  'nouveautes',
  'panier',
  'precommandes',
  'produit',
  'univers',
  'icon.png',
  'robots.txt',
  'sitemap.xml',
  // SEO routes (docs/seo-architecture.md §3 and §8)
  'en-stock',
  'guides',
  'glossaire',
  'calendrier-des-sorties',
  'livraison',
  'sitemaps',
  'questions',
  'actualites',
  // Framework, hosting and public/ files
  '_next',
  '_vercel',
  '.well-known',
  'assets',
  'favicon.ico',
  'apple-icon.png',
  'manifest.webmanifest',
  'opengraph-image',
  'twitter-image',
]);

const normalizeSlug = (slug: string) => slug.trim().toLowerCase();

export function isLanguageSlug(slug: string): boolean {
  return LANGUAGE_BY_SLUG.has(slug);
}

export function isStatusSlug(slug: string): slug is StatusSlug {
  return (STATUS_SLUGS as readonly string[]).includes(slug);
}

/** A set or category slug must not collide with a language or status facet. */
export function isReservedFacetSlug(slug: string): boolean {
  const value = normalizeSlug(slug);
  return isLanguageSlug(value) || isStatusSlug(value);
}

/** A game slug must not take a reserved root segment. */
export function isReservedRootSlug(slug: string): boolean {
  return RESERVED_ROOT_SLUGS.has(normalizeSlug(slug));
}

const ALLOWED_KINDS: ReadonlySet<string> = new Set<LandingKind>([
  'set',
  'category',
  'language',
  'status',
  'set-category',
  'set-language',
  'set-status',
  'category-language',
  'category-status',
]);

function presentDimensions(scope: Omit<LandingScope, 'game'>) {
  return FACET_ORDER.filter((dimension) => scope[dimension] !== undefined);
}

function kindOf(dimensions: readonly FacetDimension[]): LandingKind | null {
  if (!dimensions.length) return 'game';
  const kind = dimensions.join('-');
  return ALLOWED_KINDS.has(kind) ? (kind as LandingKind) : null;
}

/** Throws on a combination that has no landing (e.g. language + status). */
export function landingKind(scope: LandingScope): LandingKind {
  const kind = kindOf(presentDimensions(scope));
  if (!kind) throw new Error('Unsupported landing facet combination');
  return kind;
}

export function isSupportedScope(scope: LandingScope): boolean {
  return kindOf(presentDimensions(scope)) !== null;
}

function facetSegment(
  scope: Omit<LandingScope, 'game'>,
  dimension: FacetDimension,
): string {
  switch (dimension) {
    case 'set':
      return scope.set?.slug ?? '';
    case 'category':
      return scope.category?.slug ?? '';
    case 'language':
      return scope.language ? LANGUAGE_SLUGS[scope.language] : '';
    case 'status':
      return scope.status ?? '';
  }
}

/** Canonical path of a landing: /{game}/{set}/{category}/{language}/{status}. */
export function landingPath(scope: LandingScope): string {
  landingKind(scope);
  return [
    '',
    scope.game.slug,
    ...presentDimensions(scope).map((dimension) =>
      facetSegment(scope, dimension),
    ),
  ]
    .map(encodeURIComponent)
    .join('/');
}

/**
 * Direct parents (one facet removed). The first entry drops the last facet in
 * canonical order: it is the parent used by the indexation rules (game hub for
 * a single facet, the entity facet for a pair).
 */
export function parentScopes(scope: LandingScope): LandingScope[] {
  const dimensions = presentDimensions(scope);
  if (!dimensions.length) return [];
  const without = (dimension: FacetDimension): LandingScope => {
    const parent: LandingScope = { ...scope };
    delete parent[dimension];
    return parent;
  };
  return [...dimensions].reverse().map(without);
}

export function indexationParent(scope: LandingScope): LandingScope | null {
  return parentScopes(scope)[0] ?? null;
}

export interface LandingLookup {
  /** Sets of the current game, by slug. */
  sets: ReadonlyMap<string, SetRef>;
  categories: ReadonlyMap<string, CategoryRef>;
}

export type LandingFacets = Omit<LandingScope, 'game'>;

export type LandingParseResult =
  | { type: 'ok'; scope: LandingFacets }
  | { type: 'redirect'; segments: string[] }
  | { type: 'not-found' };

type ParsedFacet =
  | { dimension: 'set'; slug: string; value: SetRef }
  | { dimension: 'category'; slug: string; value: CategoryRef }
  | { dimension: 'language'; slug: string; value: FacetLanguage }
  | { dimension: 'status'; slug: string; value: StatusSlug };

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function classify(slug: string, lookup: LandingLookup): ParsedFacet | null {
  const language = LANGUAGE_BY_SLUG.get(slug);
  if (language) return { dimension: 'language', slug, value: language };
  if (isStatusSlug(slug)) return { dimension: 'status', slug, value: slug };
  const set = lookup.sets.get(slug);
  if (set) return { dimension: 'set', slug, value: set };
  const category = lookup.categories.get(slug);
  if (category) return { dimension: 'category', slug, value: category };
  return null;
}

/**
 * Resolves the facet segments after /{game}. Valid facets in a non canonical
 * order ask for a redirect; unknown slugs, duplicate dimensions, more than two
 * facets or a combination without landing are not found.
 */
export function parseLandingSegments(
  segments: readonly string[],
  lookup: LandingLookup,
): LandingParseResult {
  if (segments.length < 1 || segments.length > 2) return { type: 'not-found' };
  const facets: ParsedFacet[] = [];
  for (const segment of segments) {
    const facet = classify(decodeSegment(segment), lookup);
    if (!facet || facets.some((f) => f.dimension === facet.dimension))
      return { type: 'not-found' };
    facets.push(facet);
  }
  const ordered = [...facets].sort(
    (a, b) =>
      FACET_ORDER.indexOf(a.dimension) - FACET_ORDER.indexOf(b.dimension),
  );
  if (!kindOf(ordered.map((facet) => facet.dimension)))
    return { type: 'not-found' };
  if (ordered.some((facet, index) => facet !== facets[index]))
    return { type: 'redirect', segments: ordered.map((facet) => facet.slug) };
  const scope: LandingFacets = {};
  for (const facet of ordered) {
    if (facet.dimension === 'set') scope.set = facet.value;
    else if (facet.dimension === 'category') scope.category = facet.value;
    else if (facet.dimension === 'language') scope.language = facet.value;
    else scope.status = facet.value;
  }
  return { type: 'ok', scope };
}
