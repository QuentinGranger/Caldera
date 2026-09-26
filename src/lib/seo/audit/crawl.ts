// Crawl of a running server from its sitemaps (docs/seo-architecture.md §10).
// Network access goes through the injected fetch, so the whole crawl runs on
// fixtures in tests.
import {
  auditPage,
  displayPath,
  findDuplicates,
  findOrphans,
  findSortSearchLinks,
  internalLinks,
  isPrivatePath,
  parseAbsoluteUrl,
  recordLinks,
  referrersDetail,
  summarizePage,
  urlKey,
  type FetchedPage,
  type LinkIndex,
  type PageSummary,
} from './pages';
import { parseSitemap } from './sitemap';
import type { AuditIssue, AuditRuleCode } from './types';

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface CrawlProgress {
  phase: 'sitemaps' | 'pages' | 'links';
  done: number;
  total: number;
}

export interface CrawlOptions {
  /** Origin of the server to crawl, e.g. http://localhost:3000. */
  baseUrl: string;
  /** Maximum number of sitemap URLs to fetch; all of them when absent. */
  limit?: number | null;
  /** Internal links (outside the crawled pages) whose status is checked. */
  linkSample?: number;
  concurrency?: number;
  timeoutMs?: number;
  userAgent?: string;
  fetch?: FetchLike;
  onProgress?: (progress: CrawlProgress) => void;
}

export interface CrawlStats {
  sitemaps: number;
  sitemapUrls: number;
  crawledPages: number;
  analyzedPages: number;
  productPages: number;
  internalLinkTargets: number;
  checkedLinks: number;
}

export interface CrawlResult {
  crawlOrigin: string;
  /** Origin of the sitemap URLs (public domain), when known. */
  siteOrigin: string | null;
  partial: boolean;
  issues: AuditIssue[];
  stats: CrawlStats;
}

export const DEFAULT_CONCURRENCY = 4;
export const DEFAULT_TIMEOUT_MS = 15_000;
export const DEFAULT_LINK_SAMPLE = 200;
export const DEFAULT_USER_AGENT = 'CalderaSeoAudit/1.0 (+npm run seo)';
const MAX_SITEMAP_DEPTH = 3;

/** Runs `run` over the items with at most `concurrency` calls in flight. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  run: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await run(items[index] as T, index);
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.max(1, Math.min(concurrency, items.length)) },
      worker,
    ),
  );
  return results;
}

function describeError(error: unknown, timeoutMs: number): string {
  if (error instanceof Error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError')
      return `délai dépassé (${Math.round(timeoutMs / 1000)} s)`;
    const cause = (error as { cause?: { code?: unknown; message?: unknown } })
      .cause;
    if (cause?.code === 'ECONNREFUSED') return 'connexion refusée';
    if (typeof cause?.code === 'string') return cause.code;
    if (typeof cause?.message === 'string') return cause.message;
    return error.message;
  }
  return String(error);
}

interface Fetcher {
  (url: string, readBody: boolean): Promise<Omit<FetchedPage, 'loc'>>;
}

/** What the link checks keep of a response. */
type LinkStatus = Pick<FetchedPage, 'status' | 'error' | 'location'>;

const linkStatus = ({ status, error, location }: LinkStatus): LinkStatus => ({
  status,
  error,
  location,
});

function createFetcher(options: CrawlOptions): Fetcher {
  const fetchImpl = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return async (url, readBody) => {
    try {
      const response = await fetchImpl(url, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          'user-agent': options.userAgent ?? DEFAULT_USER_AGENT,
          accept: 'text/html,application/xml;q=0.9,*/*;q=0.8',
        },
      });
      const body =
        readBody && response.status === 200 ? await response.text() : null;
      if (body === null) await response.body?.cancel().catch(() => undefined);
      return {
        url,
        status: response.status,
        location: response.headers.get('location'),
        contentType: response.headers.get('content-type'),
        xRobotsTag: response.headers.get('x-robots-tag'),
        body,
      };
    } catch (error) {
      return { url, status: null, error: describeError(error, timeoutMs) };
    }
  };
}

const issue = (
  code: AuditRuleCode,
  subject: string,
  detail?: string,
): AuditIssue => (detail ? { code, subject, detail } : { code, subject });

/** The path and query of `url`, requested on the crawled origin. */
function onCrawlOrigin(url: URL, crawlOrigin: string): string {
  return new URL(url.pathname + url.search, crawlOrigin).href;
}

interface SitemapUrl {
  loc: string;
  /** Sitemap file that lists it. */
  sitemap: string;
}

