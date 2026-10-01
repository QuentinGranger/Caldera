import type { Metadata } from 'next';
import {
  catalogListingMetadata,
  loadCatalog,
} from '@/components/catalog/CatalogPage';
import { shopAisleCopy } from '@/components/catalog/pageCopy';
import { teaserContent } from '@/components/catalog/teaser';
import { getGuidesIndex } from '@/components/editorial/content';
import { LandingPage } from '@/components/landing/LandingPage';
import { requireLandingView } from '@/components/landing/routes';
import type { SearchParams } from '@/lib/catalog/params';
import { isShopGame } from '@/lib/catalog/shopGame';
import { getLandingLinks, getShopAisles } from '@/lib/seo/links';

type Props = {
  params: Promise<{ game: string; facets: string[] }>;
  searchParams: Promise<SearchParams>;
};

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
  const [load, linkGroups, aisles, teaser, guides] = await Promise.all([
    loadCatalog({ path: view.path, searchParams, scope: view.catalogScope }),
    getLandingLinks(view.scope),
    family ? getShopAisles() : [],
    teaserContent(copy?.teaser),
    getGuidesIndex(),
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
    />
  );
}
