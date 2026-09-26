import type { Metadata } from 'next';
import {
  catalogListingMetadata,
  loadCatalog,
} from '@/components/catalog/CatalogPage';
import { HubReleases } from '@/components/landing/HubReleases';
import { LandingPage } from '@/components/landing/LandingPage';
import { requireLandingView } from '@/components/landing/routes';
import type { SearchParams } from '@/lib/catalog/params';
import { getGameHubLinks } from '@/lib/seo/links';

type Props = {
  params: Promise<{ game: string }>;
  searchParams: Promise<SearchParams>;
};

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const view = await requireLandingView((await params).game, [], searchParams);
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
  const view = await requireLandingView((await params).game, [], searchParams);
  const [load, groups] = await Promise.all([
    loadCatalog({ path: view.path, searchParams, scope: view.catalogScope }),
    getGameHubLinks(view.scope.game),
  ]);
  // The sets have their own section above the products.
  const linkGroups = groups.filter(
    (group) => !group.links.every((link) => view.setPaths.has(link.href)),
  );
  return (
    <LandingPage view={view} load={load} linkGroups={linkGroups}>
      <HubReleases view={view} />
    </LandingPage>
  );
}
