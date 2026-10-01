import { AisleNav } from '@/components/catalog/AisleNav';
import { CatalogInterlude } from '@/components/catalog/CatalogInterlude';
import {
  CatalogResults,
  catalogItemListNode,
  catalogLoadPath,
  type CatalogLoad,
} from '@/components/catalog/CatalogPage';
import { CatalogShell } from '@/components/catalog/CatalogShell';
import { EmptyState } from '@/components/catalog/EmptyState';
import { ExploreSection } from '@/components/catalog/ExploreSection';
import { EXPLORE_PRODUCTS, VIEWS } from '@/components/catalog/pageCopy';
import { PageHero } from '@/components/catalog/PageHero';
import { GUIDES_PATH } from '@/components/editorial/editorial';
import { isShopGame } from '@/lib/catalog/shopGame';
import { collectionPageNode, faqPageNode, graph } from '@/lib/seo/jsonld';
import type { SeoLink, SeoLinkGroup } from '@/lib/seo/types';
import { HubReleases } from './HubReleases';
import type { LandingView } from './landingData';
import { LandingFaq } from './LandingFaq';
import { LandingGuides } from './LandingGuides';

/**
 * /{game}: a shop first. The hero says where you are, the aisles and the
 * products follow at once; then, for whoever wants more, the releases, the
 * shortcuts, a few guides, the questions. The secondary blocks show on the
 * first page only, the shortcuts on every page.
 */
export function GameHubPage({
  view,
  load,
  aisles,
  shortcuts,
  guidesIndexable,
}: {
  view: LandingView;
  load: CatalogLoad;
  /** The shop's aisles; empty for another game. */
  aisles: readonly SeoLink[];
  shortcuts: readonly SeoLinkGroup[];
  /** /guides is indexable: the interlude and « Voir tous les guides ». */
  guidesIndexable: boolean;
}) {
  const firstPage = load.page === 1;
  const faq = firstPage ? view.faq : [];
  const game = view.game;
  const shop = isShopGame([game.slug]);
  return (
    <CatalogShell
      hero={
        <PageHero
          breadcrumb={view.breadcrumb}
          path={view.path}
          eyebrow={view.eyebrow}
          title={view.heading}
          lead={
            shop
              ? `Cartes, boosters, displays et coffrets ${game.name} sélectionnés pour jouer, collectionner et ouvrir.`
              : (view.description ?? `Les produits ${game.name} de Caldera.`)
          }
          view={{ src: VIEWS.forest, frame: 'arch', focus: '50% 40%' }}
          action={
            load.total > 0
              ? { href: '#catalogue-resultats', label: EXPLORE_PRODUCTS }
              : undefined
          }
        />
      }
      newsletter={
        shop
          ? `Recevez les prochains réassorts, sorties et sélections ${game.name}.`
          : undefined
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
          aisles.length ? (
            <AisleNav aisles={aisles} current={view.path} />
          ) : undefined
        }
        emptyState={
          <EmptyState
            title="Aucun produit en ligne pour le moment"
            actions={view.fallbackLinks}
          />
        }
        interlude={
          firstPage && guidesIndexable ? (
            <CatalogInterlude
              content={{
                image: VIEWS.shore,
                eyebrow: 'Guides',
                title: 'Collectionner autrement',
                text: `Découvrez les extensions, apprenez à protéger vos cartes et suivez les prochaines sorties ${game.name}.`,
                link: { href: GUIDES_PATH, label: 'Voir tous les guides' },
              }}
            />
          ) : undefined
        }
      />
      {firstPage && <HubReleases view={view} />}
      <ExploreSection
        eyebrow="Raccourcis"
        title={`Explorer ${game.name}`}
        lead={shop ? view.description : null}
        groups={[...shortcuts, ...view.emptyLinkGroups]}
        about={
          firstPage && view.editorialHtml
            ? { label: 'Lire la présentation', html: view.editorialHtml }
            : null
        }
      />
      {firstPage && (
        <LandingGuides
          entries={view.guides}
          subject={view.heading}
          limit={3}
          more={
            guidesIndexable
              ? { href: GUIDES_PATH, label: 'Voir tous les guides' }
              : undefined
          }
        />
      )}
      <LandingFaq entries={faq} subject={view.heading} />
    </CatalogShell>
  );
}
