// Place of a product in the silos (docs/seo-architecture.md §4 and §7): its
// indexable parents, for the breadcrumb and for the 308 of an archived
// product. Pure: the caller passes the landing index.
import { landingPath } from '@/lib/seo/facets';
import {
  categoryHubPath,
  categoryLineage,
  type LandingIndex,
} from '@/lib/seo/registry';
import type { CategoryRef, GameRef } from '@/lib/seo/types';

export const CATALOGUE_PATH = '/catalogue';

export interface ProductPlacement {
  game: GameRef | null;
  set: { id: string; slug: string; name: string } | null;
  /** The product family then its ancestors in the active tree, nearest first. */
  families: readonly CategoryRef[];
}

export type ProductParentKind =
  'set-category' | 'set' | 'category' | 'game' | 'category-hub';

export interface ProductParent {
  kind: ProductParentKind;
  path: string;
  /** Short breadcrumb label. */
  label: string;
}

export interface TrailItem {
  label: string;
  href?: string;
}

export type IsIndexable = (path: string) => boolean;

/** Membership test over the indexable landings and /categorie hubs. */
export function indexablePaths(index: LandingIndex): IsIndexable {
  const paths = new Set(
    [...index.landings, ...index.categoryHubs].map((page) => page.path),
  );
  return (path) => paths.has(path);
}

/**
 * The family then its ancestors, nearest first; empty when the family is not
 * part of the active tree (getCategories).
 */
export function familyLineage(
  categories: readonly CategoryRef[],
  categoryId: string | null | undefined,
): CategoryRef[] {
  if (!categoryId) return [];
  const byId = new Map(categories.map((category) => [category.id, category]));
  return (categoryLineage(categories).get(categoryId) ?? []).flatMap((id) => {
    const category = byId.get(id);
    return category
      ? [
          {
            id: category.id,
            slug: category.slug,
            name: category.name,
            parentId: category.parentId,
          },
        ]
      : [];
  });
}

function siloPath(
  game: GameRef,
  set?: ProductPlacement['set'],
  category?: CategoryRef,
): string {
  // landingPath only reads the slugs of the scope.
  return landingPath({
    game,
    ...(set
      ? {
          set: {
            ...set,
            code: null,
            series: null,
            releaseDate: null,
            gameId: game.id,
          },
        }
      : {}),
    ...(category ? { category } : {}),
  });
}

/**
 * Indexable parents, at most one per kind, in redirect priority order:
 * set + family, set, family of the game, game, multi-game family hub. A
 * family level is the nearest family of the lineage with an indexable page.
 */
export function productParents(
  { game, set, families }: ProductPlacement,
  isIndexable: IsIndexable,
): ProductParent[] {
  const parents: ProductParent[] = [];
  const first = (
    kind: ProductParentKind,
    candidates: readonly { path: string; label: string }[],
  ) => {
    const found = candidates.find((candidate) => isIndexable(candidate.path));
    if (found) parents.push({ kind, ...found });
  };
  if (game) {
    if (set) {
      first(
        'set-category',
        families.map((family) => ({
          path: siloPath(game, set, family),
          label: family.name,
        })),
      );
      first('set', [{ path: siloPath(game, set), label: set.name }]);
    }
    first(
      'category',
      families.map((family) => ({
        path: siloPath(game, undefined, family),
        label: family.name,
      })),
    );
    first('game', [{ path: siloPath(game), label: game.name }]);
  }
  first(
    'category-hub',
    families.map((family) => ({
      path: categoryHubPath(family.slug),
      label: family.name,
    })),
  );
  return parents;
}

/** 308 target of an archived product: its best indexable parent. */
export function archivedProductTarget(
  placement: ProductPlacement,
  isIndexable: IsIndexable,
): string {
  return productParents(placement, isIndexable)[0]?.path ?? CATALOGUE_PATH;
}

export interface TrailLevel {
  label: string;
  path: string;
}

export const CATALOGUE_LEVEL: TrailLevel = {
  label: 'Catalogue',
  path: CATALOGUE_PATH,
};

/**
 * Levels between Accueil and the product: game › set › family of the set.
 * Without an indexable set, the family of the game follows the game; a product
 * outside the game silos falls back to its family hub. Empty when only the
 * catalogue is left (CATALOGUE_LEVEL, if indexable).
 */
export function productTrailLevels(
  parents: readonly ProductParent[],
): TrailLevel[] {
  const of = (kind: ProductParentKind) =>
    parents.find((parent) => parent.kind === kind);
  const set = of('set');
  const silo = [of('game'), set, set ? of('set-category') : of('category')];
  const levels = silo.filter((level): level is ProductParent => Boolean(level));
  const hub = of('category-hub');
  return (levels.length ? levels : hub ? [hub] : []).map(({ label, path }) => ({
    label,
    path,
  }));
}

/** Breadcrumb items; the product itself is the current page (no link). */
export function productBreadcrumb(
  levels: readonly TrailLevel[],
  productName: string,
): TrailItem[] {
  return [
    { label: 'Accueil', href: '/' },
    ...levels.map((level) => ({ label: level.label, href: level.path })),
    { label: productName },
  ];
}
