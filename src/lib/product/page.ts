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
import type { IndexDecision, SeoLink } from '@/lib/seo/types';
import type { CatalogProduct } from '@/types/product';
import {
  CATALOGUE_LEVEL,
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

/**
 * Published → page (noindex without an active variant); ARCHIVED → 308 to the
 * best indexable parent; unknown or DRAFT → former slug (SlugRedirect) or 404.
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
    return {
      type: 'redirect',
      path: await archivedTarget(route.product, loadIndex),
    };
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
    return {
      type: 'redirect',
      path: await archivedTarget(current.product, loadIndex),
    };
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
    index: decision.index,
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
  /** Indexable landing of the product's set, if any. */
  setHref: string | null;
  /** Indexable landings around the product (set, families, languages, game). */
  links: SeoLink[];
  glossary: ContentEntry | null;
  guides: ContentEntry[];
  /** Purchasable products first. */
  related: CatalogProduct[];
  shipping: ShippingOptionView[];
  /** Product markup of an indexable page, null otherwise. */
  structuredData: JsonLdGraph | null;
}

export async function loadProductPage(
  product: ProductDetail,
  decision: IndexDecision,
): Promise<ProductPageData> {
  const [index, categories, related, linkGroups, glossary, shipping] =
    await Promise.all([
      getLandingIndex(),
      getCategories(),
      getRelatedProducts(product),
      getProductLinks(product),
      getGlossaryTermForProductType(product.productType),
      getShippingFacts(),
    ]);
  const placement: ProductPlacement = {
    game: product.game,
    set: product.tcgSet
      ? {
          id: product.tcgSet.id,
          slug: product.tcgSet.slug,
          name: product.tcgSet.name,
        }
      : null,
    families: familyLineage(categories, product.categoryInfo.id),
  };
  const parents = productParents(placement, indexablePaths(index));
  const levels = productTrailLevels(parents);
  const [guides, catalogue] = await Promise.all([
    productGuides(product, placement),
    levels.length
      ? null
      : getIndexableListings().then((listings) => listings.has('catalogue')),
  ]);
  const productMarkup = productStructuredData(product, shipping);
  return {
    breadcrumb: productBreadcrumb(
      catalogue ? [CATALOGUE_LEVEL] : levels,
      product.name,
    ),
    setHref: parents.find((parent) => parent.kind === 'set')?.path ?? null,
    links: linkGroups.flatMap((group) => group.links),
    glossary,
    guides,
    related,
    shipping: shippingOptionViews(shipping),
    structuredData:
      decision.index && productMarkup
        ? graph(organizationNode(), productMarkup)
        : null,
  };
}
