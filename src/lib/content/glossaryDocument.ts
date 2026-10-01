// The Pokémon TCG glossary from A to Z: one Markdown document,
// content/pages/glossaire-pokemon.md. Letters are its single-letter h2,
// the other h2 are themed sections, every h3 is a term.
import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { cache } from 'react';
import matter from 'gray-matter';
import { renderDocument } from './markdown';
import type { ContentHeading } from './types';

export interface GlossaryTerm extends ContentHeading {
  /** First paragraph of the definition, as plain text. */
  definition: string;
}

export interface GlossaryDocument {
  title: string;
  description: string;
  updated: Date | null;
  /** Paragraphs before the first letter, as plain text. */
  intro: string[];
  /** Safe HTML of the letters and themes, h2 and h3 with ids. */
  html: string;
  letters: ContentHeading[];
  themes: ContentHeading[];
  /** Terms of the A to Z (not those repeated in the themed sections). */
  terms: GlossaryTerm[];
  /** Rendered href of every link, for checks. */
  links: string[];
  /** Links, images and raw HTML that were not rendered as such. */
  rejected: string[];
  signature: string | null;
  closing: string | null;
}

// gray-matter would eval a ---js front-matter.
function yamlOnly(): never {
  throw new Error('seul le front-matter YAML (---) est accepté');
}

const text = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

/** Pure part of getGlossaryDocument, for tests. */
export function parseGlossaryDocument(source: string): GlossaryDocument {
  const { data, content } = matter(source, {
    engines: { javascript: yamlOnly, json: yamlOnly },
  });
  const start = content.search(/^## /m);
  const introSource = start < 0 ? content : content.slice(0, start);
  const bodySource = start < 0 ? '' : content.slice(start);
  const rendered = renderDocument(bodySource);
  const h2 = rendered.headings.filter((heading) => heading.level === 2);
  const letters = h2.filter((heading) => /^\p{Lu}$/u.test(heading.text));
  const themes = h2.filter((heading) => !letters.includes(heading));

  // The first paragraph under each h3, in document order.
  const definitions: string[] = [];
  let inThemes = false;
  const lines = bodySource.split('\n');
  lines.forEach((line, index) => {
    if (line.startsWith('## '))
      inThemes = !/^\p{Lu}$/u.test(line.slice(3).trim());
    if (!line.startsWith('### ') || inThemes) return;
    const next = lines
      .slice(index + 1)
      .find((candidate) => candidate.trim() && !candidate.startsWith('#'));
    definitions.push(next?.trim() ?? '');
  });
  const themeStart = themes[0]
    ? rendered.headings.indexOf(themes[0])
    : rendered.headings.length;
  const terms = rendered.headings
    .slice(0, themeStart)
    .filter((heading) => heading.level === 3)
    .map((heading, index) => ({
      ...heading,
      definition: definitions[index] ?? '',
    }));

  const updated = data.updated instanceof Date ? data.updated : null;
  return {
    title: text(data.title) ?? 'Glossaire',
    description: text(data.description) ?? '',
    updated,
    intro: introSource
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
      .filter(Boolean),
    html: rendered.html,
    letters,
    themes,
    terms,
    links: rendered.links,
    rejected: [...rendered.rejectedTargets, ...rendered.rawHtml],
    signature: text(data.signature),
    closing: text(data.closing),
  };
}

const FILE = path.join(
  process.cwd(),
  'content',
  'pages',
  'glossaire-pokemon.md',
);

async function readDocument(): Promise<GlossaryDocument> {
  return parseGlossaryDocument(await readFile(FILE, 'utf8'));
}

let loaded: Promise<GlossaryDocument> | undefined;
/** Once per server instance; on every request in development to see edits. */
export const getGlossaryDocument = cache((): Promise<GlossaryDocument> => {
  if (process.env.NODE_ENV === 'development') return readDocument();
  loaded ??= readDocument().catch((error: unknown) => {
    loaded = undefined;
    throw error;
  });
  return loaded;
});
