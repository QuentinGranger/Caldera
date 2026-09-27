// Editorial and static pages: titles, indexation and grouping. Pure.
import type { Metadata } from 'next';
import type { ContentEntry, ContentKind } from '@/lib/content/types';
import type { IndexReason } from '@/lib/seo/indexation';
import {
  DESCRIPTION_MAX,
  TITLE_MAX,
  buildMetadata,
  listFr,
  truncateAtWord,
  type MetadataImage,
} from '@/lib/seo/metadata';
import type { IndexDecision } from '@/lib/seo/types';

export const GUIDES_PATH = '/guides';
export const GLOSSARY_PATH = '/glossaire';

export const KIND_LABELS: Readonly<Record<ContentKind, string>> = {
  guide: 'Guide',
  comparatif: 'Comparatif',
  dossier: 'Dossier',
  glossaire: 'Glossaire',
  question: 'Question',
  actualite: 'Actualité',
};

const KIND_NOUNS: Readonly<Record<ContentKind, [string, string]>> = {
  guide: ['guide', 'guides'],
  comparatif: ['comparatif', 'comparatifs'],
  dossier: ['dossier', 'dossiers'],
  glossaire: ['terme', 'termes'],
  question: ['question', 'questions'],
  actualite: ['actualité', 'actualités'],
};

/** Order of the groups on /guides. */
export const GUIDE_KINDS = ['comparatif', 'guide', 'dossier'] as const;
export type GuideKind = (typeof GUIDE_KINDS)[number];

export const isGuideKind = (kind: ContentKind): kind is GuideKind =>
  (GUIDE_KINDS as readonly ContentKind[]).includes(kind);

/** « 1 guide », « 2 comparatifs » */
export function kindCount(kind: ContentKind, count: number): string {
  const [one, many] = KIND_NOUNS[kind];
  return `${count} ${count > 1 ? many : one}`;
}

// ---------------------------------------------------------------------------
// Indexation and metadata

/** An editorial or static page is indexable while it has something to show. */
export function editorialDecision(
  path: string,
  hasContent = true,
): IndexDecision {
  const reason: IndexReason = hasContent ? 'indexable' : 'empty';
  return { index: hasContent, reason, canonicalPath: path };
}

export interface EditorialMetadataInput {
  /** Without the brand: the layout template adds « | Caldera ». */
  title: string;
  description: string;
  decision: IndexDecision;
  image?: MetadataImage | null;
  type?: 'website' | 'article';
}

export function editorialMetadata({
  title,
  description,
  decision,
  image,
  type,
}: EditorialMetadataInput): Metadata {
  return buildMetadata({
    title: shortTitle(title),
    description: truncateAtWord(description),
    path: decision.canonicalPath,
    index: decision.index,
    image,
    type,
  });
}

// Clause boundaries a long title can be cut at without an ellipsis; « et »
// ends an enumeration (« protège-cartes, toploaders et classeurs »).
const CLAUSE_END = /\s[:–—]\s|,\s|\set\s/g;

/**
 * The title when it fits TITLE_MAX, else its longest leading clause that fits
 * and still says enough (half the limit), else a cut at a word.
 */
export function shortTitle(title: string, max = TITLE_MAX): string {
  const clean = title.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  let best = '';
  for (const match of clean.matchAll(CLAUSE_END)) {
    const head = clean.slice(0, match.index).trim();
    if (head.length <= max && head.length > best.length) best = head;
  }
  return best.length >= max / 2 ? best : truncateAtWord(clean, max);
}

/** First title of the list that fits TITLE_MAX, the last one otherwise. */
export function fittingTitle(...candidates: string[]): string {
  return (
    candidates.find((title) => title.length <= TITLE_MAX) ??
    shortTitle(candidates.at(-1) ?? '')
  );
}

/**
 * Independent sentences in order, each kept when it still fits; the first one
 * is cut at a word when none fits.
 */
export function fitSentences(
  sentences: readonly (string | null | false | undefined)[],
  max = DESCRIPTION_MAX,
): string {
  const list = sentences.filter(
    (sentence): sentence is string =>
      typeof sentence === 'string' && sentence.trim() !== '',
  );
  let result = '';
  for (const sentence of list) {
    const next = result ? `${result} ${sentence.trim()}` : sentence.trim();
    if (next.length <= max) result = next;
  }
  return result || truncateAtWord(list[0] ?? '', max);
}

