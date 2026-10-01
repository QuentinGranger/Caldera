import type { Metadata } from 'next';
import {
  CatalogResults,
  catalogItemListNode,
  catalogListingMetadata,
  catalogLoadPath,
  loadCatalog,
} from '@/components/catalog/CatalogPage';
import { CatalogShell } from '@/components/catalog/CatalogShell';
import { EmptyState } from '@/components/catalog/EmptyState';
import { ExploreSection } from '@/components/catalog/ExploreSection';
import { EXPLORE_PRODUCTS, VIEWS } from '@/components/catalog/pageCopy';
import { HeroLogo, PageHero } from '@/components/catalog/PageHero';
import { EXTENSIONS_PATH } from '@/components/landing/landingData';
import { LandingFaq } from '@/components/landing/LandingFaq';
import { LandingGuides } from '@/components/landing/LandingGuides';
import { requireStandaloneSet } from '@/components/landing/routes';
import type { SearchParams } from '@/lib/catalog/params';
import { collectionPageNode, faqPageNode, graph } from '@/lib/seo/jsonld';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
};

// A set attached to an active game lives at /{game}/{set}: this route answers
// 308 for it and only renders the sets without game.
export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const view = await requireStandaloneSet((await params).slug, searchParams);
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
  const view = await requireStandaloneSet((await params).slug, searchParams);
  const load = await loadCatalog({
    path: view.path,
    searchParams,
    scope: view.catalogScope,
  });
  const { set } = view;
  const firstPage = load.page === 1;
  const faq = firstPage ? view.faq : [];
  return (
    <CatalogShell
      hero={
        <PageHero
          breadcrumb={view.breadcrumb}
          path={view.path}
          eyebrow="Extension"
          title={set.name}
          lead={set.description ?? `${set.name}, au comptoir de Caldera.`}
          view={{ src: VIEWS.road, frame: 'window', focus: '50% 45%' }}
          action={
            load.total > 0
              ? { href: '#catalogue-resultats', label: EXPLORE_PRODUCTS }
              : undefined
          }
        >
          {set.logoUrl && (
            <HeroLogo src={set.logoUrl} alt={`Logo ${set.name}`} />
          )}
        </PageHero>
      }
      jsonLd={graph(
        collectionPageNode({
          path: catalogLoadPath(load),
          name: set.name,
          description: view.text.description,
          mainEntity: catalogItemListNode(load),
        }),
        faqPageNode(faq),
      )}
    >
      <CatalogResults
        load={load}
        path={view.path}
        emptyState={
          <EmptyState
            title="Aucun produit en ligne pour cette extension"
            actions={[
              { href: EXTENSIONS_PATH, label: 'Voir toutes les extensions' },
            ]}
          />
        }
      />
      <ExploreSection
        eyebrow={set.name}
        title="Continuer l’exploration"
        groups={[
          {
            title: 'Sorties',
            links: [
              { href: EXTENSIONS_PATH, label: 'Voir toutes les extensions' },
            ],
          },
        ]}
        about={
          firstPage && view.editorialHtml
            ? { label: 'Lire la présentation', html: view.editorialHtml }
            : null
        }
      />
      {firstPage && (
        <LandingGuides entries={view.guides} subject={set.name} limit={3} />
      )}
      <LandingFaq entries={faq} subject={set.name} />
    </CatalogShell>
  );
}
