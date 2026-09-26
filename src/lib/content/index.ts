// Editorial content: content/guides/*.md and content/glossaire/*.md
// (docs/seo-architecture.md §9). Read from disk once per server instance.
import 'server-only';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { cache } from 'react';
import type { ProductType } from '@/generated/prisma/client';
import {
  GLOSSARY_SLUG_BY_PRODUCT_TYPE,
  buildContentLibrary,
  selectForScope,
  selectRelated,
  type ContentLibrary,
} from './library';
import { CONTENT_SECTIONS, ContentError, parseContentFile } from './parse';
import type {
  ContentEntry,
  ContentPage,
  ContentScope,
  ContentSection,
} from './types';

export type {
  ContentEntry,
  ContentHeading,
  ContentKind,
  ContentPage,
  ContentScope,
  ContentSection,
} from './types';
export { ContentError, contentHref, contentSection } from './parse';
export { renderMarkdown, type MarkdownOptions } from './markdown';

// Resolved from the project root; outputFileTracingIncludes must ship
// content/**/*.md with the server functions that read it.
const CONTENT_ROOT = path.join(process.cwd(), 'content');

async function readSection(section: ContentSection) {
  const directory = path.join(CONTENT_ROOT, section);
  let files: string[];
  try {
    files = await readdir(directory);
  } catch (error) {
    throw new ContentError(
      `Dossier content/${section} illisible depuis ${process.cwd()} (${error instanceof Error ? error.message : String(error)})`,
    );
  }
  return Promise.all(
    files
      .filter((file) => file.endsWith('.md'))
      .sort()
      .map(async (file) =>
        parseContentFile({
          section,
          slug: file.slice(0, -'.md'.length),
          source: await readFile(path.join(directory, file), 'utf8'),
        }),
      ),
  );
}

async function readLibrary(): Promise<ContentLibrary> {
  const sections = await Promise.all(CONTENT_SECTIONS.map(readSection));
  return buildContentLibrary(sections.flat());
}

let loaded: Promise<ContentLibrary> | undefined;
/** Once per server instance; on every request in development to see edits. */
const getLibrary = cache((): Promise<ContentLibrary> => {
  if (process.env.NODE_ENV === 'development') return readLibrary();
  loaded ??= readLibrary().catch((error: unknown) => {
    loaded = undefined;
    throw error;
  });
  return loaded;
});

/** Every guide and glossary term, sorted by title. */
export const getAllContent = cache(async (): Promise<ContentEntry[]> => [
  ...(await getLibrary()).entries,
]);

/** A page of /guides or /glossaire with its HTML and table of contents. */
export const getContentEntry = cache(
  async (section: ContentSection, slug: string): Promise<ContentPage | null> =>
    (await getLibrary()).pages.get(`/${section}/${slug}`) ?? null,
);

/**
 * Content for a game, family or set page: guides first, then glossary terms,
 * each by facet overlap. An entry without games fits every game.
 */
export async function getContentForScope(
  scope: ContentScope,
  limit = 6,
): Promise<ContentEntry[]> {
  return selectForScope((await getLibrary()).entries, scope, limit);
}

/** Glossary term of a product type (ETB → /glossaire/etb), if any. */
export async function getGlossaryTermForProductType(
  type: ProductType,
): Promise<ContentEntry | null> {
  const slug = GLOSSARY_SLUG_BY_PRODUCT_TYPE[type];
  const entry = slug ? (await getLibrary()).bySlug.get(slug) : undefined;
  return entry?.kind === 'glossaire' ? entry : null;
}

/** The entry's `related` list, completed with entries of the same cluster. */
export async function getRelatedContent(
  entry: ContentEntry,
  limit = 6,
): Promise<ContentEntry[]> {
  return selectRelated(await getLibrary(), entry, limit);
}
