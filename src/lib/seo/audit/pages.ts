// Rules applied to the pages of the sitemap (docs/seo-architecture.md §10):
// one page at a time, then across pages (duplicates, links, orphans).
import {
  extractPageFacts,
  isNoindex,
  robotsDirectives,
  type PageFacts,
} from './html';
import { checkStructuredData } from './structured-data';
import type { AuditIssue, AuditRuleCode } from './types';

/** Added by the layout title template « %s | Caldera ». */
export const TITLE_SUFFIX = ' | Caldera';
export const TITLE_MIN_LENGTH = 15;
export const TITLE_MAX_LENGTH = 65;
export const DESCRIPTION_MAX_LENGTH = 170;
/** Parameters blocked in robots.txt: never linked internally. */
export const SORT_SEARCH_PARAMS: readonly string[] = [
  'sort',
  'search',
  'minPrice',
  'maxPrice',
];
/** Private or transactional paths, disallowed in robots.txt: not audited. */
export const PRIVATE_PATH_PREFIXES: readonly string[] = [
  '/admin',
  '/api/',
  '/checkout',
  '/panier',
  '/commande/',
];

/** Characters as counted by search engines (code points, not UTF-16 units). */
export const textLength = (text: string) => [...text].length;

export function stripTitleSuffix(title: string): string {
  return title.endsWith(TITLE_SUFFIX)
    ? title.slice(0, -TITLE_SUFFIX.length).trimEnd()
    : title;
}

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * Comparable identity of a URL on the site: decoded path without trailing
 * slash, then the query sorted by key. Origin and fragment are dropped.
 */
export function urlKey(url: URL): string {
  const path =
    url.pathname.split('/').map(decodeSegment).join('/').replace(/\/+$/, '') ||
    '/';
  const params = [...url.searchParams].sort(
    ([a, aValue], [b, bValue]) =>
      a.localeCompare(b) || aValue.localeCompare(bValue),
  );
  return params.length
    ? `${path}?${new URLSearchParams(params).toString()}`
    : path;
}

export function isPrivatePath(pathname: string): boolean {
  return PRIVATE_PATH_PREFIXES.some(
    (prefix) =>
      pathname === prefix.replace(/\/$/, '') || pathname.startsWith(prefix),
  );
}

/** Path and query as listed, the subject of the page findings. */
export function displayPath(url: string): string {
  const parsed = parseAbsoluteUrl(url);
  return parsed ? parsed.pathname + parsed.search : url;
}

export function parseAbsoluteUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// One page

export interface FetchedPage {
  /** URL listed in the sitemap. */
  loc: string;
  /** URL requested: the loc on the crawled origin. */
  url: string;
  /** null when the request failed (network error, timeout). */
  status: number | null;
  error?: string;
  location?: string | null;
  contentType?: string | null;
  xRobotsTag?: string | null;
  body?: string | null;
}

export interface AnalyzedPage {
  loc: string;
  url: string;
  key: string;
  facts: PageFacts;
  /** Product nodes of the structured data. */
  productCount: number;
}

export interface PageAudit {
  issues: AuditIssue[];
  /** Set when the page answered 200 with HTML. */
  page?: AnalyzedPage;
}

const issue = (
  code: AuditRuleCode,
  subject: string,
  detail?: string,
): AuditIssue => (detail ? { code, subject, detail } : { code, subject });

const quote = (text: string) => `« ${text} »`;

function statusDetail(page: FetchedPage): string {
  if (page.status === null) return page.error ?? 'aucune réponse';
  if (page.status >= 300 && page.status < 400)
    return `${page.status} → ${page.location ?? 'sans en-tête Location'}`;
  return String(page.status);
}

