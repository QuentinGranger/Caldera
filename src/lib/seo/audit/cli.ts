// Command line of `npm run seo` (scripts/seo-audit.ts), parsed without side
// effects so the refusal rules are testable.
import { DEFAULT_LINK_SAMPLE, DEFAULT_TIMEOUT_MS } from './crawl';

export const DEFAULT_BASE_URL = 'http://localhost:3000';

export const USAGE = `Usage : npm run seo -- [options]

  --json            rapport JSON sur la sortie standard (CI)
  --limit N         au plus N URL des sitemaps (réparties entre les sitemaps)
  --links N         liens internes hors sitemap vérifiés (défaut ${DEFAULT_LINK_SAMPLE})
  --timeout S       délai maximal d’une requête, en secondes (défaut ${DEFAULT_TIMEOUT_MS / 1000})
  --base-url URL    serveur à crawler (défaut : SEO_BASE_URL, sinon ${DEFAULT_BASE_URL})
  --db-only         contrôles de la base uniquement
  --crawl-only      crawl uniquement (DATABASE_URL non requise)
  --all             liste toutes les occurrences au lieu des 10 premières
  --help            cette aide

La base auditée est celle de DATABASE_URL, à définir explicitement :
le fichier .env n’est jamais lu.
  DATABASE_URL="postgresql://…" npm run seo
Code de sortie : 0 sans erreur bloquante, 1 avec erreurs bloquantes, 2 si l’audit n’a pas pu s’exécuter.`;

export interface AuditCliOptions {
  json: boolean;
  all: boolean;
  database: boolean;
  crawl: boolean;
  baseUrl: string;
  limit: number | null;
  linkSample: number;
  timeoutMs: number;
  /** Host, port and database name of DATABASE_URL, credentials removed. */
  databaseTarget: string | null;
}

export type AuditCliParse =
  | { type: 'help' }
  | { type: 'error'; message: string }
  | { type: 'run'; options: AuditCliOptions };

/** « 127.0.0.1:5434/caldera » from a connection string; null when unreadable. */
export function describeDatabaseUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (!/^postgres(?:ql)?:$/.test(url.protocol)) return null;
    return `${url.host}${url.pathname}`;
  } catch {
    return null;
  }
}

function httpUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

function positiveInteger(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

export function parseAuditArgs(
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
): AuditCliParse {
  let json = false;
  let all = false;
  let dbOnly = false;
  let crawlOnly = false;
  let limit: number | null = null;
  let linkSample = DEFAULT_LINK_SAMPLE;
  let timeoutMs = DEFAULT_TIMEOUT_MS;
  let baseUrl = env.SEO_BASE_URL?.trim() || DEFAULT_BASE_URL;
  const args = [...argv];
  while (args.length) {
    const arg = args.shift() ?? '';
    const [flag = '', inline] = arg.startsWith('--')
      ? (arg.split(/=(.*)/s, 2) as [string, string | undefined])
      : [arg, undefined];
    const value = () => inline ?? args.shift();
    switch (flag) {
      case '--help':
      case '-h':
        return { type: 'help' };
      case '--json':
        json = true;
        break;
      case '--all':
        all = true;
        break;
      case '--db-only':
        dbOnly = true;
        break;
      case '--crawl-only':
        crawlOnly = true;
        break;
      case '--limit': {
        const parsed = positiveInteger(value());
        if (parsed === null)
          return {
            type: 'error',
            message: '--limit attend un entier positif.',
          };
        limit = parsed;
        break;
      }
      case '--links': {
        const raw = value();
        const parsed = raw === '0' ? 0 : positiveInteger(raw);
        if (parsed === null)
          return {
            type: 'error',
            message: '--links attend un entier positif ou nul.',
          };
        linkSample = parsed;
        break;
      }
      case '--timeout': {
        const parsed = positiveInteger(value());
        if (parsed === null)
          return {
            type: 'error',
            message: '--timeout attend un nombre de secondes positif.',
          };
        timeoutMs = parsed * 1000;
        break;
      }
      case '--base-url': {
        const raw = value();
        if (!raw)
          return { type: 'error', message: '--base-url attend une URL.' };
        baseUrl = raw;
        break;
      }
      default:
        return { type: 'error', message: `Option inconnue : ${arg}` };
    }
  }
  if (dbOnly && crawlOnly)
    return {
      type: 'error',
      message: '--db-only et --crawl-only sont incompatibles.',
    };
  const crawlUrl = httpUrl(baseUrl);
  if (!crawlUrl)
    return {
      type: 'error',
      message: `URL de crawl invalide : ${baseUrl} (SEO_BASE_URL ou --base-url).`,
    };
  baseUrl = crawlUrl.origin;
  const database = !crawlOnly;
  let databaseTarget: string | null = null;
  if (database) {
    const databaseUrl = env.DATABASE_URL?.trim();
    if (!databaseUrl)
      return {
        type: 'error',
        message:
          'DATABASE_URL absente : l’audit de la base ne lit jamais .env et refuse de deviner la base. ' +
          'Relancez avec DATABASE_URL="postgresql://…" npm run seo, ou avec --crawl-only pour le seul crawl.',
      };
    databaseTarget = describeDatabaseUrl(databaseUrl);
    if (!databaseTarget)
      return {
        type: 'error',
        message: 'DATABASE_URL n’est pas une URL PostgreSQL valide.',
      };
  }
  return {
    type: 'run',
    options: {
      json,
      all,
      database,
      crawl: !dbOnly,
      baseUrl,
      limit,
      linkSample,
      timeoutMs,
      databaseTarget,
    },
  };
}
