import type { MetadataRoute } from 'next';
import { connection } from 'next/server';
import { getPrisma } from '@/lib/db/prisma';
import { visibleProductWhere } from '@/lib/catalog/queries';
import { siteOrigin } from '@/lib/site';

// Indexable pages without data; noindex pages (panier, checkout…) stay out.
const staticPaths = [
  '/',
  '/catalogue',
  '/nouveautes',
  '/precommandes',
  '/extensions',
  '/univers',
  '/univers/origines',
  '/univers/territoires',
  '/univers/route-des-cinq',
  '/univers/horizons',
  '/univers/archives',
  '/contact',
  '/cgv',
  '/mentions-legales',
  '/confidentialite',
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Read at request time: the catalogue changes without a redeploy.
  await connection();
  const origin = siteOrigin();
  const url = (path: string) => new URL(path, origin).href;
  const db = getPrisma();
  // Same visibility rules as the public pages, so no listed URL answers 404.
  const [products, categories, sets] = await Promise.all([
    db.product.findMany({
      where: visibleProductWhere,
      select: {
        slug: true,
        updatedAt: true,
        images: {
          select: { url: true },
          orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { id: 'asc' }],
        },
      },
      orderBy: { slug: 'asc' },
    }),
    db.category.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
      orderBy: { slug: 'asc' },
    }),
    db.tcgSet.findMany({
      where: { isActive: true, products: { some: visibleProductWhere } },
      select: { slug: true, updatedAt: true },
      orderBy: { slug: 'asc' },
    }),
  ]);

  return [
    ...staticPaths.map((path) => ({ url: url(path) })),
    ...categories.map((category) => ({
      url: url(`/categorie/${encodeURIComponent(category.slug)}`),
      lastModified: category.updatedAt,
    })),
    ...sets.map((set) => ({
      url: url(`/extensions/${encodeURIComponent(set.slug)}`),
      lastModified: set.updatedAt,
    })),
    ...products.map((product) => ({
      url: url(`/produit/${encodeURIComponent(product.slug)}`),
      lastModified: product.updatedAt,
      images: product.images.map((image) => url(image.url)),
    })),
  ];
}