export function auditPage(fetched: FetchedPage): PageAudit {
  const subject = displayPath(fetched.loc);
  if (fetched.status !== 200)
    return { issues: [issue('page-status', subject, statusDetail(fetched))] };
  if (
    !/\b(?:text\/html|application\/xhtml\+xml)\b/i.test(
      fetched.contentType ?? '',
    )
  )
    return {
      issues: [
        issue('page-not-html', subject, fetched.contentType ?? 'sans type'),
      ],
    };
  const facts = extractPageFacts(fetched.body ?? '');
  const issues: AuditIssue[] = [];
  const loc = new URL(fetched.loc);

  const titles = facts.titles.filter(Boolean);
  const [title] = titles;
  if (!title) issues.push(issue('title-missing', subject));
  else {
    if (new Set(titles).size > 1)
      issues.push(
        issue('title-multiple', subject, titles.map(quote).join(', ')),
      );
    const length = textLength(stripTitleSuffix(title));
    if (length < TITLE_MIN_LENGTH || length > TITLE_MAX_LENGTH)
      issues.push(
        issue(
          'title-length',
          subject,
          `${length} caractères : ${quote(title)}`,
        ),
      );
  }

  const descriptions = facts.descriptions.filter(Boolean);
  const [description] = descriptions;
  if (!description) issues.push(issue('description-missing', subject));
  else {
    if (new Set(descriptions).size > 1)
      issues.push(issue('description-multiple', subject));
    const length = textLength(description);
    if (length > DESCRIPTION_MAX_LENGTH)
      issues.push(
        issue('description-too-long', subject, `${length} caractères`),
      );
  }

  const canonicals = [...new Set(facts.canonicals.filter(Boolean))];
  if (!canonicals.length) issues.push(issue('canonical-missing', subject));
  else if (canonicals.length > 1)
    issues.push(issue('canonical-multiple', subject, canonicals.join(', ')));
  else {
    const [href = ''] = canonicals;
    const canonical = parseAbsoluteUrl(href);
    if (!canonical) issues.push(issue('canonical-relative', subject, href));
    else if (
      canonical.origin !== loc.origin ||
      urlKey(canonical) !== urlKey(loc)
    )
      issues.push(issue('canonical-not-self', subject, `canonical : ${href}`));
  }

  if (!facts.h1.length) issues.push(issue('h1-missing', subject));
  else if (facts.h1.length > 1)
    issues.push(
      issue(
        'h1-multiple',
        subject,
        `${facts.h1.length} h1 : ${facts.h1.map((text) => quote(text)).join(', ')}`,
      ),
    );

  const directives = robotsDirectives([
    ...facts.robots,
    ...(fetched.xRobotsTag ? [fetched.xRobotsTag] : []),
  ]);
  if (isNoindex(directives))
    issues.push(
      issue(
        'noindex-in-sitemap',
        subject,
        [...facts.robots, fetched.xRobotsTag].filter(Boolean).join(' ; '),
      ),
    );

  const structured = checkStructuredData(facts.jsonLd);
  for (const problem of structured.problems)
    issues.push(
      issue(
        problem.kind === 'invalid'
          ? 'jsonld-invalid'
          : problem.kind === 'no-context'
            ? 'jsonld-no-context'
            : 'jsonld-product-offer',
        subject,
        problem.detail,
      ),
    );

  return {
    issues,
    page: {
      loc: fetched.loc,
      url: fetched.url,
      key: urlKey(loc),
      facts,
      productCount: structured.productCount,
    },
  };
}

// ---------------------------------------------------------------------------
// Across pages

const DETAIL_URLS = 5;

/** « a, b, c et 4 autres » */
export function listUrls(
  urls: readonly string[],
  max = DETAIL_URLS,
  total = urls.length,
): string {
  const shown = urls.slice(0, max);
  const rest = total - shown.length;
  return rest > 0 ? `${shown.join(', ')} et ${rest} autres` : shown.join(', ');
}

/** What the cross-page rules keep of an analyzed page. */
export interface PageSummary {
  loc: string;
  title: string | null;
  description: string | null;
}

export function summarizePage(page: AnalyzedPage): PageSummary {
  return {
    loc: page.loc,
    title: page.facts.titles.find(Boolean) ?? null,
    description: page.facts.descriptions.find(Boolean) ?? null,
  };
}