/** « prefix a, b, c. » with as many items as fit, « … » when some are left out. */
export function fitList(
  prefix: string,
  items: readonly string[],
  max = DESCRIPTION_MAX,
): string {
  for (let count = items.length; count > 0; count--) {
    const text = `${prefix}${items.slice(0, count).join(', ')}${
      count < items.length ? ', …' : '.'
    }`;
    if (text.length <= max) return text;
  }
  return truncateAtWord(prefix.replace(/\s*:\s*$/, '.'), max);
}

/** « Là où… » → « là où… » inside a sentence. */
export const lowerFirst = (text: string) =>
  text.charAt(0).toLocaleLowerCase('fr-FR') + text.slice(1);

export const upperFirst = (text: string) =>
  text.charAt(0).toLocaleUpperCase('fr-FR') + text.slice(1);

/** `base`, or `base-2`, `base-3`… when a heading of the body already uses it. */
export function freeAnchor(
  base: string,
  headings: readonly { id: string }[],
): string {
  const taken = new Set(headings.map((heading) => heading.id));
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  return id;
}

export const isoDay = (date: Date | string) =>
  (typeof date === 'string' ? new Date(date) : date).toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Content lists

export interface KindGroup {
  kind: GuideKind;
  label: string;
  entries: ContentEntry[];
}

const titleOrder = new Intl.Collator('fr', { sensitivity: 'base' });

/** Most recent first, then by title; never sorts the (frozen) input. */
export function byUpdated(entries: readonly ContentEntry[]): ContentEntry[] {
  return [...entries].sort(
    (a, b) =>
      b.updated.getTime() - a.updated.getTime() ||
      titleOrder.compare(a.title, b.title),
  );
}

const GROUP_LABELS: Readonly<Record<GuideKind, string>> = {
  comparatif: 'Comparatifs',
  guide: 'Guides',
  dossier: 'Dossiers',
};

/** Guides, comparisons and files, each most recent first; empty kinds dropped. */
export function groupGuides(entries: readonly ContentEntry[]): KindGroup[] {
  return GUIDE_KINDS.flatMap((kind) => {
    const list = byUpdated(entries.filter((entry) => entry.kind === kind));
    return list.length
      ? [{ kind, label: GROUP_LABELS[kind], entries: list }]
      : [];
  });
}

/** Reading order of the kinds in a sentence or a title. */
export const GUIDE_KINDS_IN_TEXT: readonly GuideKind[] = [
  'guide',
  'comparatif',
  'dossier',
];

/** « 5 guides, 2 comparatifs et 1 dossier » */
export function guideCountsLabel(groups: readonly KindGroup[]): string {
  return listFr(
    GUIDE_KINDS_IN_TEXT.flatMap((kind) => {
      const count = groups.find((group) => group.kind === kind)?.entries.length;
      return count ? [kindCount(kind, count)] : [];
    }),
  );
}

/** Latest `updated` of a list, or null when it is empty. */
export function latestUpdate(entries: readonly ContentEntry[]): Date | null {
  return entries.reduce<Date | null>(
    (latest, entry) =>
      !latest || entry.updated > latest ? entry.updated : latest,
    null,
  );
}

/** Index letter of a glossary title: « État… » → « E », digits → « # ». */
export function glossaryLetter(title: string): string {
  const first = title
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .charAt(0)
    .toLocaleUpperCase('fr-FR');
  return /^[A-Z]$/.test(first) ? first : '#';
}

export interface LetterGroup {
  letter: string;
  /** Anchor of the letter section. */
  id: string;
  entries: ContentEntry[];
}

/** A–Z sections of the glossary, terms by title inside each letter. */
export function groupByLetter(entries: readonly ContentEntry[]): LetterGroup[] {
  const groups = new Map<string, ContentEntry[]>();
  const sorted = [...entries].sort(
    (a, b) =>
      titleOrder.compare(a.title, b.title) || a.slug.localeCompare(b.slug),
  );
  for (const entry of sorted) {
    const letter = glossaryLetter(entry.title);
    groups.set(letter, [...(groups.get(letter) ?? []), entry]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b)))
    .map(([letter, list]) => ({
      letter,
      id: letter === '#' ? 'lettre-autres' : `lettre-${letter.toLowerCase()}`,
      entries: list,
    }));
}

/**
 * First paragraph of a rendered body and the rest: the glossary shows the
 * definition apart without repeating it. Inline HTML (links) is kept.
 */
export function splitLead(html: string): { lead: string | null; rest: string } {
  const match = /^\s*<p>([\s\S]*?)<\/p>\n?/.exec(html);
  if (!match) return { lead: null, rest: html };
  return { lead: match[1] ?? '', rest: html.slice(match[0].length) };
}
