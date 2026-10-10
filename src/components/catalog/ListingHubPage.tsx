import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { preordersEnabled } from '@/lib/catalog/preorders';
import { catalogFallback } from '@/components/landing/routes';
import { connection } from 'next/server';
import { listingPageText } from '@/lib/catalog/metadata';
import type { SearchParams } from '@/lib/catalog/params';
import { collectionPageNode, graph } from '@/lib/seo/jsonld';
import type { ListingKind } from '@/lib/seo/metadata';
import { catalogItemListNode, catalogLoadPath } from './catalogLoad';
import { CatalogInterlude } from './CatalogInterlude';
import {
  CatalogResults,
  catalogListingMetadata,
  loadCatalog,
} from './CatalogPage';
import { CatalogShell } from './CatalogShell';
import { EmptyState } from './EmptyState';
import { ExploreSection } from './ExploreSection';
import {
  LISTING_HUBS,
  getListingHub,
  getListingHubLinks,
  listingScope,
} from './listingHub';
import { EXPLORE_PRODUCTS, LISTING_COPY } from './pageCopy';
import { HeroRange, PageHero } from './PageHero';

/** The counter's range, in the shop's words and order. */
const COUNTER_FAMILIES = [
  ['scelles', 'Produits scellés'],
  ['boosters', 'Boosters'],
  ['displays', 'Displays'],
  ['coffrets', 'Coffrets'],
  ['accessoires', 'Accessoires'],
] as const;

/** The licence sold, then each family once it has products. */
function counterRange(families: readonly { slug: string }[]): string[] {
  const present = new Set(families.map((family) => family.slug));
  return [
    'Pokémon TCG',
    ...COUNTER_FAMILIES.filter(([slug]) => present.has(slug)).map(
      ([, label]) => label,
    ),
  ];
}

/** generateMetadata of a transverse listing. */
export async function listingHubMetadata(
  listing: ListingKind,
  searchParams: Promise<SearchParams>,
): Promise<Metadata> {
  // Rendered per request: no catalog read may start during the build.
  await connection();
  if (listing === 'precommandes' && !preordersEnabled())
    redirect(await catalogFallback());
  const hub = await getListingHub(listing);
  if (!hub.stats.productCount)
    redirect(listing === 'catalogue' ? '/' : await catalogFallback());
  return catalogListingMetadata({
    path: hub.config.path,
    searchParams,
    scope: listingScope(listing),
    title: hub.text.title,
    description: hub.text.description,
    decision: hub.decision,
  });
}

/**
 * /catalogue, /nouveautes, /precommandes, /en-stock: the whole shop seen
 * through one door. The figures stay in the meta description; on the page
 * they live in the interface (count, families, badges).
 */
export async function ListingHubPage({
  listing,
  searchParams,
}: {
  listing: ListingKind;
  searchParams: Promise<SearchParams>;
}) {
  // Before the hub statistics, which would otherwise query during the build.
  await connection();
  if (listing === 'precommandes' && !preordersEnabled())
    redirect(await catalogFallback());
  const config = LISTING_HUBS[listing];
  const copy = LISTING_COPY[listing];
  const [load, hub] = await Promise.all([
    loadCatalog({
      path: config.path,
      searchParams,
      scope: listingScope(listing),
    }),
    getListingHub(listing),
  ]);
  if (!hub.stats.productCount)
    redirect(listing === 'catalogue' ? '/' : await catalogFallback());
  const links = await getListingHubLinks(hub);
  const text = listingPageText(hub.text, load.page);
  const breadcrumb = [
    { label: 'Accueil', href: '/' },
    ...(listing !== 'catalogue' && links.catalogueIndexable
      ? [{ label: LISTING_HUBS.catalogue.label, href: '/catalogue' }]
      : []),
    { label: config.label },
  ];
  return (
    <CatalogShell
      hero={
        <PageHero
          breadcrumb={breadcrumb}
          path={config.path}
          eyebrow={copy.eyebrow}
          title={copy.title}
          lead={copy.lead}
          note={copy.note}
          view={copy.view}
          action={
            load.total > 0
              ? { href: '#catalogue-resultats', label: EXPLORE_PRODUCTS }
              : undefined
          }
        >
          {listing === 'catalogue' && (
            <HeroRange
              items={counterRange(load.facets.categories)}
              label="Au comptoir"
            />
          )}
        </PageHero>
      }
      jsonLd={graph(
        collectionPageNode({
          path: catalogLoadPath(load),
          name: text.title,
          description: text.description,
          mainEntity: catalogItemListNode(load),
        }),
      )}
    >
      <CatalogResults
        load={load}
        path={config.path}
        emptyState={
          <EmptyState
            title={config.emptyTitle}
            text={
              links.fallback.length
                ? 'Ces sélections contiennent des produits :'
                : 'La lettre ci-dessous prévient des premières mises en ligne.'
            }
            actions={links.fallback}
          />
        }
        // Once, on the first page: whoever is shopping scrolls past it.
        interlude={
          listing === 'catalogue' && load.page === 1 ? (
            <CatalogInterlude />
          ) : undefined
        }
      />
      <ExploreSection
        eyebrow={copy.title}
        title="Continuer l’exploration"
        groups={links.groups}
      />
    </CatalogShell>
  );
}
