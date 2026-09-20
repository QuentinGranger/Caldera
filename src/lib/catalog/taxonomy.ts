import 'server-only';
import { cache } from 'react';
import { getPrisma } from '@/lib/db/prisma';
import { visibleProductWhere } from './queries';
export const getCategories = cache(() =>
  getPrisma().category.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      imageUrl: true,
      parentId: true,
      sortOrder: true,
    },
    orderBy: [{ sortOrder: 'asc' }, { slug: 'asc' }],
  }),
);
export type CatalogCategory = Awaited<ReturnType<typeof getCategories>>[number];
export const getCategory = cache(async (slug: string) => {
  const categories = await getCategories();
  const category = categories.find((c) => c.slug === slug);
  if (!category) return null;
  const ancestors: CatalogCategory[] = [];
  const visited = new Set([category.id]);
  let parentId = category.parentId;
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = categories.find((c) => c.id === parentId);
    if (!parent) break;
    ancestors.unshift(parent);
    parentId = parent.parentId;
  }
  return {
    ...category,
    ancestors,
    children: categories.filter(
      (c) => c.parentId === category.id && c.id !== category.id,
    ),
  };
});
const setSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  series: true,
  releaseDate: true,
  logoUrl: true,
} as const;
export const getExtensions = cache(() =>
  getPrisma().tcgSet.findMany({
    where: { isActive: true, products: { some: visibleProductWhere } },
    select: setSelect,
    orderBy: [
      { releaseDate: { sort: 'desc', nulls: 'last' } },
      { name: 'asc' },
      { id: 'asc' },
    ],
  }),
);
export const getExtension = cache((slug: string) =>
  getPrisma().tcgSet.findFirst({
    where: { slug, isActive: true },
    select: setSelect,
  }),
);
