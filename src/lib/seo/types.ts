// Shared SEO contract (see docs/seo-architecture.md). Pure types: safe on server and client.

export type LanguageCode = 'FR' | 'EN' | 'JP' | 'DE' | 'ES' | 'IT' | 'OTHER';

/** Availability facet slugs, usable under a game: /pokemon/precommandes. */
export type StatusSlug = 'en-stock' | 'precommandes' | 'nouveautes';

export interface GameRef {
  id: string;
  slug: string;
  name: string;
}

export interface SetRef {
  id: string;
  slug: string;
  name: string;
  code: string | null;
  series: string | null;
  releaseDate: Date | null;
  gameId: string | null;
}

export interface CategoryRef {
  id: string;
  slug: string;
  name: string;
  parentId: string | null;
}

/** A silo landing: a game plus at most two facets, in canonical order. */
export interface LandingScope {
  game: GameRef;
  set?: SetRef;
  /** Includes the category's descendants. */
  category?: CategoryRef;
  language?: Exclude<LanguageCode, 'OTHER'>;
  status?: StatusSlug;
}

export type LandingKind =
  | 'game'
  | 'set'
  | 'category'
  | 'language'
  | 'status'
  | 'set-category'
  | 'set-language'
  | 'set-status'
  | 'category-language'
  | 'category-status';

/** Aggregates over visible products (published, active parents, ≥ 1 active variant). */
export interface ScopeStats {
  productCount: number;
  inStockCount: number;
  preorderCount: number;
  newArrivalCount: number;
  /** Decimal strings from active variants, e.g. "54.90". */
  minPrice: string | null;
  maxPrice: string | null;
  /** Languages with at least one active variant in scope. */
  languages: LanguageCode[];
  /** Latest real modification among products/variants in scope. */
  lastModified: Date | null;
}

export interface IndexDecision {
  index: boolean;
  /** Short machine-readable reason, e.g. "below-threshold", "duplicate-of-parent". */
  reason: string;
  /** Path (no origin) to put in the canonical tag; self path when indexable. */
  canonicalPath: string;
}

export interface SeoLink {
  href: string;
  label: string;
  /** Optional count shown next to the link (real product count). */
  count?: number;
}

export interface SeoLinkGroup {
  title: string;
  links: SeoLink[];
}

export interface FaqEntry {
  question: string;
  answer: string;
}
