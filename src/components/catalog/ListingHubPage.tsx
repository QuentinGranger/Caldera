import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Compass } from 'lucide-react';
import { Container } from '@/components/ui/Container/Container';
import { Breadcrumb } from '@/components/ui/Breadcrumb/Breadcrumb';
import { JsonLd } from '@/components/seo/JsonLd';
import { listingPageText } from '@/lib/catalog/metadata';
import type { SearchParams } from '@/lib/catalog/params';
import { LANGUAGE_LABELS, type FacetLanguage } from '@/lib/seo/facets';
import { collectionPageNode, graph } from '@/lib/seo/jsonld';
import { formatEuro, listFr, type ListingKind } from '@/lib/seo/metadata';
import type { SeoLink } from '@/lib/seo/types';
import { catalogItemListNode, catalogLoadPath } from './catalogLoad';
import { CatalogHeader } from './CatalogHeader';
import { CatalogInterlude } from './CatalogInterlude';
import { CatalogueHero } from './CatalogueHero';
import {
  CatalogResults,
  catalogListingMetadata,
  loadCatalog,
} from './CatalogPage';
import {
  LISTING_HUBS,
  getListingHub,
  getListingHubLinks,
  listingScope,
  type ListingHub,
} from './listingHub';
import styles from './Catalog.module.scss';

const plural = (count: number, one: string, many: string) =>
  `${count} ${count > 1 ? many : one}`;

/** « a », « a et b », « a, b et c » with elements. */
function joinNodes(nodes: readonly ReactNode[]): ReactNode {
  return nodes.map((node, index) => (
    <Fragment key={index}>
      {index === 0 ? '' : index === nodes.length - 1 ? ' et ' : ', '}
      {node}
    </Fragment>
  ));
}

function priceRange(min: string | null, max: string | null): string {
  if (!min) return '';
  if (!max || Number(max) <= Number(min)) return ` à ${formatEuro(min)}`;
  return `, de ${formatEuro(min)} à ${formatEuro(max)}`;
}

const COUNT_SUBJECTS: Record<ListingKind, (count: number) => string> = {
  catalogue: (count) => `${plural(count, 'produit', 'produits')} au catalogue`,
  nouveautes: (count) => plural(count, 'nouveauté', 'nouveautés'),
  precommandes: (count) =>
    `${plural(count, 'produit', 'produits')} en précommande`,
  'en-stock': (count) => `${plural(count, 'produit', 'produits')} en stock`,
};

/** Facts of the listing: counts, price range, availability, games, languages. */
function ListingIntro({
  hub,
  gameTargets,
}: {
  hub: ListingHub;
  gameTargets: ReadonlyMap<string, string>;
}) {
  const { stats, games, config } = hub;
  const count = stats.productCount;
  const availability =
    config.status === undefined || config.status === 'nouveautes'
      ? [
          stats.inStockCount > 0 && `${stats.inStockCount} en stock`,
          stats.preorderCount > 0 && `${stats.preorderCount} en précommande`,
        ].filter((part): part is string => Boolean(part))
      : [];
  const gameNodes: ReactNode[] = games.games.map(({ game, count }) => {
    const href = gameTargets.get(game.id);
    return (
      <Fragment key={game.id}>
        {href ? <Link href={href}>{game.name}</Link> : game.name} (
        {plural(count, 'produit', 'produits')})
      </Fragment>
    );
  });
  if (games.gamelessCount)
    gameNodes.push(
      plural(games.gamelessCount, 'produit multi-jeux', 'produits multi-jeux'),
    );
  const languages = stats.languages
    .filter((language): language is FacetLanguage => language !== 'OTHER')
    .map((language) => LANGUAGE_LABELS[language]);
  return (
    <>
      <p>
        {COUNT_SUBJECTS[config.listing](count)}
        {priceRange(stats.minPrice, stats.maxPrice)}.
        {availability.length > 0 &&
          ` Disponibilité : ${availability.join(' et ')}.`}
      </p>
      {(gameNodes.length > 0 || languages.length > 0) && (
        <p>
          {games.games.length > 0 && (
            <>{games.games.length > 1 ? 'Jeux' : 'Jeu'} : </>
          )}
          {gameNodes.length > 0 && <>{joinNodes(gameNodes)}.</>}
          {languages.length > 0 &&
            `${gameNodes.length ? ' ' : ''}${
              languages.length > 1 ? 'Langues' : 'Langue'
            } : ${listFr(languages)}.`}
        </p>
      )}
    </>
  );
}

