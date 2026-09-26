// Minimal HTML tokenizer and SEO extraction for the audit crawler. It follows
// the HTML syntax closely enough for server-rendered pages: comments, raw text
// elements (script, style), RCDATA (title, textarea), quoted, unquoted and
// boolean attributes, SVG/MathML subtrees. It never builds a DOM.

export type HtmlToken =
  | {
      type: 'start';
      name: string;
      attrs: Record<string, string>;
      selfClosing: boolean;
      /** Inside an <svg> or <math> subtree. */
      foreign: boolean;
      /** Content of a raw text or RCDATA element (script, style, title…). */
      content?: string;
    }
  | { type: 'end'; name: string }
  | { type: 'text'; text: string };

const RAW_TEXT = new Set([
  'script',
  'style',
  'xmp',
  'iframe',
  'noembed',
  'noframes',
]);
const RCDATA = new Set(['title', 'textarea']);
const FOREIGN_ROOTS = new Set(['svg', 'math']);

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  laquo: '«',
  raquo: '»',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  hellip: '…',
  ndash: '–',
  mdash: '—',
  euro: '€',
  copy: '©',
  reg: '®',
  trade: '™',
  eacute: 'é',
  egrave: 'è',
  ecirc: 'ê',
  euml: 'ë',
  agrave: 'à',
  acirc: 'â',
  icirc: 'î',
  iuml: 'ï',
  ocirc: 'ô',
  ugrave: 'ù',
  ucirc: 'û',
  ccedil: 'ç',
  oelig: 'œ',
  Eacute: 'É',
  Agrave: 'À',
  Ccedil: 'Ç',
};

