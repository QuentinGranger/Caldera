import type { Category } from '@/generated/prisma/client';
// Parcours borné par le nombre de catégories ; même un cycle ne boucle jamais.
export function descendantIds(
  categories: Pick<Category, 'id' | 'parentId' | 'slug'>[],
  slugs: string[],
) {
  const ids = new Set(
    categories.filter((c) => slugs.includes(c.slug)).map((c) => c.id),
  );
  let previous = -1;
  while (previous !== ids.size) {
    previous = ids.size;
    for (const c of categories)
      if (c.parentId && ids.has(c.parentId)) ids.add(c.id);
  }
  return [...ids];
}