function ListingEmpty({ title, links }: { title: string; links: SeoLink[] }) {
  return (
    <section className={styles.empty} aria-labelledby="catalogue-vide">
      <Compass size={34} strokeWidth={1.2} aria-hidden="true" />
      <h2 id="catalogue-vide">{title}</h2>
      {links.length > 0 ? (
        <>
          <p>Ces sélections contiennent des produits :</p>
          <div className={styles.emptyActions}>
            {links.map((link) => (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            ))}
          </div>
        </>
      ) : (
        <p>La lettre ci-dessous prévient des premières mises en ligne.</p>
      )}
    </section>
  );
}

/** generateMetadata of a transverse listing. */
export async function listingHubMetadata(
  listing: ListingKind,
  searchParams: Promise<SearchParams>,
): Promise<Metadata> {
  // Rendered per request: no catalog read may start during the build.
  await connection();
  const hub = await getListingHub(listing);
  return catalogListingMetadata({
    path: hub.config.path,
    searchParams,
    scope: listingScope(listing),
    title: hub.text.title,
    description: hub.text.description,
    decision: hub.decision,
  });
}

export async function ListingHubPage({
  listing,
  searchParams,
}: {
  listing: ListingKind;
  searchParams: Promise<SearchParams>;
}) {
  // Before the hub statistics, which would otherwise query during the build.
  await connection();
  const config = LISTING_HUBS[listing];
  const [load, hub] = await Promise.all([
    loadCatalog({
      path: config.path,
      searchParams,
      scope: listingScope(listing),
    }),
    getListingHub(listing),
  ]);
  const links = await getListingHubLinks(hub);
  const text = listingPageText(hub.text, load.page);
  const breadcrumb = [
    { label: 'Accueil', href: '/' },
    ...(listing !== 'catalogue' && links.catalogueIndexable
      ? [{ label: LISTING_HUBS.catalogue.label, href: '/catalogue' }]
      : []),
    { label: config.label },
  ];
  const intro = hub.stats.productCount > 0 && (
    <ListingIntro hub={hub} gameTargets={links.gameTargets} />
  );
  const results = (
    <CatalogResults
      load={load}
      path={config.path}
      emptyState={
        <ListingEmpty title={config.emptyTitle} links={links.fallback} />
      }
      linkGroups={links.groups}
      // Once, on the first page: whoever is shopping scrolls past it.
      interlude={
        listing === 'catalogue' && load.page === 1 ? (
          <CatalogInterlude />
        ) : undefined
      }
    />
  );
  // The whole catalogue opens on a view of Caldera; the other listings keep
  // their plain heading.
  if (listing === 'catalogue')
    return (
      <main
        id="contenu"
        tabIndex={-1}
        className={`${styles.main} ${styles.immersive}`}
      >
        <CatalogueHero
          breadcrumb={breadcrumb}
          path={config.path}
          eyebrow="Le Comptoir"
          title="Tout le catalogue"
          lead={
            'Toute la collection de la boutique, réunie au même comptoir\u00a0: chaque pièce avec son prix et sa disponibilité du jour.'
          }
          facts={intro}
          explore={load.total > 0 ? '#catalogue-resultats' : undefined}
        />
        <Container>{results}</Container>
        <JsonLd
          data={graph(
            collectionPageNode({
              path: catalogLoadPath(load),
              name: text.title,
              description: text.description,
              mainEntity: catalogItemListNode(load),
            }),
          )}
        />
      </main>
    );
  return (
    <main id="contenu" tabIndex={-1} className={styles.main}>
      <Container>
        <Breadcrumb items={breadcrumb} currentPath={config.path} />
        <CatalogHeader title={hub.heading} intro={intro} />
        {results}
      </Container>
      <JsonLd
        data={graph(
          collectionPageNode({
            path: catalogLoadPath(load),
            name: text.title,
            description: text.description,
            mainEntity: catalogItemListNode(load),
          }),
        )}
      />
    </main>
  );
}
