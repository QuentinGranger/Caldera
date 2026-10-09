import { AisleNav } from '@/components/catalog/AisleNav';
import {
  CatalogInterlude,
  type InterludeContent,
} from '@/components/catalog/CatalogInterlude';
import {
  CatalogResults,
  LIST_ANCHOR,
  catalogItemListNode,
  catalogLoadPath,
  type CatalogLoad,
} from '@/components/catalog/CatalogPage';
import { CatalogShell } from '@/components/catalog/CatalogShell';
import { EmptyState } from '@/components/catalog/EmptyState';
import { ExploreSection } from '@/components/catalog/ExploreSection';
import { LatestProducts } from '@/components/catalog/LatestProducts';
import {
  EXPLORE_PRODUCTS,
  VIEWS,
  type AisleCopy,
} from '@/components/catalog/pageCopy';
import { HeroLogo, HeroSymbol, PageHero } from '@/components/catalog/PageHero';
import { GUIDES_PATH } from '@/components/editorial/editorial';
import { landingPath } from '@/lib/seo/facets';
import { collectionPageNode, faqPageNode, graph } from '@/lib/seo/jsonld';
import type { SeoLink, SeoLinkGroup } from '@/lib/seo/types';
import type { CatalogProduct } from '@/types/product';
import {
  CALENDAR_PATH,
  EXTENSIONS_PATH,
  type LandingView,
} from './landingData';
import { PokemonHero } from './PokemonHero';
import { LandingFaq } from './LandingFaq';
import { LandingGuides } from './LandingGuides';

/** Fewer latest products than this would say little: no row. */
const LATEST_MIN = 4;

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
  up,
  latest = [],
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
  /** The parent family's page, for a visible way up. */
  up?: SeoLink | null;
  /** The latest products, for an aisle that shows them (copy.latest). */
  latest?: readonly CatalogProduct[];
}) {
  const immersive = view.path === '/pokemon/scelles';
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
      world={immersive ? 'sealed' : undefined}
      motionKey={`${view.path}?${load.query}`}
      hero={
        immersive ? (
          <PokemonHero
            kind="sealed"
            title={view.heading}
            eyebrow={copy?.eyebrow ?? view.eyebrow}
            lead={copy?.lead ?? view.description ?? view.heading}
            breadcrumb={view.breadcrumb}
            path={view.path}
            product={load.result.products[0]}
            hasProducts={load.total > 0}
          />
        ) : (
          <PageHero
            breadcrumb={view.breadcrumb}
            path={view.path}
            eyebrow={copy?.eyebrow ?? view.eyebrow}
            up={up ?? undefined}
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
              mobileFocus: copy?.mobileFocus,
              mobileZoom: copy?.mobileZoom,
              desktopHeight: copy?.desktopHeight,
            }}
            action={
              load.total > 0
                ? { href: '#catalogue-resultats', label: EXPLORE_PRODUCTS }
                : undefined
            }
          >
            {view.logo && <HeroLogo src={view.logo.url} alt={view.logo.alt} />}
            {view.symbol && (
              <HeroSymbol src={view.symbol.url} alt={view.symbol.alt} />
            )}
          </PageHero>
        )
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
        world={immersive}
        heading={immersive ? 'Les produits scellés.' : undefined}
        load={load}
        path={view.path}
        nav={
          aisles.length ? (
            <AisleNav aisles={aisles} current={view.path} />
          ) : undefined
        }
        browse={copy?.browse}
        // The first view of the aisle only: a preview, never in a search.
        above={
          copy?.latest &&
          firstPage &&
          !load.hasRefinements &&
          latest.length >= LATEST_MIN ? (
            <LatestProducts
              title={copy.latest.title}
              products={latest}
              all={{
                href: `#${LIST_ANCHOR}`,
                label: copy.latest.all,
              }}
            />
          ) : undefined
        }
        card={copy?.card}
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
