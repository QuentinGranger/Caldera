import 'server-only';
import type { ProductLanguage, ProductType } from '@/generated/prisma/client';
import { getPrisma } from '@/lib/db/prisma';
import { aggregateOverTree, categoryDescendants } from '@/lib/seo/registry';
import { getCategories, getExtensions } from './taxonomy';
import { buildCatalogWhere } from './getCatalogProducts';
import { parseCatalogParams, type CatalogScope } from './params';

/**
 * Filter options of a listing, with real product counts for its scope. Only
 * the descendants of the scope category are offered; empty options are hidden.
 */
export async function getCatalogFacets(scope: CatalogScope) {
  const db = getPrisma();
  const demonstration = process.env.CATALOG_DEMO_MODE === '1';
  const categories = await getCategories();
  const { where, variant } = buildCatalogWhere(
    parseCatalogParams({}),
    scope,
    categories,
  );
  const [groups, languageGroups, sets, availability, prices] =
    await Promise.all([
      db.product.groupBy({
        by: ['categoryId', 'productType', 'tcgSetId'],
        where,
        _count: { _all: true },
      }),
      db.productVariant.groupBy({
        by: ['language'],
        where: { AND: [variant, { product: where }] },
        orderBy: { language: 'asc' },
      }),
      getExtensions(),
      // Count the same predicates as the actual filter (including low-stock thresholds).
      demonstration
        ? []
        : Promise.all(
            (['in-stock', 'low-stock', 'preorder'] as const).map(
              async (value) => {
                const filtered = buildCatalogWhere(
                  parseCatalogParams({ availability: value }),
                  scope,
                  categories,
                );
                return [
                  value,
                  await db.product.count({ where: filtered.where }),
                ] as const;
              },
            ),
          ),
      demonstration
        ? null
        : db.productVariant.aggregate({
            where: { AND: [variant, { product: where }] },
            _min: { price: true },
            _max: { price: true },
          }),
    ]);
  // A product counts once per language, whatever its number of variants in it.
  const languageCounts = await Promise.all(
    languageGroups.map(({ language }) =>
      db.product.count({
        where: {
          AND: [
            where,
            { variants: { some: { AND: [variant, { language }] } } },
          ],
        },
      }),
    ),
  );

  const byCategory = new Map<string, number>();
  const bySet = new Map<string, number>();
  const types: Partial<Record<ProductType, number>> = {};
  for (const group of groups) {
    const count = group._count._all;
    byCategory.set(
      group.categoryId,
      (byCategory.get(group.categoryId) ?? 0) + count,
    );
    if (group.tcgSetId)
      bySet.set(group.tcgSetId, (bySet.get(group.tcgSetId) ?? 0) + count);
    types[group.productType] = (types[group.productType] ?? 0) + count;
  }
  const treeCounts = aggregateOverTree(byCategory, categories);
  const scopeCategory = scope.category
    ? categories.find((category) => category.slug === scope.category)
    : undefined;
  const offered = scopeCategory
    ? new Set(
        categoryDescendants(categories, scopeCategory.id).filter(
          (id) => id !== scopeCategory.id,
        ),
      )
    : null;
  const languages: Partial<Record<ProductLanguage, number>> = {};
  languageGroups.forEach(({ language }, index) => {
    const count = languageCounts[index] ?? 0;
    if (count > 0) languages[language] = count;
  });

  const total = groups.reduce((sum, group) => sum + group._count._all, 0);
  return {
    total,
    availability: demonstration
      ? []
      : availability.map(([value, count]) => ({ value, count })),
    priceRange: demonstration
      ? null
      : {
          min: prices?._min.price?.toString() ?? null,
          max: prices?._max.price?.toString() ?? null,
        },
    categories: categories
      .filter(
        (category) =>
          (!offered || offered.has(category.id)) &&
          (treeCounts.get(category.id) ?? 0) > 0,
      )
      .map(({ id, name, slug }) => ({
        name,
        slug,
        count: treeCounts.get(id) ?? 0,
      })),
    sets: sets
      .filter((set) => (bySet.get(set.id) ?? 0) > 0)
      .map(({ id, name, slug }) => ({ name, slug, count: bySet.get(id) ?? 0 })),
    types: (Object.keys(types) as ProductType[]).sort(),
    languages: languageGroups
      .map(({ language }) => language)
      .filter((language) => languages[language]),
    counts: { types, languages },
  };
}
export type CatalogFacets = Awaited<ReturnType<typeof getCatalogFacets>>;
