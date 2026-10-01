import type { Metadata } from 'next';
import {
  catalogListingMetadata,
  loadCatalog,
} from '@/components/catalog/CatalogPage';
import { getIndexableListings } from '@/components/catalog/listingHub';
import { getGuidesIndex } from '@/components/editorial/content';
import { GameHubPage } from '@/components/landing/GameHubPage';
import { requireLandingView } from '@/components/landing/routes';
import type { SearchParams } from '@/lib/catalog/params';
import {
  STATUS_LABELS,
  STATUS_SLUGS,
  statusListingPath,
} from '@/lib/seo/facets';
import { getGameHubShortcuts } from '@/lib/seo/links';
import type { SeoLink } from '@/lib/seo/types';

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
  const [load, shortcuts, listings, guides] = await Promise.all([
    loadCatalog({ path: view.path, searchParams, scope: view.catalogScope }),
    getGameHubShortcuts(view.scope.game),
    getIndexableListings(),
    getGuidesIndex(),
  ]);
  // A status without its own page for the game (every product of the
  // status is of this game, or too few) leads to the shop's listing.
  const availability = STATUS_SLUGS.flatMap((status): SeoLink[] => {
    const own = shortcuts.statuses[status];
    if (own) return [own];
    return listings.has(status)
      ? [{ href: statusListingPath(status), label: STATUS_LABELS[status] }]
      : [];
  });
  return (
    <GameHubPage
      view={view}
      load={load}
      shortcuts={[
        { title: 'Explorer par format', links: shortcuts.formats },
        { title: 'Acheter par langue', links: shortcuts.languages },
        { title: 'Disponibilité', links: availability },
      ]}
      guidesIndexable={guides.decision.index}
    />
  );
}
