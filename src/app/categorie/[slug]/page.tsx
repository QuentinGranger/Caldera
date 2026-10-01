import type { Metadata } from 'next';
import { AisleNav } from '@/components/catalog/AisleNav';
import { CatalogInterlude } from '@/components/catalog/CatalogInterlude';
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
import {
  EXPLORE_PRODUCTS,
  VIEWS,
  categoryCopy,
} from '@/components/catalog/pageCopy';
import { PageHero } from '@/components/catalog/PageHero';
import { teaserContent } from '@/components/catalog/teaser';
import { getGuidesIndex } from '@/components/editorial/content';
import { GUIDES_PATH } from '@/components/editorial/editorial';
import { LandingFaq } from '@/components/landing/LandingFaq';
import { LandingGuides } from '@/components/landing/LandingGuides';
import { requireCategoryHub } from '@/components/landing/routes';
import { inSentence } from '@/components/landing/landingText';
import type { SearchParams } from '@/lib/catalog/params';
import { collectionPageNode, faqPageNode, graph } from '@/lib/seo/jsonld';
import { getShopAisles } from '@/lib/seo/links';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
};

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const view = await requireCategoryHub((await params).slug, searchParams);
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

/**
 * /categorie/{slug}: a family across the shop (accessories for every game).
 * The same system as the game's aisles, its own words and view.
 */
export default async function Page({ params, searchParams }: Props) {
  const { slug } = await params;
  const view = await requireCategoryHub(slug, searchParams);
  const copy = categoryCopy(slug);
  const [load, aisles, teaser, guides] = await Promise.all([
    loadCatalog({ path: view.path, searchParams, scope: view.catalogScope }),
    getShopAisles(),
    teaserContent(copy?.teaser),
    getGuidesIndex(),
  ]);
  const firstPage = load.page === 1;
  const faq = firstPage ? view.faq : [];
  return (
    <CatalogShell
      hero={
        <PageHero
          breadcrumb={view.breadcrumb}
          path={view.path}
          eyebrow={copy?.eyebrow ?? 'Famille de produits'}
          title={view.heading}
          lead={
            copy?.lead ??
            view.description ??
            `Les ${inSentence(view.name)} de Caldera, pour tous les jeux.`
          }
          view={{
            src: VIEWS.archives,
            frame: 'window',
            focus: copy?.focus ?? '50% 45%',
          }}
          action={
            load.total > 0
              ? { href: '#catalogue-resultats', label: EXPLORE_PRODUCTS }
              : undefined
          }
        />
      }
      jsonLd={graph(
        collectionPageNode({
          path: catalogLoadPath(load),
          name: view.heading,
          description: view.text.description,
          mainEntity: catalogItemListNode(load),
        }),
        faqPageNode(faq),
      )}
    >
      <CatalogResults
        load={load}
        path={view.path}
        nav={
          aisles.some((aisle) => aisle.href === view.path) ? (
            <AisleNav aisles={aisles} current={view.path} />
          ) : undefined
        }
        emptyState={
          <EmptyState
            title="Aucun produit en ligne dans cette famille"
            actions={[{ href: '/catalogue', label: 'Voir tous les produits' }]}
          />
        }
        interlude={
          firstPage && teaser ? (
            <CatalogInterlude content={teaser} />
          ) : undefined
        }
      />
      <ExploreSection
        eyebrow={view.heading}
        title="Continuer l’exploration"
        lead={copy ? view.description : null}
        groups={view.linkGroups}
        about={
          firstPage && view.editorialHtml
            ? { label: 'Lire la présentation', html: view.editorialHtml }
            : null
        }
      />
      {firstPage && (
        <LandingGuides
          entries={view.guides.filter(
            (entry) => entry.href !== teaser?.link.href,
          )}
          subject={view.heading}
          limit={3}
          more={
            guides.decision.index
              ? { href: GUIDES_PATH, label: 'Voir tous les guides' }
              : undefined
          }
        />
      )}
      <LandingFaq entries={faq} subject={view.heading} />
    </CatalogShell>
  );
}
