// Product page (docs/seo-architecture.md §4, §6 and §7): route resolution,
// metadata and the data of the breadcrumb and linking blocks.
import 'server-only';
import type { Metadata } from 'next';
import { cache } from 'react';
import { getIndexableListings } from '@/components/catalog/listingHub';
import {
  getContentForScope,
  getGlossaryTermForProductType,
  type ContentEntry,
  type ContentScope,
} from '@/lib/content';
import { getComplementaryProducts } from '@/lib/catalog/getComplementaryProducts';
import { getRelatedProducts } from '@/lib/catalog/getRelatedProducts';
import {
  getProductRoute,
  type ArchivedProductParents,
  type ProductDetail,
} from '@/lib/catalog/queries';
import { getCategories } from '@/lib/catalog/taxonomy';
import { getPrisma } from '@/lib/db/prisma';
import { decideProductIndexation } from '@/lib/seo/indexation';
import { graph, organizationNode, type JsonLdGraph } from '@/lib/seo/jsonld';
import { getProductLinks } from '@/lib/seo/links';
import { buildMetadata } from '@/lib/seo/metadata';
import { findSlugRedirect } from '@/lib/seo/redirects';
import { getLandingIndex, type LandingIndex } from '@/lib/seo/registry';
import { getShippingFacts } from '@/lib/seo/shipping';
import type { IndexDecision } from '@/lib/seo/types';
import {
  CATALOGUE_LEVEL,
  CATALOGUE_PATH,
  archivedProductTarget,
  familyLineage,
  indexablePaths,
  productBreadcrumb,
  productParents,
  productTrailLevels,
  type ProductPlacement,
  type TrailItem,
} from './navigation';
import {
  productPath,
  productSeoText,
  productShareImage,
  productStructuredData,
} from './seo';
import { shippingOptionViews, type ShippingOptionView } from './services';

export type ProductPageRoute =
  | { type: 'page'; product: ProductDetail; decision: IndexDecision }
  | { type: 'redirect'; path: string }
  // Withdrawn for good, no meaningful parent: 410 from src/proxy.ts.
  | { type: 'gone' }
  | { type: 'not-found' };

type LoadIndex = () => Promise<LandingIndex>;

async function archivedTarget(
  product: ArchivedProductParents,
  loadIndex: LoadIndex,
): Promise<string> {
  const [index, categories] = await Promise.all([loadIndex(), getCategories()]);
  return archivedProductTarget(
    {
      game: product.game,
      set: product.tcgSet,
      families: familyLineage(categories, product.category?.id),
    },
    indexablePaths(index),
  );
}

/** 308 to a meaningful parent; the generic catalogue alone means gone. */
async function archivedRoute(
  product: ArchivedProductParents,
  loadIndex: LoadIndex,
): Promise<ProductPageRoute> {
  const path = await archivedTarget(product, loadIndex);
  return path === CATALOGUE_PATH
    ? { type: 'gone' }
    : { type: 'redirect', path };
}

/**
 * Published → page (noindex without an active variant); ARCHIVED → 308 to the
 * best indexable parent, gone (410) without one; unknown or DRAFT → former
 * slug (SlugRedirect) or 404.
 * `loadIndex` defaults to the cached landing index.
 */
export async function resolveProductRoute(
  slug: string,
  loadIndex: LoadIndex = getLandingIndex,
): Promise<ProductPageRoute> {
  const route = await getProductRoute(slug);
  if (route.state === 'visible' || route.state === 'no-variant')
    return {
      type: 'page',
      product: route.product,
      decision: decideProductIndexation({
        status: 'ACTIVE',
        hasActiveVariant: route.state === 'visible',
        path: productPath(route.product.slug),
      }),
    };
  if (route.state === 'archived')
    return archivedRoute(route.product, loadIndex);
  const redirect = await findSlugRedirect('PRODUCT', slug);
  if (!redirect) return { type: 'not-found' };
  const target = await getPrisma().product.findUnique({
    where: { id: redirect.entityId },
    select: { slug: true },
  });
  if (!target || target.slug === slug) return { type: 'not-found' };
  // One hop: an archived target goes straight to its parent.
  const current = await getProductRoute(target.slug);
  if (current.state === 'missing') return { type: 'not-found' };
  if (current.state === 'archived')
    return archivedRoute(current.product, loadIndex);
  return { type: 'redirect', path: productPath(current.product.slug) };
}

