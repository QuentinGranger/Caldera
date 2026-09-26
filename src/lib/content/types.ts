// Editorial content contract (docs/seo-architecture.md §9). Pure types.
import type { FaqEntry } from '@/lib/seo/types';

export type ContentKind = 'guide' | 'comparatif' | 'dossier' | 'glossaire';
/** Folder under content/ and first URL segment. */
export type ContentSection = 'guides' | 'glossaire';

export interface ContentEntry {
  slug: string;
  kind: ContentKind;
  title: string;
  /** Meta description. */
  description: string;
  updated: Date;
  /** Game slugs; empty = every game. */
  games: string[];
  /** Category slugs. */
  categories: string[];
  /** TcgSet slugs. */
  sets: string[];
  /** Slugs of other entries (guides or glossary terms) of the same cluster. */
  related: string[];
  faq: FaqEntry[];
  /** /guides/{slug} or /glossaire/{slug}. */
  href: string;
  /** Glossary terms only: plain text of the first paragraph. */
  definition?: string;
  /** Words of the Markdown body (front-matter and FAQ excluded). */
  wordCount: number;
}

export interface ContentHeading {
  /** Stable anchor, slug of the heading text. */
  id: string;
  text: string;
  level: 2 | 3;
}

export interface ContentPage extends ContentEntry {
  /** Safe HTML of the body; the page title (h1) comes from `title`. */
  html: string;
  /** h2 and h3, in document order, for a table of contents. */
  headings: ContentHeading[];
}

export interface ContentScope {
  game?: string;
  category?: string;
  set?: string;
}
