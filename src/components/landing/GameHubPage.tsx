import { CatalogInterlude } from '@/components/catalog/CatalogInterlude';
import {
  CatalogResults,
  catalogItemListNode,
  catalogLoadPath,
  type CatalogLoad,
} from '@/components/catalog/CatalogPage';
import { NewsletterCta } from '@/components/newsletter/NewsletterCta';
import { JsonLd } from '@/components/seo/JsonLd';
import { Container } from '@/components/ui/Container/Container';
import { GUIDES_PATH } from '@/components/editorial/editorial';
import { isShopGame } from '@/lib/catalog/shopGame';
import { collectionPageNode, faqPageNode, graph } from '@/lib/seo/jsonld';
import { GameHero } from './GameHero';
import { GameShortcuts, type ShortcutGroup } from './GameShortcuts';
import { HubReleases } from './HubReleases';
import type { LandingView } from './landingData';
import { LandingEmpty } from './LandingEmpty';
import { LandingFaq } from './LandingFaq';
import { LandingGuides } from './LandingGuides';
import catalogStyles from '@/components/catalog/Catalog.module.scss';

/**
 * /{game}: a shop first. The hero says where you are, the families and the
 * products follow at once (the catalogue's own controls, scoped to the
 * game); then, for whoever wants more, the releases, the shortcuts, a few
 * guides, the questions and the newsletter. The secondary blocks show on
 * the first page only, the shortcuts on every page.
 */
export function GameHubPage({
  view,
  load,
  shortcuts,
  guidesIndexable,
}: {
  view: LandingView;
  load: CatalogLoad;
  shortcuts: readonly ShortcutGroup[];
  /** /guides is indexable: the interlude and « Voir tous les guides ». */
  guidesIndexable: boolean;
}) {
  const firstPage = load.page === 1;
  const faq = firstPage ? view.faq : [];
  const game = view.game;
  const shop = isShopGame([game.slug]);
  return (
    <main
      id="contenu"
      tabIndex={-1}
      className={`${catalogStyles.main} ${catalogStyles.immersive}`}
    >
      <GameHero
        breadcrumb={view.breadcrumb}
        path={view.path}
        eyebrow={view.eyebrow}
        title={view.heading}
        lead={
          shop
            ? `Cartes, boosters, displays et coffrets ${game.name} sélectionnés pour jouer, collectionner et ouvrir.`
            : (view.description ?? `Les produits ${game.name} de Caldera.`)
        }
        explore={load.total > 0 ? '#catalogue-resultats' : undefined}
      />
      <Container>
        <CatalogResults
          load={load}
          path={view.path}
          emptyState={
            <LandingEmpty
              title="Aucun produit en ligne pour le moment"
              links={view.fallbackLinks}
            />
          }
          linkGroups={view.emptyLinkGroups}
          interlude={
            firstPage && guidesIndexable ? (
              <CatalogInterlude
                content={{
                  image: '/assets/images/Rivages.png',
                  eyebrow: 'Guides',
                  title: 'Collectionner autrement',
                  text: `Découvrez les extensions, apprenez à protéger vos cartes et suivez les prochaines sorties ${game.name}.`,
                  link: { href: GUIDES_PATH, label: 'Explorer les guides' },
                }}
              />
            ) : undefined
          }
          newsletter={false}
        />
        {firstPage && <HubReleases view={view} />}
        <GameShortcuts
          game={game.name}
          groups={shortcuts}
          description={shop ? view.description : null}
          editorialHtml={firstPage ? view.editorialHtml : ''}
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
        <NewsletterCta
          eyebrow="Réassorts et nouveautés"
          title="Soyez prévenu quand de nouvelles cartes arrivent"
        >
          {shop
            ? `Recevez les prochains réassorts, sorties et sélections ${game.name}.`
            : 'Recevez les prochains réassorts, sorties et sélections sans avoir à surveiller le catalogue.'}
        </NewsletterCta>
      </Container>
      <JsonLd
        data={graph(
          collectionPageNode({
            path: catalogLoadPath(load),
            name: view.heading,
            description: view.text.description,
            mainEntity: catalogItemListNode(load),
          }),
          faqPageNode(faq),
        )}
      />
    </main>
  );
}
