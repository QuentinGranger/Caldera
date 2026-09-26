// Sitemap protocol parsing (https://www.sitemaps.org/protocol.html) for the
// audit crawler: an index lists child sitemaps, a urlset lists pages. Image and
// news extensions (<image:loc>…) are ignored.

export type SitemapKind = 'index' | 'urlset' | 'unknown';

export interface SitemapEntry {
  loc: string;
  lastmod: string | null;
}

export interface ParsedSitemap {
  kind: SitemapKind;
  entries: SitemapEntry[];
}

function decodeXml(text: string): string {
  return text.replace(
    /&(#[xX][0-9a-fA-F]{1,6}|#[0-9]{1,7}|amp|lt|gt|quot|apos);/g,
    (match, entity: string) => {
      switch (entity) {
        case 'amp':
          return '&';
        case 'lt':
          return '<';
        case 'gt':
          return '>';
        case 'quot':
          return '"';
        case 'apos':
          return "'";
      }
      const hex = entity[1] === 'x' || entity[1] === 'X';
      const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : match;
    },
  );
}

/** Text of an element, CDATA sections unwrapped and entities decoded. */
function elementText(block: string, name: string): string | null {
  const match = new RegExp(
    `<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}\\s*>`,
    'i',
  ).exec(block);
  if (!match) return null;
  const raw = match[1] ?? '';
  const text = raw.replace(
    /<!\[CDATA\[([\s\S]*?)\]\]>|([^<]+)/g,
    (_, cdata: string | undefined, plain: string | undefined) =>
      cdata ?? decodeXml(plain ?? ''),
  );
  return text.trim();
}

export function parseSitemap(xml: string): ParsedSitemap {
  const body = xml.replace(/<!--[\s\S]*?-->/g, '');
  const root = /<([a-zA-Z][\w:.-]*)[\s>]/.exec(
    body.replace(/<\?[\s\S]*?\?>/g, ''),
  )?.[1];
  const rootName = root?.replace(/^[\w.-]+:/, '').toLowerCase();
  const kind: SitemapKind =
    rootName === 'sitemapindex'
      ? 'index'
      : rootName === 'urlset'
        ? 'urlset'
        : 'unknown';
  if (kind === 'unknown') return { kind, entries: [] };
  const item = kind === 'index' ? 'sitemap' : 'url';
  const entries: SitemapEntry[] = [];
  const blocks = new RegExp(
    `<${item}(?:\\s[^>]*)?>([\\s\\S]*?)</${item}\\s*>`,
    'gi',
  );
  for (const match of body.matchAll(blocks)) {
    const block = match[1] ?? '';
    const loc = elementText(block, 'loc');
    if (loc) entries.push({ loc, lastmod: elementText(block, 'lastmod') });
  }
  return { kind, entries };
}
