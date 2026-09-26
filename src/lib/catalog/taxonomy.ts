import 'server-only';
import { cache } from 'react';
import type { Prisma } from '@/generated/prisma/client';
import { getPrisma } from '@/lib/db/prisma';
import type { CategoryRef, FaqEntry, GameRef, SetRef } from '@/lib/seo/types';
import { visibleProductWhere } from './queries';

/** Keeps well-formed `{ question, answer }` entries of a stored FAQ. */
export function toFaqEntries(value: Prisma.JsonValue | null): FaqEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const { question, answer } = entry;
    if (typeof question !== 'string' || typeof answer !== 'string') return [];
    return question.trim() && answer.trim()
      ? [{ question: question.trim(), answer: answer.trim() }]
      : [];
  });
}
export function toGameRef(game: GameRef): GameRef {
  return { id: game.id, slug: game.slug, name: game.name };
}
export function toSetRef(set: SetRef): SetRef {
  return {
    id: set.id,
    slug: set.slug,
    name: set.name,
    code: set.code,
    series: set.series,
    releaseDate: set.releaseDate,
    gameId: set.gameId,
  };
}
export function toCategoryRef(category: CategoryRef): CategoryRef {
  return {
    id: category.id,
    slug: category.slug,
    name: category.name,
    parentId: category.parentId,
  };
}

const gameSelect = {
  id: true,
  slug: true,
  name: true,
  shortName: true,
  description: true,
  intro: true,
  seoTitle: true,
  seoDescription: true,
  faq: true,
  logoUrl: true,
  sortOrder: true,
  updatedAt: true,
} satisfies Prisma.GameSelect;
export const getGames = cache(async () => {
  const games = await getPrisma().game.findMany({
    where: { isActive: true },
    select: gameSelect,
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
  });
  return games.map(({ faq, ...game }) => ({
    ...game,
    faq: toFaqEntries(faq),
  }));
});
export type CatalogGame = Awaited<ReturnType<typeof getGames>>[number];
export const getGameBySlug = cache(
  async (slug: string) =>
    (await getGames()).find((game) => game.slug === slug) ?? null,
);

const categorySelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  intro: true,
  seoTitle: true,
  seoDescription: true,
  faq: true,
  imageUrl: true,
  parentId: true,
  sortOrder: true,
  updatedAt: true,
} satisfies Prisma.CategorySelect;
export const getCategories = cache(async () => {
  const rows = await getPrisma().category.findMany({
    where: { isActive: true },
    select: categorySelect,
    orderBy: [{ sortOrder: 'asc' }, { slug: 'asc' }],
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  // Visible only when every ancestor is active; a cycle never reaches a root.
  const hasActiveChain = (row: (typeof rows)[number]) => {
    const visited = new Set<string>();
    let parentId = row.parentId;
    while (parentId) {
      if (visited.has(parentId)) return false;
      visited.add(parentId);
      const parent = byId.get(parentId);
      if (!parent) return false;
      parentId = parent.parentId;
    }
    return true;
  };
  return rows.filter(hasActiveChain).map(({ faq, ...category }) => ({
    ...category,
    faq: toFaqEntries(faq),
  }));
});
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
  code: true,
  description: true,
  series: true,
  releaseDate: true,
  logoUrl: true,
  gameId: true,
} as const;
const setOrder = [
  { releaseDate: { sort: 'desc', nulls: 'last' } },
  { name: 'asc' },
  { id: 'asc' },
] satisfies Prisma.TcgSetOrderByWithRelationInput[];
export const getExtensions = cache(() =>
  getPrisma().tcgSet.findMany({
    where: { isActive: true, products: { some: visibleProductWhere } },
    select: setSelect,
    orderBy: setOrder,
  }),
);
export const getExtension = cache((slug: string) =>
  getPrisma().tcgSet.findFirst({
    where: { slug, isActive: true },
    select: setSelect,
  }),
);
/** Every active set of a game, product-less upcoming ones included. */
export const getGameSets = cache((gameId: string) =>
  getPrisma().tcgSet.findMany({
    where: { gameId, isActive: true },
    select: { ...setSelect, symbolUrl: true, updatedAt: true },
    orderBy: setOrder,
  }),
);
export type CatalogGameSet = Awaited<ReturnType<typeof getGameSets>>[number];
export const getSetBySlug = cache(async (slug: string) => {
  const set = await getPrisma().tcgSet.findFirst({
    where: { slug, isActive: true },
    select: {
      ...setSelect,
      symbolUrl: true,
      intro: true,
      seoTitle: true,
      seoDescription: true,
      faq: true,
      updatedAt: true,
      game: { select: { id: true, slug: true, name: true, isActive: true } },
    },
  });
  if (!set) return null;
  const { faq, ...rest } = set;
  return { ...rest, faq: toFaqEntries(faq) };
});
export type CatalogSetDetail = NonNullable<
  Awaited<ReturnType<typeof getSetBySlug>>
>;
