// Products withdrawn for good (docs/seo-architecture.md §4): archived with no
// meaningful parent page to redirect to. They answer 410 Gone (src/proxy.ts)
// instead of a redirect to the generic catalogue, which Google reads as a soft 404.
import 'server-only';
import { getPrisma } from '@/lib/db/prisma';
import { getCategories } from '@/lib/catalog/taxonomy';
import { getLandingIndex, sharedCache } from '@/lib/seo/registry';
import {
  CATALOGUE_PATH,
  archivedProductTarget,
  familyLineage,
  indexablePaths,
} from './navigation';

export const GONE_PRODUCTS_PATH = '/api/seo/gone';

async function queryGoneProductSlugs(): Promise<string[]> {
  const [archived, categories, index] = await Promise.all([
    getPrisma().product.findMany({
      where: { status: 'ARCHIVED' },
      select: {
        id: true,
        slug: true,
        categoryId: true,
        category: { select: { isActive: true } },
        game: { select: { id: true, slug: true, name: true, isActive: true } },
        tcgSet: {
          select: { id: true, slug: true, name: true, isActive: true },
        },
      },
    }),
    getCategories(),
    getLandingIndex(),
  ]);
  const isIndexable = indexablePaths(index);
  // Same parents as getProductRoute: inactive entities are ignored.
  const gone = archived.filter((product) => {
    const game = product.game?.isActive ? product.game : null;
    const set = product.tcgSet?.isActive && game ? product.tcgSet : null;
    const target = archivedProductTarget(
      {
        game: game && { id: game.id, slug: game.slug, name: game.name },
        set: set && { id: set.id, slug: set.slug, name: set.name },
        families: product.category.isActive
          ? familyLineage(categories, product.categoryId)
          : [],
      },
      isIndexable,
    );
    return target === CATALOGUE_PATH;
  });
  if (!gone.length) return [];
  const former = await getPrisma().slugRedirect.findMany({
    where: {
      entityType: 'PRODUCT',
      entityId: { in: gone.map((product) => product.id) },
    },
    select: { fromSlug: true },
  });
  return [
    ...gone.map((product) => product.slug),
    ...former.map((redirect) => redirect.fromSlug),
  ].sort();
}

/** Slugs (current and former) of products withdrawn for good; cached 5 min. */
export const listGoneProductSlugs = sharedCache(
  queryGoneProductSlugs,
  ['gone-products'],
  300,
);