interface Discovery {
  urls: SitemapUrl[];
  sitemaps: number;
  issues: AuditIssue[];
  /** The server did not answer at all. */
  unreachable: boolean;
}

async function discoverSitemaps(
  crawlOrigin: string,
  fetcher: Fetcher,
  onProgress?: CrawlOptions['onProgress'],
): Promise<Discovery> {
  const issues: AuditIssue[] = [];
  const urls: SitemapUrl[] = [];
  const seen = new Set<string>();
  let sitemaps = 0;
  const rootUrl = new URL('/sitemap.xml', crawlOrigin).href;
  const queue: { url: string; label: string; depth: number }[] = [
    { url: rootUrl, label: '/sitemap.xml', depth: 0 },
  ];
  while (queue.length) {
    const current = queue.shift();
    if (!current || seen.has(current.url)) continue;
    seen.add(current.url);
    onProgress?.({
      phase: 'sitemaps',
      done: sitemaps,
      total: sitemaps + queue.length + 1,
    });
    const response = await fetcher(current.url, true);
    if (response.status === null && current.depth === 0)
      return {
        urls,
        sitemaps,
        unreachable: true,
        issues: [
          issue(
            'crawl-unavailable',
            crawlOrigin,
            `${response.error ?? 'aucune réponse'} : démarrez le serveur ou définissez SEO_BASE_URL`,
          ),
        ],
      };
    if (response.status !== 200) {
      issues.push(
        issue(
          'sitemap-unavailable',
          current.label,
          response.status === null
            ? response.error
            : `statut ${response.status}`,
        ),
      );
      continue;
    }
    sitemaps++;
    const parsed = parseSitemap(response.body ?? '');
    if (parsed.kind === 'unknown') {
      issues.push(
        issue(
          'sitemap-unavailable',
          current.label,
          'ni sitemapindex ni urlset',
        ),
      );
      continue;
    }
    if (current.depth === 0 && parsed.kind === 'urlset')
      issues.push(issue('sitemap-not-index', current.label));
    if (!parsed.entries.length)
      issues.push(issue('sitemap-empty', current.label));
    for (const entry of parsed.entries) {
      const url = parseAbsoluteUrl(entry.loc);
      if (!url) {
        issues.push(issue('sitemap-invalid-url', entry.loc, current.label));
        continue;
      }
      if (parsed.kind === 'urlset') {
        urls.push({ loc: url.href, sitemap: current.label });
        continue;
      }
      if (current.depth + 1 > MAX_SITEMAP_DEPTH) {
        issues.push(
          issue(
            'sitemap-unavailable',
            entry.loc,
            'index imbriqué trop profond',
          ),
        );
        continue;
      }
      queue.push({
        url: onCrawlOrigin(url, crawlOrigin),
        label: url.pathname + url.search,
        depth: current.depth + 1,
      });
    }
  }
  return { urls, sitemaps, issues, unreachable: false };
}

/** Round robin over the sitemap files, so a limit samples every kind of page. */
export function interleaveBySitemap<T extends { sitemap: string }>(
  items: readonly T[],
  limit?: number | null,
): T[] {
  if (!limit || limit >= items.length) return [...items];
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const group = groups.get(item.sitemap) ?? [];
    group.push(item);
    groups.set(item.sitemap, group);
  }
  const queues = [...groups.values()];
  const picked: T[] = [];
  for (let round = 0; picked.length < limit; round++) {
    let added = false;
    for (const queue of queues) {
      const item = queue[round];
      if (item === undefined) continue;
      picked.push(item);
      added = true;
      if (picked.length >= limit) break;
    }
    if (!added) break;
  }
  return picked;
}

function mostFrequent(values: readonly string[]): string | null {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best: string | null = null;
  for (const [value, count] of counts)
    if (best === null || count > (counts.get(best) ?? 0)) best = value;
  return best;
}

