// Database rules of the SEO audit (docs/seo-architecture.md §10), applied to a
// snapshot of the catalog so they run without a database in tests.
import { isReservedFacetSlug, isReservedRootSlug } from '../facets';
import { isPlaceholderImage } from '../jsonld';
import { aggregateOverTree } from '../registry';
import type { AuditIssue, AuditRuleCode } from './types';

export const SEO_TITLE_MAX = 70;
export const SEO_DESCRIPTION_MAX = 170;

interface SeoFields {
  seoTitle: string | null;
  seoDescription: string | null;
}

export interface AuditGame extends SeoFields {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
  faq: unknown;
}

export interface AuditSet extends SeoFields {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
  gameId: string | null;
  releaseDate: Date | null;
  faq: unknown;
}

export interface AuditCategory extends SeoFields {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
  parentId: string | null;
  faq: unknown;
}

export interface AuditProduct extends SeoFields {
  id: string;
  slug: string;
  name: string;
  productType: string;
  /** Published with active parents and ≥ 1 active variant (visibleProductWhere). */
  visible: boolean;
  hasDescription: boolean;
  gameId: string | null;
  tcgSetId: string | null;
  categoryId: string;
  images: { url: string; alt: string }[];
}

export interface CatalogSnapshot {
  games: AuditGame[];
  sets: AuditSet[];
  categories: AuditCategory[];
  products: AuditProduct[];
  /** Reference date for upcoming sets. */
  now: Date;
}

export interface CatalogAudit {
  issues: AuditIssue[];
  stats: Record<string, number>;
}

const issue = (
  code: AuditRuleCode,
  subject: string,
  detail?: string,
): AuditIssue => (detail ? { code, subject, detail } : { code, subject });

const quote = (text: string) => `« ${text} »`;
const length = (text: string) => [...text.replace(/\s+/g, ' ').trim()].length;
const productSubject = (product: AuditProduct) => `/produit/${product.slug}`;

export function isRealImage(url: string): boolean {
  return url.trim() !== '' && !isPlaceholderImage(url.trim());
}

/** Why a stored FAQ is not a list of { question, answer } texts; null when valid. */
export function faqProblem(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value)) return 'la FAQ n’est pas une liste';
  const invalid = value.flatMap((entry: unknown, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry))
      return [index + 1];
    const { question, answer } = entry as Record<string, unknown>;
    return typeof question === 'string' &&
      question.trim() &&
      typeof answer === 'string' &&
      answer.trim()
      ? []
      : [index + 1];
  });
  if (!invalid.length) return null;
  return `${invalid.length > 1 ? 'entrées' : 'entrée'} ${invalid.join(', ')} sans question ou réponse texte`;
}

interface SlugOwner {
  label: string;
  slug: string;
  isActive: boolean;
}

function collision(owners: readonly SlugOwner[], reason: string): AuditIssue {
  const [first] = owners;
  return issue(
    owners.every((owner) => owner.isActive)
      ? 'slug-collision'
      : 'slug-collision-inactive',
    first?.slug ?? '',
    `${owners
      .map((owner) => `${owner.label}${owner.isActive ? '' : ' (inactive)'}`)
      .join(' / ')} : ${reason}`,
  );
}

/** Slugs that break the grammar of /{game}/{facet} (docs §3, espace de noms). */
export function findSlugCollisions(
  snapshot: Pick<CatalogSnapshot, 'games' | 'sets' | 'categories'>,
): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const setOwner = (set: AuditSet): SlugOwner => ({
    label: `extension ${quote(set.name)}`,
    slug: set.slug,
    isActive: set.isActive,
  });
  const categoryOwner = (category: AuditCategory): SlugOwner => ({
    label: `catégorie ${quote(category.name)}`,
    slug: category.slug,
    isActive: category.isActive,
  });
  for (const game of snapshot.games)
    if (isReservedRootSlug(game.slug))
      issues.push(
        collision(
          [
            {
              label: `jeu ${quote(game.name)}`,
              slug: game.slug,
              isActive: game.isActive,
            },
          ],
          'segment racine réservé',
        ),
      );
  for (const owner of [
    ...snapshot.sets.map(setOwner),
    ...snapshot.categories.map(categoryOwner),
  ])
    if (isReservedFacetSlug(owner.slug))
      issues.push(collision([owner], 'slug de langue ou de statut'));
  const categoriesBySlug = new Map(
    snapshot.categories.map((category) => [
      category.slug.trim().toLowerCase(),
      category,
    ]),
  );
  for (const set of snapshot.sets) {
    const category = categoriesBySlug.get(set.slug.trim().toLowerCase());
    if (category)
      issues.push(
        collision(
          [setOwner(set), categoryOwner(category)],
          'même slug de facette',
        ),
      );
  }
  return issues;
}

