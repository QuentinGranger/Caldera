import type { Metadata } from 'next';
import {
  catalogListingMetadata,
  getLatestProducts,
  loadCatalog,
} from '@/components/catalog/CatalogPage';
import { shopAisleCopy } from '@/components/catalog/pageCopy';
import { teaserContent } from '@/components/catalog/teaser';
import { getGuidesIndex } from '@/components/editorial/content';
import {
  getIndexedPages,
  type LandingView,
} from '@/components/landing/landingData';
import { LandingPage } from '@/components/landing/LandingPage';
import { inSentence } from '@/components/landing/landingText';
import { requireLandingView } from '@/components/landing/routes';
import { getCategories, toCategoryRef } from '@/lib/catalog/taxonomy';
import type { SearchParams } from '@/lib/catalog/params';
import { isShopGame } from '@/lib/catalog/shopGame';
import { landingPath } from '@/lib/seo/facets';
import { getLandingLinks, getShopAisles } from '@/lib/seo/links';
import { categoryHubPath } from '@/lib/seo/registry';
import type { SeoLink } from '@/lib/seo/types';

type Props = {
  params: Promise<{ game: string; facets: string[] }>;
  searchParams: Promise<SearchParams>;
};

/** Products in the latest row of an aisle that asks for one. */
const LATEST = 8;

/**
 * The family a family belongs to, at its canonical page: the game's own when
 * indexable, else the shop-wide one; none when neither is indexable.
 */
async function parentFamily(view: LandingView): Promise<SeoLink | null> {
  const parentId = view.scope.category?.parentId;
  if (!parentId) return null;
  const [categories, indexed] = await Promise.all([
    getCategories(),
    getIndexedPages(),
  ]);
  const parent = categories.find((category) => category.id === parentId);
  if (!parent) return null;
  const label = `Voir tous les ${inSentence(parent.name)}`;
  const own = landingPath({
    game: view.scope.game,
    category: toCategoryRef(parent),
  });
  if (indexed.has(own)) return { href: own, label };
  const hub = categoryHubPath(parent.slug);
  return indexed.has(hub) ? { href: hub, label } : null;
}

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { game, facets } = await params;
  const view = await requireLandingView(game, facets, searchParams);
  return catalogListingMetadata({
    path: view.path,
    searchParams,
    scope: view.catalogScope,
    title: view.text.title,
    description: view.text.description,
    decision: view.decision,
    image: view.image,
  });
}

export default async function Page({ params, searchParams }: Props) {
  const { game, facets } = await params;
  const view = await requireLandingView(game, facets, searchParams);
  // The shop's families are its aisles: their own words, the aisles row.
  const family =
    view.kind === 'category' && isShopGame([view.game.slug])
      ? view.scope.category
      : undefined;
  const copy = family ? shopAisleCopy(family.slug, view.game.name) : undefined;
  const [load, linkGroups, aisles, teaser, guides, up, latest] =
    await Promise.all([
      loadCatalog({ path: view.path, searchParams, scope: view.catalogScope }),
      getLandingLinks(view.scope),
      family ? getShopAisles() : [],
      teaserContent(copy?.teaser),
      getGuidesIndex(),
      copy?.up ? parentFamily(view) : null,
      copy?.latest ? getLatestProducts(view.catalogScope, LATEST) : [],
    ]);
  return (
    <LandingPage
      view={view}
      load={load}
      linkGroups={linkGroups}
      aisles={aisles}
      copy={copy}
      teaser={teaser}
      guidesIndexable={guides.decision.index}
      up={up}
      latest={latest}
    />
  );
}
