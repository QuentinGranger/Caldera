// npm run seo: database checks and crawl of a running server (docs §10).
// The database is only read, inside a READ ONLY transaction, and only through
// an explicit DATABASE_URL: .env is never loaded here.
import { Prisma } from '../src/generated/prisma/client';
import { getPrisma } from '../src/lib/db/prisma';
import { auditCatalog } from '../src/lib/seo/audit/catalog';
import { loadCatalogSnapshot } from '../src/lib/seo/audit/catalog-snapshot';
import {
  USAGE,
  parseAuditArgs,
  type AuditCliOptions,
} from '../src/lib/seo/audit/cli';
import { crawlSite, type CrawlProgress } from '../src/lib/seo/audit/crawl';
import {
  exitCodeOf,
  formatReport,
  toJsonReport,
} from '../src/lib/seo/audit/report';
import type {
  AuditReport,
  AuditSectionReport,
} from '../src/lib/seo/audit/types';

const PHASE_LABELS: Record<CrawlProgress['phase'], string> = {
  sitemaps: 'Sitemaps',
  pages: 'Pages',
  links: 'Liens',
};

function progressReporter(enabled: boolean) {
  if (!enabled) return { update: undefined, clear: () => undefined };
  let shown = false;
  return {
    update: ({ phase, done, total }: CrawlProgress) => {
      process.stderr.write(
        `\r\u001b[2K${PHASE_LABELS[phase]} : ${done}/${total}`,
      );
      shown = true;
    },
    clear: () => {
      if (shown) process.stderr.write('\r\u001b[2K');
    },
  };
}

async function auditDatabase(
  options: AuditCliOptions,
): Promise<AuditSectionReport> {
  const db = getPrisma();
  try {
    const snapshot = await db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SET TRANSACTION READ ONLY`;
        return loadCatalogSnapshot(tx);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        maxWait: 10_000,
        timeout: 120_000,
      },
    );
    const { issues, stats } = auditCatalog(snapshot);
    return {
      section: 'database',
      target: options.databaseTarget ?? undefined,
      stats,
      issues,
    };
  } finally {
    await db.$disconnect();
  }
}

async function auditCrawl(
  options: AuditCliOptions,
): Promise<AuditSectionReport> {
  const progress = progressReporter(!options.json && process.stderr.isTTY);
  try {
    const result = await crawlSite({
      baseUrl: options.baseUrl,
      limit: options.limit,
      linkSample: options.linkSample,
      timeoutMs: options.timeoutMs,
      onProgress: progress.update,
    });
    const notes = [
      result.siteOrigin && result.siteOrigin !== result.crawlOrigin
        ? `URL publiques : ${result.siteOrigin}`
        : null,
      result.partial && result.stats.sitemapUrls
        ? `crawl partiel (${result.stats.crawledPages}/${result.stats.sitemapUrls})`
        : null,
    ].filter(Boolean);
    return {
      section: 'crawl',
      target: `${result.crawlOrigin}${notes.length ? ` (${notes.join(', ')})` : ''}`,
      stats: { ...result.stats },
      issues: result.issues,
    };
  } finally {
    progress.clear();
  }
}

const parsed = parseAuditArgs(process.argv.slice(2), process.env);
if (parsed.type === 'help') {
  console.log(USAGE);
} else if (parsed.type === 'error') {
  console.error(`${parsed.message}\n\n${USAGE}`);
  process.exitCode = 2;
} else {
  const { options } = parsed;
  try {
    const sections: AuditSectionReport[] = [];
    sections.push(
      options.database
        ? await auditDatabase(options)
        : {
            section: 'database',
            skipped: '--crawl-only',
            stats: {},
            issues: [],
          },
    );
    sections.push(
      options.crawl
        ? await auditCrawl(options)
        : { section: 'crawl', skipped: '--db-only', stats: {}, issues: [] },
    );
    const report: AuditReport = {
      generatedAt: new Date().toISOString(),
      sections,
    };
    if (options.json)
      process.stdout.write(
        `${JSON.stringify(toJsonReport(report), null, 2)}\n`,
      );
    else
      console.log(
        formatReport(report, {
          color: process.stdout.isTTY && !process.env.NO_COLOR,
          maxPerRule: options.all ? Infinity : 10,
        }),
      );
    process.exitCode = exitCodeOf(report);
  } catch (error) {
    console.error(
      `L’audit SEO n’a pas pu s’exécuter : ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    process.exitCode = 2;
  }
}
