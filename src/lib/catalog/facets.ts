import 'server-only';
import { getPrisma } from '@/lib/db/prisma';
import { getCategories, getExtensions } from './taxonomy';
import { buildCatalogWhere } from './getCatalogProducts';
import { parseCatalogParams, type CatalogScope } from './params';
export async function getCatalogFacets(scope: CatalogScope) {
  const categories = await getCategories();
  const { where } = buildCatalogWhere(
    parseCatalogParams({}),
    scope,
    categories,
  );
  const [groups, languages, sets] = await Promise.all([
    getPrisma().product.groupBy({
      by: ['categoryId', 'productType', 'tcgSetId'],
      where,
    }),
    getPrisma().productVariant.groupBy({
      by: ['language'],
      where: { isActive: true, product: where },
      orderBy: { language: 'asc' },
    }),
    getExtensions(),
  ]);
  const ids = new Set(groups.map((g) => g.categoryId));
  // Inclure les parents qui conduisent à un produit visible, sans N+1.
  for (const category of categories) {
    if (!ids.has(category.id)) continue;
    const visited = new Set<string>();
    let parent = category.parentId;
    while (parent && !visited.has(parent)) {
      visited.add(parent);
      ids.add(parent);
      parent = categories.find((c) => c.id === parent)?.parentId ?? null;
    }
  }
  return {
    categories: categories
      .filter((c) => ids.has(c.id))
      .map(({ name, slug }) => ({ name, slug })),
    sets: sets
      .filter((s) => groups.some((g) => g.tcgSetId === s.id))
      .map(({ name, slug }) => ({ name, slug })),
    types: [...new Set(groups.map((g) => g.productType))].sort(),
    languages: languages.map((l) => l.language),
  };
}
export type CatalogFacets = Awaited<ReturnType<typeof getCatalogFacets>>;
