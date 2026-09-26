// SEO audit vocabulary (docs/seo-architecture.md §10). Every rule has a fixed
// severity so the CI outcome of a finding never depends on its context.

/** error: blocks the CI (exit code 1); warning: to fix; notice: to review. */
export type AuditSeverity = 'error' | 'warning' | 'notice';

export type AuditSection = 'database' | 'crawl';

interface AuditRule {
  section: AuditSection;
  severity: AuditSeverity;
  label: string;
}

export const AUDIT_RULES = {
  // Database
  'product-no-image': {
    section: 'database',
    severity: 'warning',
    label: 'Produits visibles sans image réelle (visuel de remplacement)',
  },
  'product-no-description': {
    section: 'database',
    severity: 'warning',
    label: 'Produits visibles sans description',
  },
  'product-no-game': {
    section: 'database',
    severity: 'warning',
    label: 'Produits visibles sans jeu (hors accessoires)',
  },
  'accessory-no-game': {
    section: 'database',
    severity: 'notice',
    label: 'Accessoires visibles sans jeu (multi-jeux si voulu)',
  },
  'product-game-mismatch': {
    section: 'database',
    severity: 'error',
    label: 'Produits dont le jeu diffère de celui de leur extension',
  },
  'image-no-alt': {
    section: 'database',
    severity: 'warning',
    label: 'Images de produits visibles sans texte alternatif',
  },
  'set-no-game': {
    section: 'database',
    severity: 'warning',
    label: 'Extensions actives sans jeu (aucune landing possible)',
  },
  'set-no-release-date': {
    section: 'database',
    severity: 'warning',
    label: 'Extensions actives sans date de sortie',
  },
  'empty-game': {
    section: 'database',
    severity: 'warning',
    label: 'Jeux actifs sans produit visible',
  },
  'empty-set': {
    section: 'database',
    severity: 'warning',
    label: 'Extensions actives déjà sorties sans produit visible',
  },
  'upcoming-empty-set': {
    section: 'database',
    severity: 'notice',
    label: 'Extensions à venir sans produit visible (page « bientôt »)',
  },
  'empty-category': {
    section: 'database',
    severity: 'warning',
    label: 'Catégories actives sans produit visible (sous-catégories incluses)',
  },
  'slug-collision': {
    section: 'database',
    severity: 'error',
    label: 'Collisions de slugs entre entités actives',
  },
  'slug-collision-inactive': {
    section: 'database',
    severity: 'warning',
    label: 'Collisions de slugs impliquant une entité inactive',
  },
  'seo-title-too-long': {
    section: 'database',
    severity: 'warning',
    label: 'seoTitle de plus de 70 caractères',
  },
  'seo-description-too-long': {
    section: 'database',
    severity: 'warning',
    label: 'seoDescription de plus de 170 caractères',
  },
  'faq-invalid': {
    section: 'database',
    severity: 'warning',
    label: 'FAQ JSON invalide (entrées ignorées à l’affichage)',
  },
  // Crawl
  'crawl-unavailable': {
    section: 'crawl',
    severity: 'error',
    label: 'Serveur injoignable',
  },
  'sitemap-unavailable': {
    section: 'crawl',
    severity: 'error',
    label: 'Sitemaps illisibles',
  },
  'sitemap-invalid-url': {
    section: 'crawl',
    severity: 'error',
    label: 'URL de sitemap invalides (relatives ou d’une autre origine)',
  },
  'sitemap-empty': {
    section: 'crawl',
    severity: 'notice',
    label: 'Sitemaps sans URL',
  },
  'sitemap-duplicate-url': {
    section: 'crawl',
    severity: 'warning',
    label: 'URL listées plusieurs fois dans les sitemaps',
  },
  'sitemap-not-index': {
    section: 'crawl',
    severity: 'notice',
    label: '/sitemap.xml n’est pas un index de sitemaps',
  },
  'page-status': {
    section: 'crawl',
    severity: 'error',
    label: 'URL du sitemap sans réponse 200',
  },
  'page-not-html': {
    section: 'crawl',
    severity: 'error',
    label: 'URL du sitemap sans contenu HTML',
  },
  'noindex-in-sitemap': {
    section: 'crawl',
    severity: 'error',
    label: 'URL du sitemap en noindex',
  },
  'title-missing': {
    section: 'crawl',
    severity: 'error',
    label: 'Pages sans title',
  },
  'title-multiple': {
    section: 'crawl',
    severity: 'error',
    label: 'Pages avec plusieurs title',
  },
  'title-length': {
    section: 'crawl',
    severity: 'warning',
    label: 'Title hors de 15 à 65 caractères (suffixe exclu)',
  },
  'title-duplicate': {
    section: 'crawl',
    severity: 'error',
    label: 'Title identiques sur plusieurs pages',
  },
  'description-missing': {
    section: 'crawl',
    severity: 'error',
    label: 'Pages sans meta description',
  },
  'description-multiple': {
    section: 'crawl',
    severity: 'error',
    label: 'Pages avec plusieurs meta description',
  },
  'description-too-long': {
    section: 'crawl',
    severity: 'warning',
    label: 'Meta description de plus de 170 caractères',
  },
  'description-duplicate': {
    section: 'crawl',
    severity: 'warning',
    label: 'Meta description identiques sur plusieurs pages',
  },
  'canonical-missing': {
    section: 'crawl',
    severity: 'error',
    label: 'Pages sans canonical',
  },
  'canonical-multiple': {
    section: 'crawl',
    severity: 'error',
    label: 'Pages avec plusieurs canonical différents',
  },
  'canonical-relative': {
    section: 'crawl',
    severity: 'error',
    label: 'Canonical non absolu',
  },
  'canonical-not-self': {
    section: 'crawl',
    severity: 'error',
    label: 'URL du sitemap déclarée doublon d’une autre URL (canonical)',
  },
  'h1-missing': {
    section: 'crawl',
    severity: 'error',
    label: 'Pages sans h1',
  },
  'h1-multiple': {
    section: 'crawl',
    severity: 'error',
    label: 'Pages avec plusieurs h1',
  },
  'jsonld-invalid': {
    section: 'crawl',
    severity: 'error',
    label: 'JSON-LD illisible',
  },
  'jsonld-no-context': {
    section: 'crawl',
    severity: 'error',
    label: 'JSON-LD sans @context',
  },
  'jsonld-product-offer': {
    section: 'crawl',
    severity: 'error',
    label: 'Product sans offre complète (offers.price et availability)',
  },
  'broken-link': {
    section: 'crawl',
    severity: 'error',
    label: 'Liens internes cassés (4xx, 5xx ou sans réponse)',
  },
  'link-redirect': {
    section: 'crawl',
    severity: 'notice',
    label: 'Liens internes vers une redirection',
  },
  'link-sort-search': {
    section: 'crawl',
    severity: 'warning',
    label: 'Liens internes avec paramètres de tri, recherche ou prix',
  },
  'orphan-page': {
    section: 'crawl',
    severity: 'warning',
    label: 'Pages du sitemap jamais liées depuis une autre page',
  },
  'orphan-page-partial': {
    section: 'crawl',
    severity: 'notice',
    label:
      'Pages du sitemap non liées depuis les pages crawlées (crawl partiel)',
  },
} as const satisfies Record<string, AuditRule>;

export type AuditRuleCode = keyof typeof AUDIT_RULES;

export interface AuditIssue {
  code: AuditRuleCode;
  /** URL, path or entity the finding is about. */
  subject: string;
  detail?: string;
}

export interface AuditSectionReport {
  section: AuditSection;
  /** Why the section did not run, e.g. an option or a missing variable. */
  skipped?: string;
  /** Where the data came from: database host, crawled origin. */
  target?: string;
  stats: Record<string, number>;
  issues: AuditIssue[];
}

export interface AuditReport {
  generatedAt: string;
  sections: AuditSectionReport[];
}

export function ruleOf(code: AuditRuleCode): AuditRule {
  return AUDIT_RULES[code];
}

export function severityOf(issue: Pick<AuditIssue, 'code'>): AuditSeverity {
  return AUDIT_RULES[issue.code].severity;
}
