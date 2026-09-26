// Markdown to safe HTML. Raw HTML is shown as text, link and image targets are
// checked, and no heading ever becomes an h1 (the page owns it).
import { Marked, type MarkedToken, type Token, type Tokens } from 'marked';
import { createSlug } from '@/lib/catalog/createSlug';
import { PRODUCTION_HOST, siteOrigin } from '@/lib/site';
import type { ContentHeading } from './types';

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  AMP: '&',
  lt: '<',
  LT: '<',
  gt: '>',
  GT: '>',
  quot: '"',
  QUOT: '"',
  apos: "'",
  nbsp: ' ',
};
/** Numeric and basic named character references; unknown ones stay literal. */
export function decodeEntities(text: string): string {
  return text.replace(
    /&(#\d+|#[xX][\da-fA-F]+|[a-zA-Z]+);/g,
    (match, ref: string) => {
      if (!ref.startsWith('#')) return NAMED_ENTITIES[ref] ?? match;
      const code = /^#[xX]/.test(ref)
        ? Number.parseInt(ref.slice(2), 16)
        : Number.parseInt(ref.slice(1), 10);
      const valid =
        code > 0 && code <= 0x10ffff && (code < 0xd800 || code > 0xdfff);
      return valid ? String.fromCodePoint(code) : '�';
    },
  );
}

/** Collapses line breaks and spaces; non-breaking spaces are kept. */
const collapse = (text: string) => text.replace(/[ \t\r\n]+/g, ' ').trim();

// ---------------------------------------------------------------------------
// Link and image targets

// Relative targets are resolved against this reserved host: a result still on
// it is a link to the current site, whatever its real origin.
const RELATIVE_HOST = 'relative.invalid';
const LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);
const SCHEME = /^[a-z][a-z\d+.-]*:/i;

/** Path of a URL on this site; "//x" would switch host once relative. */
const sitePath = (url: URL) =>
  `${url.pathname.replace(/^\/{2,}/, '/')}${url.search}${url.hash}`;

function siteHosts(): Set<string> {
  return new Set([
    PRODUCTION_HOST,
    `www.${PRODUCTION_HOST}`,
    new URL(siteOrigin()).host,
  ]);
}

export interface LinkTarget {
  /** Value for the href attribute, before HTML escaping. */
  href: string;
  /** Another site: rendered with rel="noopener noreferrer". */
  external: boolean;
}

/**
 * Safe href for a Markdown destination, or null when it must not become a
 * link (javascript:, data:, unparsable…). Links to the shop stay relative.
 * `literal`: autolinks, whose character references are not resolved.
 */
export function linkTarget(raw: string, literal = false): LinkTarget | null {
  const value = (literal ? raw : decodeEntities(raw))
    .trim()
    .replace(/[\t\n\r]/g, '');
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value, `https://${RELATIVE_HOST}/`);
  } catch {
    return null;
  }
  if (!LINK_PROTOCOLS.has(url.protocol)) return null;
  if (url.host === RELATIVE_HOST) {
    // "https:page" is relative to an https page: keep the resolved path.
    if (SCHEME.test(value)) return { href: sitePath(url), external: false };
    try {
      return {
        href: encodeURI(value).replace(/%25/g, '%'),
        external: false,
      };
    } catch {
      return null;
    }
  }
  if (url.protocol === 'mailto:' || url.protocol === 'tel:')
    return { href: url.href, external: false };
  if (siteHosts().has(url.host))
    return { href: sitePath(url), external: false };
  return { href: url.href, external: true };
}

/** Same-origin images only: the Content-Security-Policy blocks the others. */
export function imageSource(raw: string): string | null {
  const target = linkTarget(raw);
  return target && !target.external && /^\/(?![/\\])/.test(target.href)
    ? target.href
    : null;
}

// ---------------------------------------------------------------------------
// Plain text

/** Text of inline tokens, as a reader sees it. */
function inlineText(tokens: readonly Token[]): string {
  return (tokens as MarkedToken[])
    .map((token) => {
      switch (token.type) {
        case 'text':
          return token.tokens
            ? inlineText(token.tokens)
            : decodeEntities(token.text);
        case 'escape':
        case 'codespan':
        case 'html':
          return token.text;
        case 'br':
          return ' ';
        case 'link':
        case 'image':
        case 'strong':
        case 'em':
        case 'del':
          return inlineText(token.tokens);
        default:
          return '';
      }
    })
    .join('');
}

/** Text of every block, in document order. */
function blockTexts(tokens: readonly Token[]): string[] {
  return (tokens as MarkedToken[]).flatMap((token): string[] => {
    switch (token.type) {
      case 'heading':
      case 'paragraph':
        return [inlineText(token.tokens)];
      case 'text':
        return [
          token.tokens ? inlineText(token.tokens) : decodeEntities(token.text),
        ];
      case 'blockquote':
        return blockTexts(token.tokens);
      case 'list':
        return token.items.flatMap((item) => blockTexts(item.tokens));
      case 'table':
        return [...token.header, ...token.rows.flat()].map((cell) =>
          inlineText(cell.tokens),
        );
      case 'code':
      case 'html':
        return [token.text];
      default:
        return [];
    }
  });
}

