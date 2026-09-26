// Indexable URLs of each child sitemap (docs/seo-architecture.md §8): the pages'
// own indexation decisions, real modification dates only.
import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import {
  LISTING_HUBS,
  LISTING_KINDS,
  getIndexableListings,
  listingScope,
} from '@/components/catalog/listingHub';
import {
  universeChapterPath,
  universeChapters,
  universeIndex,
} from '@/data/universe';
import { visibleProductWhere } from '@/lib/catalog/queries';
import { getExtensions } from '@/lib/catalog/taxonomy';
import {
  contentSection,
  getAllContent,
  type ContentSection,
} from '@/lib/content';
import { getPrisma } from '@/lib/db/prisma';
import { isPlaceholderImage } from '@/lib/seo/jsonld';
import {
  getScopeStats,
  listIndexableCategoryHubs,
  listIndexableLandings,
  type SitemapEntry,
} from '@/lib/seo/registry';
import { getShippingFacts } from '@/lib/seo/shipping';
import { absoluteUrl } from '@/lib/site';
import {
  latestDate,
  productSitemapCount,
  productSitemapRange,
  sitemapPath,
  type SitemapFile,
  type SitemapName,
  type SitemapUrl,
} from './xml';

/** Dates of the editorial files (YYYY-MM-DD, read in UTC). */
const day = (value: string) => new Date(`${value}T00:00:00Z`);

// Pages without catalogue data: always indexable.
const STATIC_PAGES: readonly { path: string; updated?: string }[] = [
  { path: '/' },
  { path: universeIndex.path, updated: universeIndex.updated },
  ...universeChapters.map((chapter) => ({
    path: universeChapterPath(chapter.slug),
    updated: chapter.updated,
  })),
  { path: '/contact' },
  { path: '/cgv' },
  { path: '/mentions-legales' },
  { path: '/confidentialite' },
];

/** Static pages, /livraison and the indexable transverse listings. */
export async function getPageUrls(): Promise<SitemapUrl[]> {
  const [listings, shipping] = await Promise.all([
    getIndexableListings(),
    getShippingFacts(),
  ]);
  const listingUrls = await Promise.all(
    LISTING_KINDS.filter((listing) => listings.has(listing)).map(
      async (listing): Promise<SitemapUrl> => ({
        loc: absoluteUrl(LISTING_HUBS[listing].path),
        lastModified: (await getScopeStats(listingScope(listing))).lastModified,
      }),
    ),
  );
  return [
    ...STATIC_PAGES.map(({ path, updated }) => ({
      loc: absoluteUrl(path),
      lastModified: updated ? day(updated) : null,
    })),
    // Shipping page: real methods and rates only, nothing to show without them.
    ...(shipping.length ? [{ loc: absoluteUrl('/livraison') }] : []),
    ...listingUrls,
  ];
}

const fromEntry = ({ path, lastModified }: SitemapEntry): SitemapUrl => ({
  loc: absoluteUrl(path),
  lastModified,
});

/** At least one active set of an active (or no) game has a release date. */
async function hasReleaseDates(): Promise<boolean> {
  const count = await getPrisma().tcgSet.count({
    where: {
      isActive: true,
      releaseDate: { not: null },
      OR: [{ gameId: null }, { game: { isActive: true } }],
    },
  });
  return count > 0;
}

/** Game hubs, facet landings, family hubs, extensions index and calendar. */
export async function getLandingUrls(): Promise<SitemapUrl[]> {
  const [landings, categoryHubs, extensions, calendar] = await Promise.all([
    listIndexableLandings(),
    listIndexableCategoryHubs(),
    getExtensions(),
    hasReleaseDates(),
  ]);
  return [
    ...(extensions.length ? [{ loc: absoluteUrl('/extensions') }] : []),
    ...(calendar ? [{ loc: absoluteUrl('/calendrier-des-sorties') }] : []),
    ...landings.map(fromEntry),
    ...categoryHubs.map(fromEntry),
  ];
}

/** Guides, glossary terms and their two index pages. */
export async function getContentUrls(): Promise<SitemapUrl[]> {
  const entries = await getAllContent();
  const sections = new Map<ContentSection, Date[]>();
  for (const entry of entries) {
    const section = contentSection(entry.kind);
    sections.set(section, [...(sections.get(section) ?? []), entry.updated]);
  }
  return [
    ...[...sections].map(([section, dates]) => ({
      loc: absoluteUrl(`/${section}`),
      lastModified: latestDate(dates),
    })),
    ...entries.map((entry) => ({
      loc: absoluteUrl(entry.href),
      lastModified: entry.updated,
    })),
  ];
}

// Creation order keeps each product in the same file as the catalogue grows.
const productOrder = [
  { createdAt: 'asc' },
  { id: 'asc' },
] satisfies Prisma.ProductOrderByWithRelationInput[];
const imageOrder = [
  { isPrimary: 'desc' },
  { sortOrder: 'asc' },
  { id: 'asc' },
] satisfies Prisma.ProductImageOrderByWithRelationInput[];

/** Same rule as the product page: published, active parents, ≥ 1 active variant. */
export function countIndexableProducts(): Promise<number> {
  return getPrisma().product.count({ where: visibleProductWhere });
}

/** URLs of products-{page}.xml, with the product's real images. */
export async function getProductUrls(page: number): Promise<SitemapUrl[]> {
  const products = await getPrisma().product.findMany({
    where: visibleProductWhere,
    select: {
      slug: true,
      updatedAt: true,
      variants: { select: { updatedAt: true } },
      images: { select: { url: true, updatedAt: true }, orderBy: imageOrder },
    },
    orderBy: productOrder,
    ...productSitemapRange(page),
  });
  return products.map((product) => ({
    loc: absoluteUrl(`/produit/${encodeURIComponent(product.slug)}`),
    lastModified: latestDate([
      product.updatedAt,
      ...product.variants.map((variant) => variant.updatedAt),
      ...product.images.map((image) => image.updatedAt),
    ]),
    images: product.images
      .map((image) => image.url.trim())
      .filter((url) => url && !isPlaceholderImage(url))
      .map(absoluteUrl),
  }));
}

/** URLs of one child sitemap; null for a product file beyond the last one. */
export async function getSitemapUrls(
  name: SitemapName,
): Promise<SitemapUrl[] | null> {
  switch (name.kind) {
    case 'pages':
      return getPageUrls();
    case 'landings':
      return getLandingUrls();
    case 'content':
      return getContentUrls();
    case 'products':
      return name.page <= productSitemapCount(await countIndexableProducts())
        ? getProductUrls(name.page)
        : null;
  }
}

/** Child sitemaps holding at least one URL, for /sitemap.xml. */
export async function getSitemapFiles(): Promise<SitemapFile[]> {
  const [pages, landings, content, productCount] = await Promise.all([
    getPageUrls(),
    getLandingUrls(),
    getContentUrls(),
    countIndexableProducts(),
  ]);
  const file = (name: SitemapName, urls?: readonly SitemapUrl[]) => ({
    loc: absoluteUrl(sitemapPath(name)),
    // A product file would need a full read for its date: left out.
    lastModified: urls ? latestDate(urls.map((url) => url.lastModified)) : null,
  });
  return [
    file({ kind: 'pages' }, pages),
    ...(landings.length ? [file({ kind: 'landings' }, landings)] : []),
    ...Array.from({ length: productSitemapCount(productCount) }, (_, index) =>
      file({ kind: 'products', page: index + 1 }),
    ),
    ...(content.length ? [file({ kind: 'content' }, content)] : []),
  ];
}
