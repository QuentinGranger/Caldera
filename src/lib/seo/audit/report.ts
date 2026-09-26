// Terminal and JSON renderings of an audit report, and the CI exit code.
import {
  AUDIT_RULES,
  severityOf,
  type AuditIssue,
  type AuditReport,
  type AuditRuleCode,
  type AuditSection,
  type AuditSectionReport,
  type AuditSeverity,
} from './types';

export interface AuditSummary {
  errors: number;
  warnings: number;
  notices: number;
}

const SEVERITY_ORDER: readonly AuditSeverity[] = ['error', 'warning', 'notice'];
const RULE_ORDER = Object.keys(AUDIT_RULES) as AuditRuleCode[];

export function summarize(report: AuditReport): AuditSummary {
  const summary: AuditSummary = { errors: 0, warnings: 0, notices: 0 };
  for (const section of report.sections)
    for (const issue of section.issues) {
      const severity = severityOf(issue);
      if (severity === 'error') summary.errors++;
      else if (severity === 'warning') summary.warnings++;
      else summary.notices++;
    }
  return summary;
}

/** 1 as soon as one blocking error is found. */
export function exitCodeOf(report: AuditReport): 0 | 1 {
  return summarize(report).errors > 0 ? 1 : 0;
}

/** Machine-readable report: every issue carries its severity and label. */
export function toJsonReport(report: AuditReport) {
  return {
    generatedAt: report.generatedAt,
    summary: summarize(report),
    exitCode: exitCodeOf(report),
    sections: report.sections.map((section) => ({
      ...section,
      issues: section.issues.map((issue) => ({
        severity: severityOf(issue),
        code: issue.code,
        label: AUDIT_RULES[issue.code].label,
        subject: issue.subject,
        ...(issue.detail ? { detail: issue.detail } : {}),
      })),
    })),
  };
}

// ---------------------------------------------------------------------------
// Terminal

export interface FormatOptions {
  color?: boolean;
  /** Findings listed per rule; the rest is counted. Infinity lists all. */
  maxPerRule?: number;
}

const ANSI = {
  bold: '\u001b[1m',
  dim: '\u001b[2m',
  red: '\u001b[31m',
  yellow: '\u001b[33m',
  cyan: '\u001b[36m',
  green: '\u001b[32m',
  reset: '\u001b[0m',
} as const;

const SECTION_TITLES: Record<AuditSection, string> = {
  database: 'Base de données',
  crawl: 'Crawl',
};

const STAT_LABELS: Record<string, string> = {
  games: 'jeux',
  activeGames: 'jeux actifs',
  sets: 'extensions',
  activeSets: 'extensions actives',
  categories: 'catégories',
  activeCategories: 'catégories actives',
  products: 'produits',
  visibleProducts: 'produits visibles',
  images: 'images',
  sitemaps: 'sitemaps',
  sitemapUrls: 'URL listées',
  crawledPages: 'pages récupérées',
  analyzedPages: 'pages analysées',
  productPages: 'pages avec Product',
  internalLinkTargets: 'liens internes distincts',
  checkedLinks: 'liens vérifiés',
};

const SEVERITY_TAGS: Record<AuditSeverity, { text: string; color: string }> = {
  error: { text: 'ERREUR', color: ANSI.red },
  warning: { text: 'ALERTE', color: ANSI.yellow },
  notice: { text: 'INFO  ', color: ANSI.cyan },
};

function plural(count: number, singular: string, pluralForm: string) {
  return `${count} ${count > 1 ? pluralForm : singular}`;
}

export function summaryLine(summary: AuditSummary): string {
  return [
    plural(summary.errors, 'erreur', 'erreurs'),
    plural(summary.warnings, 'alerte', 'alertes'),
    plural(summary.notices, 'info', 'infos'),
  ].join(', ');
}

function groupByRule(issues: readonly AuditIssue[]) {
  const groups = new Map<AuditRuleCode, AuditIssue[]>();
  for (const issue of issues) {
    const group = groups.get(issue.code) ?? [];
    group.push(issue);
    groups.set(issue.code, group);
  }
  return [...groups].sort(
    ([a], [b]) =>
      SEVERITY_ORDER.indexOf(AUDIT_RULES[a].severity) -
        SEVERITY_ORDER.indexOf(AUDIT_RULES[b].severity) ||
      RULE_ORDER.indexOf(a) - RULE_ORDER.indexOf(b),
  );
}

function formatSection(
  section: AuditSectionReport,
  paint: (color: string, text: string) => string,
  maxPerRule: number,
): string[] {
  const lines = [
    `${paint(ANSI.bold, SECTION_TITLES[section.section])}${
      section.target ? `  ${paint(ANSI.dim, section.target)}` : ''
    }`,
  ];
  if (section.skipped) {
    lines.push(`  ${paint(ANSI.dim, `Ignoré : ${section.skipped}`)}`);
    return lines;
  }
  const stats = Object.entries(section.stats)
    .map(([key, value]) => `${STAT_LABELS[key] ?? key} : ${value}`)
    .join(' · ');
  if (stats) lines.push(`  ${paint(ANSI.dim, stats)}`);
  if (!section.issues.length) {
    lines.push(`  ${paint(ANSI.green, 'Aucun problème détecté.')}`);
    return lines;
  }
  for (const [code, issues] of groupByRule(section.issues)) {
    const rule = AUDIT_RULES[code];
    const tag = SEVERITY_TAGS[rule.severity];
    lines.push(
      `  ${paint(tag.color, tag.text)}  ${rule.label} ${paint(
        ANSI.dim,
        `(${issues.length}) [${code}]`,
      )}`,
    );
    for (const issue of issues.slice(0, maxPerRule))
      lines.push(
        `      ${issue.subject}${
          issue.detail ? paint(ANSI.dim, ` — ${issue.detail}`) : ''
        }`,
      );
    if (issues.length > maxPerRule)
      lines.push(
        paint(
          ANSI.dim,
          `      … et ${issues.length - maxPerRule} de plus (--all pour tout afficher)`,
        ),
      );
  }
  return lines;
}

export function formatReport(
  report: AuditReport,
  { color = false, maxPerRule = 10 }: FormatOptions = {},
): string {
  const paint = (code: string, text: string) =>
    color ? `${code}${text}${ANSI.reset}` : text;
  const summary = summarize(report);
  const failed = summary.errors > 0;
  const lines = [paint(ANSI.bold, 'Audit SEO — Les Terres de Caldera'), ''];
  for (const section of report.sections)
    lines.push(...formatSection(section, paint, maxPerRule), '');
  lines.push(
    `${paint(ANSI.bold, 'Bilan :')} ${summaryLine(summary)} → ${
      failed
        ? paint(ANSI.red, 'échec (code de sortie 1)')
        : paint(ANSI.green, 'aucune erreur bloquante')
    }`,
  );
  return lines.join('\n');
}