export async function crawlSite(options: CrawlOptions): Promise<CrawlResult> {
  const crawlOrigin = new URL(options.baseUrl).origin;
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
  const fetcher = createFetcher(options);
  const stats: CrawlStats = {
    sitemaps: 0,
    sitemapUrls: 0,
    crawledPages: 0,
    analyzedPages: 0,
    productPages: 0,
    internalLinkTargets: 0,
    checkedLinks: 0,
  };

  const discovery = await discoverSitemaps(
    crawlOrigin,
    fetcher,
    options.onProgress,
  );
  const issues = [...discovery.issues];
  stats.sitemaps = discovery.sitemaps;
  if (discovery.unreachable)
    return { crawlOrigin, siteOrigin: null, partial: true, issues, stats };

  // Unique sitemap URLs, in discovery order.
  const byLoc = new Map<string, SitemapUrl>();
  const listedTwice = new Map<string, string[]>();
  for (const url of discovery.urls) {
    const first = byLoc.get(url.loc);
    if (!first) byLoc.set(url.loc, url);
    else
      listedTwice.set(url.loc, [
        ...(listedTwice.get(url.loc) ?? [first.sitemap]),
        url.sitemap,
      ]);
  }
  for (const [loc, sitemaps] of listedTwice)
    issues.push(
      issue('sitemap-duplicate-url', displayPath(loc), sitemaps.join(', ')),
    );
  const siteOrigin = mostFrequent(
    [...byLoc.keys()].map((loc) => new URL(loc).origin),
  );
  const siteOrigins = new Set(siteOrigin ? [siteOrigin] : []);
  // A sitemap only lists URLs of its own host.
  const sitemapUrls = [...byLoc.values()].filter((url) => {
    if (new URL(url.loc).origin === siteOrigin) return true;
    issues.push(
      issue(
        'sitemap-invalid-url',
        url.loc,
        `${url.sitemap} : origine différente de ${siteOrigin}`,
      ),
    );
    return false;
  });
  stats.sitemapUrls = sitemapUrls.length;

  // Pages of the sitemaps, analyzed as they arrive: only a summary and the
  // link index outlive a page, so memory does not grow with the HTML.
  const selected = interleaveBySitemap(sitemapUrls, options.limit);
  const partial = selected.length < sitemapUrls.length;
  const summaries: PageSummary[] = [];
  const statusByKey = new Map<string, LinkStatus>();
  const index: LinkIndex = new Map();
  let done = 0;
  await mapWithConcurrency(selected, concurrency, async ({ loc }) => {
    const response = await fetcher(
      onCrawlOrigin(new URL(loc), crawlOrigin),
      true,
    );
    const audit = auditPage({ ...response, loc });
    issues.push(...audit.issues);
    statusByKey.set(urlKey(new URL(loc)), linkStatus(response));
    if (audit.page) {
      summaries.push(summarizePage(audit.page));
      if (audit.page.productCount) stats.productPages++;
      recordLinks(
        index,
        audit.page.key,
        internalLinks(audit.page, { crawlOrigin, siteOrigins }),
      );
    }
    options.onProgress?.({
      phase: 'pages',
      done: ++done,
      total: selected.length,
    });
  });
  stats.crawledPages = selected.length;
  stats.analyzedPages = summaries.length;
  stats.internalLinkTargets = index.size;
  // Pages finish in any order: sort for a stable report.
  summaries.sort((a, b) => a.loc.localeCompare(b.loc));
  issues.push(
    ...findDuplicates(summaries, 'title'),
    ...findDuplicates(summaries, 'description'),
    ...findSortSearchLinks(index),
    ...findOrphans(
      sitemapUrls.map((url) => url.loc),
      index,
      partial,
    ),
  );

  // Status of the linked URLs: known for the crawled pages, sampled otherwise.
  const toCheck = [...index.values()]
    .filter(
      ({ link }) =>
        !statusByKey.has(link.key) && !isPrivatePath(link.target.pathname),
    )
    .sort(
      (a, b) =>
        b.referrerCount - a.referrerCount ||
        a.link.key.localeCompare(b.link.key),
    )
    .slice(0, options.linkSample ?? DEFAULT_LINK_SAMPLE);
  let checked = 0;
  const checkedStatuses = await mapWithConcurrency(
    toCheck,
    concurrency,
    async ({ link }) => {
      const response = await fetcher(link.url, false);
      options.onProgress?.({
        phase: 'links',
        done: ++checked,
        total: toCheck.length,
      });
      return [link.key, linkStatus(response)] as const;
    },
  );
  stats.checkedLinks = checkedStatuses.length;
  const statuses = new Map([...statusByKey, ...checkedStatuses]);
  for (const target of [...index.values()].sort((a, b) =>
    a.link.key.localeCompare(b.link.key),
  )) {
    const status = statuses.get(target.link.key);
    if (!status) continue;
    if (status.status === null || status.status >= 400)
      issues.push(
        issue(
          'broken-link',
          target.link.key,
          `${status.status ?? status.error ?? 'aucune réponse'} ${referrersDetail(target)}`,
        ),
      );
    else if (status.status >= 300 && status.status < 400)
      issues.push(
        issue(
          'link-redirect',
          target.link.key,
          `${status.status} → ${status.location ?? '?'} ${referrersDetail(target)}`,
        ),
      );
  }

  return { crawlOrigin, siteOrigin, partial, issues, stats };
}
