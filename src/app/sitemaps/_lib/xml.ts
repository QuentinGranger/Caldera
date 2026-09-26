// Sitemap protocol (https://www.sitemaps.org/protocol.html) with the Google
// image extension (docs/seo-architecture.md §8). Pure: the routes load the
// entries, this module writes the XML and the HTTP response.

/** Product URLs per /sitemaps/products-{n}.xml (the protocol allows 50 000). */
export const PRODUCTS_PER_SITEMAP = 10_000;

export const SITEMAP_CACHE_CONTROL =
  'public, s-maxage=3600, stale-while-revalidate=86400';

const SITEMAP_NS = 'http://www.sitemaps.org/schemas/sitemap/0.9';
const IMAGE_NS = 'http://www.google.com/schemas/sitemap-image/1.1';
const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>';

export interface SitemapUrl {
  /** Absolute URL of an indexable page. */
  loc: string;
  /** Real modification date; left out when unknown, never the current date. */
  lastModified?: Date | null;
  /** Absolute URLs of the images shown on the page (placeholders excluded). */
  images?: readonly string[];
}

export interface SitemapFile {
  /** Absolute URL of a child sitemap. */
  loc: string;
  lastModified?: Date | null;
}

const ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

/** Entity-escaped text; characters that XML 1.0 forbids are dropped. */
export function escapeXml(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, '')
    .replace(/[&<>"']/g, (character) => ESCAPES[character] ?? character);
}

/** W3C Datetime in UTC (2026-09-26T08:30:00Z); null for a missing or invalid date. */
export function formatLastmod(date: Date | null | undefined): string | null {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return null;
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** Most recent valid date, or null. */
export function latestDate(
  dates: Iterable<Date | null | undefined>,
): Date | null {
  let latest: Date | null = null;
  for (const date of dates)
    if (
      date instanceof Date &&
      Number.isFinite(date.getTime()) &&
      (!latest || date > latest)
    )
      latest = date;
  return latest;
}

function lastmodLine(date: Date | null | undefined, indent: string) {
  const value = formatLastmod(date);
  return value ? [`${indent}<lastmod>${value}</lastmod>`] : [];
}

/** <urlset>; a URL listed twice keeps its first entry. */
export function buildUrlset(urls: readonly SitemapUrl[]): string {
  const seen = new Set<string>();
  const unique = urls.filter((url) => !seen.has(url.loc) && seen.add(url.loc));
  const withImages = unique.some((url) => url.images?.length);
  const lines = [
    XML_DECLARATION,
    `<urlset xmlns="${SITEMAP_NS}"${withImages ? ` xmlns:image="${IMAGE_NS}"` : ''}>`,
  ];
  for (const url of unique) {
    lines.push('  <url>', `    <loc>${escapeXml(url.loc)}</loc>`);
    lines.push(...lastmodLine(url.lastModified, '    '));
    for (const image of new Set(url.images ?? []))
      lines.push(
        '    <image:image>',
        `      <image:loc>${escapeXml(image)}</image:loc>`,
        '    </image:image>',
      );
    lines.push('  </url>');
  }
  lines.push('</urlset>');
  return `${lines.join('\n')}\n`;
}

/** <sitemapindex> of the child sitemaps. */
export function buildSitemapIndex(files: readonly SitemapFile[]): string {
  const lines = [XML_DECLARATION, `<sitemapindex xmlns="${SITEMAP_NS}">`];
  for (const file of files) {
    lines.push('  <sitemap>', `    <loc>${escapeXml(file.loc)}</loc>`);
    lines.push(...lastmodLine(file.lastModified, '    '));
    lines.push('  </sitemap>');
  }
  lines.push('</sitemapindex>');
  return `${lines.join('\n')}\n`;
}

// ---------------------------------------------------------------------------
// Files

export type SitemapName =
  | { kind: 'pages' | 'landings' | 'content' }
  | { kind: 'products'; page: number };

const FIXED_NAMES: Readonly<Record<string, SitemapName>> = {
  'pages.xml': { kind: 'pages' },
  'landings.xml': { kind: 'landings' },
  'content.xml': { kind: 'content' },
};

/** Child sitemap served at /sitemaps/{name}; null for any other name. */
export function parseSitemapName(name: string): SitemapName | null {
  if (Object.hasOwn(FIXED_NAMES, name)) return FIXED_NAMES[name] ?? null;
  const match = /^products-([1-9]\d{0,5})\.xml$/.exec(name);
  return match ? { kind: 'products', page: Number(match[1]) } : null;
}

export function sitemapPath(name: SitemapName): string {
  return name.kind === 'products'
    ? `/sitemaps/products-${name.page}.xml`
    : `/sitemaps/${name.kind}.xml`;
}

/** Number of product sitemaps for `total` indexable products. */
export function productSitemapCount(
  total: number,
  size = PRODUCTS_PER_SITEMAP,
): number {
  if (!Number.isSafeInteger(total) || total <= 0) return 0;
  return Math.ceil(total / size);
}

/** Offset and length of products-{page}.xml in the stable product order. */
export function productSitemapRange(page: number, size = PRODUCTS_PER_SITEMAP) {
  if (!Number.isSafeInteger(page) || page < 1)
    throw new RangeError('Product sitemaps are numbered from 1.');
  return { skip: (page - 1) * size, take: size };
}

// ---------------------------------------------------------------------------
// HTTP

export function xmlResponse(xml: string): Response {
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': SITEMAP_CACHE_CONTROL,
    },
  });
}

export function sitemapNotFound(): Response {
  return new Response('Sitemap introuvable.', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