function countWords(texts: readonly string[]): number {
  return texts
    .join(' ')
    .split(/\s+/)
    .filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

// ---------------------------------------------------------------------------
// Rendering

interface HeadingPlan {
  level: number;
  id?: string;
}
// Filled for each document between lexing and rendering; tokens are the keys.
const headingPlans = new WeakMap<Tokens.Heading, HeadingPlan>();

const markdown = new Marked({
  gfm: true,
  renderer: {
    heading(token) {
      const plan = headingPlans.get(token);
      const level = plan?.level ?? Math.max(2, token.depth);
      const id = plan?.id ? ` id="${escapeHtml(plan.id)}"` : '';
      return `<h${level}${id}>${this.parser.parseInline(token.tokens)}</h${level}>\n`;
    },
    html({ text, block }) {
      return block ? `<p>${escapeHtml(text.trim())}</p>\n` : escapeHtml(text);
    },
    link({ href, title, tokens, autolink }) {
      const inner = this.parser.parseInline(tokens);
      const target = linkTarget(href, autolink);
      if (!target) return inner;
      const titleAttribute = title
        ? ` title="${escapeHtml(decodeEntities(title))}"`
        : '';
      const rel = target.external ? ' rel="noopener noreferrer"' : '';
      return `<a href="${escapeHtml(target.href)}"${titleAttribute}${rel}>${inner}</a>`;
    },
    image({ href, title, tokens }) {
      const alt = escapeHtml(collapse(inlineText(tokens)));
      const source = imageSource(href);
      if (!source) return alt;
      const titleAttribute = title
        ? ` title="${escapeHtml(decodeEntities(title))}"`
        : '';
      return `<img src="${escapeHtml(source)}" alt="${alt}"${titleAttribute} loading="lazy" decoding="async">`;
    },
  },
});

function headingTokens(tokens: Token[]): Tokens.Heading[] {
  const headings: Tokens.Heading[] = [];
  markdown.walkTokens(tokens, (token) => {
    if (token.type === 'heading') headings.push(token as Tokens.Heading);
  });
  return headings;
}

export interface MarkdownOptions {
  /** Level of the highest heading of the text: 2 by default, never 1. */
  headingLevel?: 2 | 3 | 4;
}

/**
 * Safe HTML for Markdown typed in the admin (game, set and category intros).
 * Headings are shifted so that the highest one gets `headingLevel`.
 */
export function renderMarkdown(
  source: string | null | undefined,
  { headingLevel = 2 }: MarkdownOptions = {},
): string {
  if (!source?.trim()) return '';
  const tokens = markdown.lexer(source);
  const headings = headingTokens(tokens);
  const top = Math.min(...headings.map((heading) => heading.depth));
  for (const heading of headings)
    headingPlans.set(heading, {
      level: Math.min(6, heading.depth - top + headingLevel),
    });
  return markdown.parser(tokens);
}

export interface RenderedDocument {
  html: string;
  /** h2 and h3 with their anchors, in document order. */
  headings: ContentHeading[];
  /** Depth of every heading of the source, h1 included. */
  headingDepths: number[];
  /** Rendered href of every link. */
  links: string[];
  /** Link and image destinations that were not rendered as such. */
  rejectedTargets: string[];
  /** Raw HTML fragments, rendered as text. */
  rawHtml: string[];
  /** Plain text of the first block when it is a paragraph. */
  lead: string | null;
  wordCount: number;
}

/** Editorial body: headings keep their level, h2 and h3 get stable ids. */
export function renderDocument(source: string): RenderedDocument {
  const tokens = markdown.lexer(source);
  const headings: ContentHeading[] = [];
  const headingDepths: number[] = [];
  const links: string[] = [];
  const rejectedTargets: string[] = [];
  const rawHtml: string[] = [];
  const ids = new Set<string>();
  markdown.walkTokens(tokens, (token) => {
    const node = token as MarkedToken;
    switch (node.type) {
      case 'heading': {
        headingDepths.push(node.depth);
        if (node.depth !== 2 && node.depth !== 3) break;
        const text = collapse(inlineText(node.tokens));
        const id = createSlug(text, ids);
        ids.add(id);
        headingPlans.set(node, { level: node.depth, id });
        headings.push({ id, text, level: node.depth });
        break;
      }
      case 'link': {
        const target = linkTarget(node.href, node.autolink);
        if (target) links.push(target.href);
        else rejectedTargets.push(node.href);
        break;
      }
      case 'image':
        if (!imageSource(node.href)) rejectedTargets.push(node.href);
        break;
      case 'html':
        rawHtml.push(node.text.trim());
        break;
    }
  });
  const first = tokens.find((token) => token.type !== 'space') as
    MarkedToken | undefined;
  return {
    html: markdown.parser(tokens),
    headings,
    headingDepths,
    links,
    rejectedTargets,
    rawHtml,
    lead:
      first?.type === 'paragraph' ? collapse(inlineText(first.tokens)) : null,
    wordCount: countWords(blockTexts(tokens)),
  };
}
