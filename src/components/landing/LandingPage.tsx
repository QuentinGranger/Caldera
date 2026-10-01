import { AisleNav } from '@/components/catalog/AisleNav';
import {
  CatalogInterlude,
  type InterludeContent,
} from '@/components/catalog/CatalogInterlude';
import {
  CatalogResults,
  catalogItemListNode,
  catalogLoadPath,
  type CatalogLoad,
} from '@/components/catalog/CatalogPage';
import { CatalogShell } from '@/components/catalog/CatalogShell';
import { EmptyState } from '@/components/catalog/EmptyState';
import { ExploreSection } from '@/components/catalog/ExploreSection';
import {
  EXPLORE_PRODUCTS,
  VIEWS,
  type AisleCopy,
} from '@/components/catalog/pageCopy';
import { HeroLogo, PageHero } from '@/components/catalog/PageHero';
import { GUIDES_PATH } from '@/components/editorial/editorial';
import { landingPath } from '@/lib/seo/facets';
import { collectionPageNode, faqPageNode, graph } from '@/lib/seo/jsonld';
import type { SeoLink, SeoLinkGroup } from '@/lib/seo/types';
import {
  CALENDAR_PATH,
  EXTENSIONS_PATH,
  type LandingView,
} from './landingData';
import { LandingFaq } from './LandingFaq';
import { LandingGuides } from './LandingGuides';

const EMPTY_TITLES: Partial<Record<LandingView['kind'], string>> = {
  set: 'Aucun produit en ligne pour cette extension',
  category: 'Aucun produit en ligne dans cette famille',
};

/**
 * /{game}/{facets}: an aisle of the game. The hero (its own words for the
 * shop's families), the aisles and the products at once; then a guide
 * between the rows, where to go next, a few guides and the questions.
 * Secondary blocks show on the first page only.
 */
export function LandingPage({
  view,
  load,
  linkGroups,
  aisles,
  copy,
  teaser,
  guidesIndexable,
}: {
  view: LandingView;
  load: CatalogLoad;
  linkGroups: readonly SeoLinkGroup[];
  /** The shop's aisles, for its game's families; empty otherwise. */
  aisles: readonly SeoLink[];
  /** The aisle's own words, for the shop's families. */
  copy?: AisleCopy;
  teaser: InterludeContent | null;
  guidesIndexable: boolean;
}) {
  const firstPage = load.page === 1;
  const faq = firstPage ? view.faq : [];
  const game = view.game;
  const releases: SeoLinkGroup[] = view.setPaths.size
    ? [
        {
          title: 'Sorties',
          links: [
            { href: EXTENSIONS_PATH, label: 'Voir toutes les extensions' },
            ...(view.calendarIndexable
              ? [{ href: CALENDAR_PATH, label: 'Calendrier des sorties' }]
              : []),
          ],
        },
      ]
    : [];
  return (
    <CatalogShell
      hero={
        <PageHero
          breadcrumb={view.breadcrumb}
          path={view.path}
          eyebrow={copy?.eyebrow ?? view.eyebrow}
          title={view.heading}
          lead={
            copy?.lead ??
            view.description ??
            `${view.heading}, au comptoir de Caldera.`
          }
          view={{
            src: VIEWS.forest,
            frame: 'window',
            focus: copy?.focus ?? '50% 45%',
          }}
          action={
            load.total > 0
              ? { href: '#catalogue-resultats', label: EXPLORE_PRODUCTS }
              : undefined
          }
        >
          {view.logo && <HeroLogo src={view.logo.url} alt={view.logo.alt} />}
        </PageHero>
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
        browse={copy?.browse}
        emptyState={
          <EmptyState
            title={
              EMPTY_TITLES[view.kind] ?? 'Aucun produit en ligne pour le moment'
            }
            text={view.fallbackLinks.length ? 'À consulter aussi :' : undefined}
            actions={view.fallbackLinks}
          />
        }
        interlude={
          firstPage && teaser ? (
            <CatalogInterlude content={teaser} />
          ) : undefined
        }
        widest={{
          href: landingPath({ game: view.scope.game }),
          label: `Voir tous les produits ${game.name}`,
        }}
      />
      <ExploreSection
        eyebrow={view.heading}
        title="Continuer l’exploration"
        // The aisle's own words above: the admin's summary comes here.
        lead={copy ? view.description : null}
        groups={[...linkGroups, ...releases, ...view.emptyLinkGroups]}
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