const normalizeText = (text: string) =>
  text.normalize('NFC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('fr-FR');

/** Same title or description (case and spacing ignored) on several pages. */
export function findDuplicates(
  pages: readonly PageSummary[],
  field: 'title' | 'description',
): AuditIssue[] {
  const groups = new Map<string, { text: string; urls: string[] }>();
  for (const page of pages) {
    const text = page[field];
    if (!text) continue;
    const key = normalizeText(text);
    const group = groups.get(key) ?? { text, urls: [] };
    group.urls.push(displayPath(page.loc));
    groups.set(key, group);
  }
  const code = field === 'title' ? 'title-duplicate' : 'description-duplicate';
  return [...groups.values()]
    .filter((group) => group.urls.length > 1)
    .map((group) =>
      issue(
        code,
        quote(group.text),
        `${group.urls.length} pages : ${listUrls(group.urls)}`,
      ),
    );
}

export interface InternalLink {
  /** urlKey of the target. */
  key: string;
  /** Target on the crawled origin, fragment removed. */
  url: string;
  target: URL;
}

/**
 * Internal <a href> of a page: http(s) links whose origin is the crawled
 * origin or one of the site origins (absolute links to the public domain).
 */
export function internalLinks(
  page: Pick<AnalyzedPage, 'url' | 'facts'>,
  options: { crawlOrigin: string; siteOrigins: ReadonlySet<string> },
): InternalLink[] {
  let base: URL;
  try {
    base = new URL(page.facts.baseHref ?? page.url, page.url);
  } catch {
    base = new URL(page.url);
  }
  const links: InternalLink[] = [];
  for (const href of page.facts.links) {
    if (!href || href.startsWith('#')) continue;
    let target: URL;
    try {
      target = new URL(href, base);
    } catch {
      continue;
    }
    if (target.protocol !== 'http:' && target.protocol !== 'https:') continue;
    if (
      target.origin !== options.crawlOrigin &&
      !options.siteOrigins.has(target.origin)
    )
      continue;
    target.hash = '';
    links.push({
      key: urlKey(target),
      url: new URL(target.pathname + target.search, options.crawlOrigin).href,
      target,
    });
  }
  return links;
}

export function hasSortSearchParam(url: URL): boolean {
  return SORT_SEARCH_PARAMS.some((name) => url.searchParams.has(name));
}

/** A URL linked from at least one other crawled page. */
export interface LinkTarget {
  link: InternalLink;
  referrerCount: number;
  /** First referrers (keys), for the report. */
  referrers: string[];
}

/** Linked URLs by key: memory grows with distinct targets, not with links. */
export type LinkIndex = Map<string, LinkTarget>;

const REFERRER_EXAMPLES = 3;

/** Adds the links of one page; self links and repeats on a page count once. */
export function recordLinks(
  index: LinkIndex,
  sourceKey: string,
  links: readonly InternalLink[],
): void {
  const seen = new Set<string>([sourceKey]);
  for (const link of links) {
    if (seen.has(link.key)) continue;
    seen.add(link.key);
    const target = index.get(link.key);
    if (!target) {
      index.set(link.key, { link, referrerCount: 1, referrers: [sourceKey] });
      continue;
    }
    target.referrerCount++;
    if (target.referrers.length < REFERRER_EXAMPLES)
      target.referrers.push(sourceKey);
  }
}

/** « depuis /a, /b, /c et 12 autres » */
export function referrersDetail(target: LinkTarget): string {
  return `depuis ${listUrls(target.referrers, REFERRER_EXAMPLES, target.referrerCount)}`;
}

/**
 * Sitemap URLs never linked from another crawled page. With a partial crawl
 * the unvisited pages may hold the missing links: findings become notices.
 */
export function findOrphans(
  sitemapLocs: readonly string[],
  index: LinkIndex,
  partial: boolean,
): AuditIssue[] {
  const code = partial ? 'orphan-page-partial' : 'orphan-page';
  return sitemapLocs
    .filter((loc) => {
      const url = parseAbsoluteUrl(loc);
      return url !== null && !index.has(urlKey(url));
    })
    .map((loc) => issue(code, displayPath(loc)));
}

/** Internal links carrying sort, search or price parameters, by target. */
export function findSortSearchLinks(index: LinkIndex): AuditIssue[] {
  return [...index.values()]
    .filter((target) => hasSortSearchParam(target.link.target))
    .sort((a, b) => a.link.key.localeCompare(b.link.key))
    .map((target) =>
      issue('link-sort-search', target.link.key, referrersDetail(target)),
    );
}
