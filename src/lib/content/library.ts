// Cross-file checks and selections over the parsed content. Pure.
import type { ProductType } from '@/generated/prisma/client';
import {
  ContentError,
  contentHref,
  contentSection,
  type ParsedContent,
} from './parse';
import type {
  ContentEntry,
  ContentPage,
  ContentScope,
  ContentSection,
} from './types';

export interface ContentLibrary {
  /** Sorted by title. */
  entries: readonly ContentEntry[];
  bySlug: ReadonlyMap<string, ContentEntry>;
  /** Keyed by href (/guides/{slug}, /glossaire/{slug}). */
  pages: ReadonlyMap<string, ContentPage>;
}

const titleOrder = new Intl.Collator('fr', { sensitivity: 'base' });
const INTERNAL_CONTENT_LINK =
  /^\/(guides|glossaire|questions|actualites)\/([^/?#]+)/;

// Entries are shared by every request: freezing keeps a caller from
// corrupting the cache.
function freeze<T extends ContentEntry>(entry: T): Readonly<T> {
  for (const value of Object.values(entry)) {
    if (!Array.isArray(value)) continue;
    for (const item of value) Object.freeze(item);
    Object.freeze(value);
  }
  return Object.freeze(entry);
}

/** Checks slugs, related entries and body links across files. */
export function buildContentLibrary(
  parsed: readonly ParsedContent[],
): ContentLibrary {
  const pages = new Map<string, ContentPage>();
  const bySlug = new Map<string, ContentEntry>();
  for (const { page } of parsed) {
    const other = bySlug.get(page.slug);
    if (other)
      throw new ContentError(
        `Slug « ${page.slug} » utilisé deux fois (${other.href} et ${page.href}) : « related » serait ambigu`,
      );
    const { html, headings, ...entry } = page;
    freeze(entry);
    bySlug.set(page.slug, entry);
    pages.set(page.href, freeze({ ...entry, html, headings }));
  }
  for (const { page, links } of parsed) {
    const issues = [
      ...page.related
        .filter((slug) => !bySlug.has(slug))
        .map((slug) => `« related » : ${slug} n’existe pas`),
      ...links.flatMap((href) => {
        const match = INTERNAL_CONTENT_LINK.exec(href);
        if (!match) return [];
        const [, section = '', slug = ''] = match;
        return pages.has(contentHref(section as ContentSection, slug))
          ? []
          : [`lien cassé : ${href}`];
      }),
    ];
    if (issues.length)
      throw new ContentError(
        `content${page.href}.md : ${[...new Set(issues)].join(' ; ')}`,
      );
  }
  return {
    entries: Object.freeze(
      [...bySlug.values()].sort(
        (a, b) =>
          titleOrder.compare(a.title, b.title) || a.slug.localeCompare(b.slug),
      ),
    ),
    bySlug,
    pages,
  };
}

// ---------------------------------------------------------------------------
// Selections

// Reading value of a section next to products: guides first, news last.
const SECTION_WEIGHT: Readonly<Record<ContentSection, number>> = {
  guides: 3,
  questions: 2,
  glossaire: 1,
  actualites: 0,
};
const weight = (entry: ContentEntry) =>
  SECTION_WEIGHT[contentSection(entry.kind)];

/** Guides, questions, terms then news; then relevance, freshness and title. */
function rank(
  entries: readonly { entry: ContentEntry; score: number }[],
): ContentEntry[] {
  return [...entries]
    .sort(
      (a, b) =>
        weight(b.entry) - weight(a.entry) ||
        b.score - a.score ||
        b.entry.updated.getTime() - a.entry.updated.getTime() ||
        titleOrder.compare(a.entry.title, b.entry.title),
    )
    .map(({ entry }) => entry);
}

/**
 * Relevance of an entry for a page scope, or null when it does not fit: each
 * facet of the scope must be listed by the entry or left empty there (no
 * game = every game). Exact facets weigh more the narrower they are.
 */
export function scopeScore(
  entry: ContentEntry,
  scope: ContentScope,
): number | null {
  let score = 0;
  const facets = [
    [scope.set, entry.sets, 8],
    [scope.category, entry.categories, 4],
    [scope.game, entry.games, 2],
  ] as const;
  for (const [wanted, listed, weight] of facets) {
    if (!wanted) continue;
    if (listed.includes(wanted)) score += weight;
    else if (listed.length) return null;
  }
  return score;
}

export function selectForScope(
  entries: readonly ContentEntry[],
  scope: ContentScope,
  limit: number,
): ContentEntry[] {
  if (limit <= 0) return [];
  return rank(
    entries.flatMap((entry) => {
      const score = scopeScore(entry, scope);
      return score === null ? [] : [{ entry, score }];
    }),
  ).slice(0, limit);
}

const shared = (a: readonly string[], b: readonly string[]) =>
  a.filter((value) => b.includes(value)).length;

/** Explicit `related` first, then entries sharing a set or a family. */
export function selectRelated(
  library: Pick<ContentLibrary, 'entries' | 'bySlug'>,
  entry: ContentEntry,
  limit: number,
): ContentEntry[] {
  if (limit <= 0) return [];
  const explicit = entry.related.flatMap((slug) => {
    const related = library.bySlug.get(slug);
    return related && related.slug !== entry.slug ? [related] : [];
  });
  const taken = new Set([entry.slug, ...explicit.map((e) => e.slug)]);
  const cluster = library.entries.flatMap((other) => {
    if (taken.has(other.slug)) return [];
    const sameGame =
      !entry.games.length ||
      !other.games.length ||
      shared(entry.games, other.games) > 0;
    const score =
      shared(entry.sets, other.sets) * 4 +
      shared(entry.categories, other.categories) * 2;
    return sameGame && score > 0 ? [{ entry: other, score }] : [];
  });
  return [...explicit, ...rank(cluster)].slice(0, limit);
}

/** Glossary term describing each product type; none for generic types. */
export const GLOSSARY_SLUG_BY_PRODUCT_TYPE: Readonly<
  Record<ProductType, string | null>
> = {
  BOOSTER: 'booster',
  BLISTER: 'blister',
  TRIPACK: 'tripack',
  BUNDLE: 'bundle',
  DISPLAY: 'display',
  ETB: 'etb',
  COLLECTION_BOX: 'coffret',
  TIN: 'tin',
  DECK: 'deck',
  ACCESSORY: null,
  SINGLE_CARD: 'carte-a-l-unite',
  OTHER: null,
};