/** Numeric references and the named entities common in French pages. */
export function decodeEntities(text: string): string {
  if (!text.includes('&')) return text;
  return text.replace(
    /&(#[xX][0-9a-fA-F]{1,6}|#[0-9]{1,7}|[a-zA-Z][a-zA-Z0-9]{1,31});?/g,
    (match, entity: string) => {
      if (entity.startsWith('#')) {
        const hex = entity[1] === 'x' || entity[1] === 'X';
        const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
        if (!Number.isFinite(code) || code > 0x10ffff) return match;
        if (code === 0 || (code >= 0xd800 && code <= 0xdfff)) return '�';
        return String.fromCodePoint(code);
      }
      const value = NAMED_ENTITIES[entity];
      return value === undefined || !match.endsWith(';') ? match : value;
    },
  );
}

const isAsciiAlpha = (char: string | undefined) =>
  char !== undefined && /[a-zA-Z]/.test(char);
const isSpace = (char: string | undefined) =>
  char === ' ' ||
  char === '\n' ||
  char === '\t' ||
  char === '\r' ||
  char === '\f';

interface ParsedTag {
  name: string;
  attrs: Record<string, string>;
  selfClosing: boolean;
  end: number;
}

/** Reads a start tag at `start` (on « < »); null when it is not a tag. */
function readStartTag(html: string, start: number): ParsedTag | null {
  let index = start + 1;
  const nameStart = index;
  while (
    index < html.length &&
    !isSpace(html[index]) &&
    html[index] !== '/' &&
    html[index] !== '>'
  )
    index++;
  const name = html.slice(nameStart, index).toLowerCase();
  const attrs: Record<string, string> = {};
  let selfClosing = false;
  while (index < html.length) {
    const char = html[index];
    if (isSpace(char)) {
      index++;
      continue;
    }
    if (char === '>') return { name, attrs, selfClosing, end: index + 1 };
    if (char === '/') {
      selfClosing = html[index + 1] === '>';
      index++;
      continue;
    }
    selfClosing = false;
    const attrStart = index;
    // A « = » opening a name belongs to the name (HTML tokenizer rule).
    index++;
    while (
      index < html.length &&
      !isSpace(html[index]) &&
      html[index] !== '/' &&
      html[index] !== '>' &&
      html[index] !== '='
    )
      index++;
    const attrName = html.slice(attrStart, index).toLowerCase();
    while (isSpace(html[index])) index++;
    let value = '';
    if (html[index] === '=') {
      index++;
      while (isSpace(html[index])) index++;
      const quote = html[index];
      if (quote === '"' || quote === "'") {
        const close = html.indexOf(quote, index + 1);
        const valueEnd = close === -1 ? html.length : close;
        value = html.slice(index + 1, valueEnd);
        index = valueEnd + 1;
      } else {
        const valueStart = index;
        while (
          index < html.length &&
          !isSpace(html[index]) &&
          html[index] !== '>'
        )
          index++;
        value = html.slice(valueStart, index);
      }
    }
    if (!Object.hasOwn(attrs, attrName))
      attrs[attrName] = decodeEntities(value);
  }
  return null;
}

/** Position after the closing tag of a raw text element, and its content. */
function readRawContent(html: string, from: number, name: string) {
  const closing = new RegExp(`</${name}(?=[\\s/>])`, 'gi');
  closing.lastIndex = from;
  const match = closing.exec(html);
  if (!match) return { content: html.slice(from), end: html.length };
  const tagEnd = html.indexOf('>', match.index);
  return {
    content: html.slice(from, match.index),
    end: tagEnd === -1 ? html.length : tagEnd + 1,
  };
}

export function tokenizeHtml(html: string): HtmlToken[] {
  const tokens: HtmlToken[] = [];
  let foreignDepth = 0;
  let index = 0;
  const pushText = (text: string) => {
    if (!text) return;
    const last = tokens.at(-1);
    if (last?.type === 'text') last.text += text;
    else tokens.push({ type: 'text', text });
  };
  while (index < html.length) {
    const open = html.indexOf('<', index);
    if (open === -1) {
      pushText(decodeEntities(html.slice(index)));
      break;
    }
    pushText(decodeEntities(html.slice(index, open)));
    const next = html[open + 1];
    if (html.startsWith('<!--', open)) {
      const close = html.indexOf('-->', open + 4);
      index = close === -1 ? html.length : close + 3;
      continue;
    }
    if (next === '!' || next === '?') {
      // Doctype, CDATA section or processing instruction.
      const terminator = html.startsWith('<![CDATA[', open) ? ']]>' : '>';
      const close = html.indexOf(terminator, open + 2);
      index = close === -1 ? html.length : close + terminator.length;
      continue;
    }
    if (next === '/' && isAsciiAlpha(html[open + 2])) {
      const close = html.indexOf('>', open);
      const end = close === -1 ? html.length : close + 1;
      const name = /^<\/([^\s/>]+)/.exec(html.slice(open, end))?.[1];
      if (name) {
        const lower = name.toLowerCase();
        tokens.push({ type: 'end', name: lower });
        if (FOREIGN_ROOTS.has(lower) && foreignDepth > 0) foreignDepth--;
      }
      index = end;
      continue;
    }
    if (!isAsciiAlpha(next)) {
      pushText('<');
      index = open + 1;
      continue;
    }
    const tag = readStartTag(html, open);
    if (!tag) {
      index = html.length;
      break;
    }
    const foreign = foreignDepth > 0 || FOREIGN_ROOTS.has(tag.name);
    const token: Extract<HtmlToken, { type: 'start' }> = {
      type: 'start',
      name: tag.name,
      attrs: tag.attrs,
      selfClosing: tag.selfClosing,
      foreign,
    };
    tokens.push(token);
    index = tag.end;
    if (FOREIGN_ROOTS.has(tag.name) && !tag.selfClosing) foreignDepth++;
    const raw = RAW_TEXT.has(tag.name);
    if ((raw || RCDATA.has(tag.name)) && !tag.selfClosing) {
      const { content, end } = readRawContent(html, index, tag.name);
      token.content = raw ? content : decodeEntities(content);
      tokens.push({ type: 'end', name: tag.name });
      index = end;
    }
  }
  return tokens;
}

// ---------------------------------------------------------------------------
// Extraction

export interface PageFacts {
  /** Text of each <title> outside SVG/MathML, whitespace collapsed. */
  titles: string[];
  /** content of each <meta name="description">. */
  descriptions: string[];
  /** href of each <link rel="canonical">, as written. */
  canonicals: string[];
  /** content of each <meta name="robots"> or <meta name="googlebot">. */
  robots: string[];
  /** Text of each <h1>. */
  h1: string[];
  /** Raw content of each <script type="application/ld+json">. */
  jsonLd: string[];
  /** href of each <a>, as written. */
  links: string[];
  /** href of <base>, when present. */
  baseHref: string | null;
}

export const collapseWhitespace = (text: string) =>
  text.replace(/\s+/g, ' ').trim();

const relTokens = (value: string | undefined) =>
  (value ?? '').toLowerCase().split(/\s+/).filter(Boolean);

export function extractPageFacts(html: string): PageFacts {
  const facts: PageFacts = {
    titles: [],
    descriptions: [],
    canonicals: [],
    robots: [],
    h1: [],
    jsonLd: [],
    links: [],
    baseHref: null,
  };
  // Headings do not nest: the first </h1> closes the current one.
  let h1Text: string[] | null = null;
  for (const token of tokenizeHtml(html)) {
    if (token.type === 'text') {
      h1Text?.push(token.text);
      continue;
    }
    if (token.type === 'end') {
      if (token.name === 'h1' && h1Text) {
        facts.h1.push(collapseWhitespace(h1Text.join('')));
        h1Text = null;
      }
      continue;
    }
    if (token.foreign) continue;
    const { attrs } = token;
    switch (token.name) {
      case 'title':
        facts.titles.push(collapseWhitespace(token.content ?? ''));
        break;
      case 'meta': {
        const name = (attrs.name ?? '').trim().toLowerCase();
        if (name === 'description')
          facts.descriptions.push(collapseWhitespace(attrs.content ?? ''));
        else if (name === 'robots' || name === 'googlebot')
          facts.robots.push(attrs.content ?? '');
        break;
      }
      case 'link':
        if (relTokens(attrs.rel).includes('canonical'))
          facts.canonicals.push((attrs.href ?? '').trim());
        break;
      case 'base':
        facts.baseHref ??= attrs.href?.trim() || null;
        break;
      case 'script':
        if ((attrs.type ?? '').trim().toLowerCase() === 'application/ld+json')
          facts.jsonLd.push(token.content ?? '');
        break;
      case 'a':
        if (attrs.href !== undefined) facts.links.push(attrs.href.trim());
        break;
      case 'img':
        // The alt of a logo is the text of a heading made of it.
        if (h1Text && attrs.alt) h1Text.push(` ${attrs.alt} `);
        break;
      case 'h1':
        if (h1Text) facts.h1.push(collapseWhitespace(h1Text.join('')));
        h1Text = [];
        break;
    }
  }
  if (h1Text) facts.h1.push(collapseWhitespace(h1Text.join('')));
  return facts;
}

/** Directives that carry a value: « max-image-preview:none » is not « none ». */
const VALUED_DIRECTIVES = new Set([
  'max-snippet',
  'max-image-preview',
  'max-video-preview',
  'unavailable_after',
]);

/**
 * Directives of robots metas and X-Robots-Tag headers, lower-cased. A user
 * agent prefix (« googlebot: noindex ») is dropped.
 */
export function robotsDirectives(values: readonly string[]): Set<string> {
  const directives = new Set<string>();
  for (const value of values)
    for (const part of value.toLowerCase().split(',')) {
      let text = part.trim();
      for (let prefixes = 0; prefixes < 2; prefixes++) {
        const colon = text.indexOf(':');
        if (colon <= 0) break;
        const head = text.slice(0, colon).trim();
        if (VALUED_DIRECTIVES.has(head)) {
          text = head;
          break;
        }
        text = text.slice(colon + 1).trim();
      }
      for (const directive of text.split(/\s+/))
        if (directive) directives.add(directive);
    }
  return directives;
}

export function isNoindex(directives: ReadonlySet<string>): boolean {
  return directives.has('noindex') || directives.has('none');
}
