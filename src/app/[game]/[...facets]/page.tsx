import type { Metadata } from 'next';
import {
  catalogListingMetadata,
  loadCatalog,
} from '@/components/catalog/CatalogPage';
import { LandingPage } from '@/components/landing/LandingPage';
import { requireLandingView } from '@/components/landing/routes';
import type { SearchParams } from '@/lib/catalog/params';
import { getLandingLinks } from '@/lib/seo/links';

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
  const [load, linkGroups] = await Promise.all([
    loadCatalog({ path: view.path, searchParams, scope: view.catalogScope }),
    getLandingLinks(view.scope),
  ]);
  return <LandingPage view={view} load={load} linkGroups={linkGroups} />;
}