/** Once per request, shared by generateMetadata and the page. */
export const getProductPageRoute = cache((slug: string) =>
  resolveProductRoute(slug),
);

export function productPageMetadata(
  product: ProductDetail,
  decision: IndexDecision,
): Metadata {
  const { title, description } = productSeoText(product);
  return buildMetadata({
    title,
    description,
    path: productPath(product.slug),
    index: !product.isDemonstration && decision.index,
    canonicalPath: decision.canonicalPath,
    image: productShareImage(product),
  });
}

const GUIDE_LIMIT = 3;

/**
 * Guides of the product's game, set and family. Content is matched on exact
 * family slugs: the ancestors are asked in turn, nearest first.
 */
async function productGuides(
  product: ProductDetail,
  placement: ProductPlacement,
): Promise<ContentEntry[]> {
  const base: ContentScope = {
    ...(product.game ? { game: product.game.slug } : {}),
    ...(product.tcgSet ? { set: product.tcgSet.slug } : {}),
  };
  const lists = await Promise.all(
    placement.families.map((family) =>
      getContentForScope({ ...base, category: family.slug }, GUIDE_LIMIT * 2),
    ),
  );
  const seen = new Set<string>();
  return lists
    .flat()
    .filter((entry) => {
      if (entry.kind === 'glossaire' || seen.has(entry.slug)) return false;
      seen.add(entry.slug);
      return true;
    })
    .slice(0, GUIDE_LIMIT);
}

export interface ProductPageData {
  breadcrumb: TrailItem[];
  setHref: string | null;
  shipping: ShippingOptionView[];
  structuredData: JsonLdGraph | null;
}

function placementOf(
  product: ProductDetail,
  categories: Awaited<ReturnType<typeof getCategories>>,
): ProductPlacement {
  return {
    game: product.game,
    set: product.tcgSet,
    families: familyLineage(categories, product.categoryInfo.id),
  };
}

/** Only the facts needed above the fold. Discovery never holds up the product. */
export async function loadProductPage(
  product: ProductDetail,
  decision: IndexDecision,
): Promise<ProductPageData> {
  const [index, categories, shipping] = await Promise.all([
    getLandingIndex(),
    getCategories(),
    getShippingFacts(),
  ]);
  const parents = productParents(
    placementOf(product, categories),
    indexablePaths(index),
  );
  const levels = productTrailLevels(parents);
  const catalogue = levels.length
    ? false
    : (await getIndexableListings()).has('catalogue');
  const productMarkup = productStructuredData(product, shipping);
  return {
    breadcrumb: productBreadcrumb(
      catalogue ? [CATALOGUE_LEVEL] : levels,
      product.name,
    ),
    setHref: parents.find((parent) => parent.kind === 'set')?.path ?? null,
    shipping: shippingOptionViews(shipping),
    structuredData:
      decision.index && productMarkup
        ? graph(organizationNode(), productMarkup)
        : null,
  };
}

/** Shared by the separately streamed alternatives, guides and recommendations. */
export const loadProductDiscovery = cache(async (product: ProductDetail) => {
  const [categories, related, complementary, linkGroups, glossary] =
    await Promise.all([
      getCategories(),
      getRelatedProducts(product),
      getComplementaryProducts(product),
      getProductLinks(product),
      getGlossaryTermForProductType(product.productType),
    ]);
  return {
    links: linkGroups.flatMap((group) => group.links),
    glossary,
    guides: await productGuides(product, placementOf(product, categories)),
    related,
    complementary,
  };
});