function seoOverrideIssues(label: string, fields: SeoFields): AuditIssue[] {
  const issues: AuditIssue[] = [];
  if (fields.seoTitle && length(fields.seoTitle) > SEO_TITLE_MAX)
    issues.push(
      issue(
        'seo-title-too-long',
        label,
        `${length(fields.seoTitle)} caractères`,
      ),
    );
  if (
    fields.seoDescription &&
    length(fields.seoDescription) > SEO_DESCRIPTION_MAX
  )
    issues.push(
      issue(
        'seo-description-too-long',
        label,
        `${length(fields.seoDescription)} caractères`,
      ),
    );
  return issues;
}

function count<K>(keys: Iterable<K>): Map<K, number> {
  const counts = new Map<K, number>();
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
  return counts;
}

export function auditCatalog(snapshot: CatalogSnapshot): CatalogAudit {
  const issues: AuditIssue[] = [];
  const setsById = new Map(snapshot.sets.map((set) => [set.id, set]));
  const gamesById = new Map(snapshot.games.map((game) => [game.id, game]));
  const visible = snapshot.products.filter((product) => product.visible);
  const gameName = (id: string | null) =>
    id ? (gamesById.get(id)?.name ?? id) : 'aucun';

  // Products
  for (const product of snapshot.products) {
    const subject = productSubject(product);
    const set = product.tcgSetId ? setsById.get(product.tcgSetId) : undefined;
    if (set?.gameId && product.gameId !== set.gameId)
      issues.push(
        issue(
          'product-game-mismatch',
          subject,
          `jeu du produit : ${gameName(product.gameId)} ; extension ${quote(set.name)} : ${gameName(set.gameId)}`,
        ),
      );
    issues.push(...seoOverrideIssues(subject, product));
  }
  for (const product of visible) {
    const subject = productSubject(product);
    if (!product.images.some((image) => isRealImage(image.url)))
      issues.push(
        issue(
          'product-no-image',
          subject,
          product.images.length
            ? `${product.images.length} image(s), toutes de remplacement ou vides`
            : 'aucune image',
        ),
      );
    if (!product.hasDescription)
      issues.push(issue('product-no-description', subject, product.name));
    if (!product.gameId)
      issues.push(
        issue(
          product.productType === 'ACCESSORY'
            ? 'accessory-no-game'
            : 'product-no-game',
          subject,
          product.name,
        ),
      );
    const withoutAlt = product.images.filter(
      (image) => isRealImage(image.url) && !image.alt.trim(),
    ).length;
    if (withoutAlt)
      issues.push(
        issue(
          'image-no-alt',
          subject,
          `${withoutAlt} image(s) sur ${product.images.length}`,
        ),
      );
  }

  // Sets
  const visibleBySet = count(
    visible.flatMap((product) => (product.tcgSetId ? [product.tcgSetId] : [])),
  );
  for (const set of snapshot.sets) {
    const subject = `extension ${set.slug}`;
    issues.push(...seoOverrideIssues(subject, set));
    const faq = faqProblem(set.faq);
    if (faq) issues.push(issue('faq-invalid', subject, faq));
    if (!set.isActive) continue;
    if (!set.gameId) issues.push(issue('set-no-game', subject, set.name));
    if (!set.releaseDate)
      issues.push(issue('set-no-release-date', subject, set.name));
    if (!visibleBySet.get(set.id))
      issues.push(
        issue(
          set.releaseDate && set.releaseDate > snapshot.now
            ? 'upcoming-empty-set'
            : 'empty-set',
          subject,
          set.name,
        ),
      );
  }

  // Games
  const visibleByGame = count(
    visible.flatMap((product) => (product.gameId ? [product.gameId] : [])),
  );
  for (const game of snapshot.games) {
    const subject = `jeu ${game.slug}`;
    issues.push(...seoOverrideIssues(subject, game));
    const faq = faqProblem(game.faq);
    if (faq) issues.push(issue('faq-invalid', subject, faq));
    if (game.isActive && !visibleByGame.get(game.id))
      issues.push(issue('empty-game', subject, game.name));
  }

  // Categories: a product counts for its category and every ancestor.
  const visibleByCategory = aggregateOverTree(
    count(visible.map((product) => product.categoryId)),
    snapshot.categories,
  );
  for (const category of snapshot.categories) {
    const subject = `catégorie ${category.slug}`;
    issues.push(...seoOverrideIssues(subject, category));
    const faq = faqProblem(category.faq);
    if (faq) issues.push(issue('faq-invalid', subject, faq));
    if (category.isActive && !visibleByCategory.get(category.id))
      issues.push(issue('empty-category', subject, category.name));
  }

  issues.push(...findSlugCollisions(snapshot));

  const active = <T extends { isActive: boolean }>(rows: readonly T[]) =>
    rows.filter((row) => row.isActive).length;
  return {
    issues,
    stats: {
      games: snapshot.games.length,
      activeGames: active(snapshot.games),
      sets: snapshot.sets.length,
      activeSets: active(snapshot.sets),
      categories: snapshot.categories.length,
      activeCategories: active(snapshot.categories),
      products: snapshot.products.length,
      visibleProducts: visible.length,
      images: snapshot.products.reduce(
        (total, product) => total + product.images.length,
        0,
      ),
    },
  };
}
