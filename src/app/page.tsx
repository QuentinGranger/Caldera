import {
  HomeJourney,
  type HomeChapter,
} from '@/components/home/HomeJourney/HomeJourney';
import { CardStory } from '@/components/home/CardStory/CardStory';
import { Origins } from '@/components/home/Origins/Origins';
import { ScrollScenes } from '@/components/home/ScrollScenes';
import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Hero } from '@/components/home/Hero/Hero';
import { Families } from '@/components/home/Families/Families';
import { Showcase } from '@/components/home/Showcase/Showcase';
import { Territories } from '@/components/home/Territories/Territories';
import { Collections } from '@/components/home/Collections/Collections';
import { HomeShop } from '@/components/home/HomeShop/HomeShop';
import { Reflection } from '@/components/home/Reflection/Reflection';
import { Assurances } from '@/components/home/Assurances/Assurances';
import { Journal } from '@/components/home/Journal/Journal';
import { FinalCall } from '@/components/home/FinalCall/FinalCall';
import {
  distinctSections,
  getHomeData,
  getHomeDescription,
  isDemoCatalogue,
} from '@/components/home/homeData';
import { DEFAULT_TITLE } from '@/components/layout/siteMetadata';
import { JsonLd } from '@/components/seo/JsonLd';
import {
  getLastPiecesProducts,
  getRestockedProducts,
  listProductsAvailableFirst,
} from '@/lib/catalog/queries';
import { shopProductWhere } from '@/lib/catalog/shopGame';
import { graph, organizationNode, websiteNode } from '@/lib/seo/jsonld';
import { buildMetadata } from '@/lib/seo/metadata';
import styles from './page.module.scss';
export async function generateMetadata(): Promise<Metadata> {
  await connection();
  return buildMetadata({
    title: DEFAULT_TITLE,
    absoluteTitle: true,
    description: await getHomeDescription(),
    path: '/',
    index: true,
  });
}
// Selling first: under a hero shorter than the screen, the shop's shelves
// (new, back in stock, last pieces), then the Caldera selection, every card
// with its price, its stock and a button to buy. The families, collections
// and reassurance follow; the universe (its words, the card's story, the
// origins, the territories) comes after. A section without data is simply
// absent; the products are those of the licence sold (shopProductWhere).
const SHELF = 4;
const SELECTION = 2;

export default async function HomePage() {
  await connection();
  // What can be bought now first (in stock or preorder), a sold-out one
  // only to fill a place; more read than shown, so that each shelf stays
  // full once the products are spread out.
  const [home, featuredProducts, newProducts, restockProducts, lastProducts] =
    await Promise.all([
      getHomeData(),
      listProductsAvailableFirst(
        { AND: [{ featured: true }, shopProductWhere] },
        SELECTION,
      ),
      listProductsAvailableFirst(
        { AND: [{ newArrival: true }, shopProductWhere] },
        SHELF * 2,
      ),
      getRestockedProducts(SHELF * 2, shopProductWhere),
      getLastPiecesProducts(SHELF * 2, shopProductWhere),
    ]);
  // The team's selection is kept whole; the shelves share the rest without
  // ever repeating a card.
  const [selected, newShelf, restockShelf, lastShelf] = distinctSections([
    featuredProducts,
    newProducts,
    restockProducts,
    lastProducts,
  ]);
  const latest = newShelf.slice(0, SHELF),
    restocked = restockShelf.slice(0, SHELF),
    lastPieces = lastShelf.slice(0, SHELF);
  const onSale = [latest, restocked, lastPieces].some((list) => list.length);
  const night = '#03140e',
    forest = '#072419',
    paper = '#f6f1e4',
    sand = '#ebe5d7';
  const chapters: HomeChapter[] = [
    {
      key: 'hero',
      content: <Hero links={home.links} />,
      start: night,
      end: night,
    },
  ];
  if (onSale)
    chapters.push({
      key: 'shop',
      content: (
        <HomeShop
          latest={latest}
          restocked={restocked}
          lastPieces={lastPieces}
          links={{
            nouveautes: home.links.nouveautes,
            enStock: home.links['en-stock'],
            catalogue: home.links.catalogue,
          }}
          demo={isDemoCatalogue([
            ...selected,
            ...latest,
            ...restocked,
            ...lastPieces,
          ])}
        />
      ),
      start: paper,
      end: paper,
    });
  if (selected.length)
    chapters.push({
      key: 'selection',
      content: (
        <Showcase products={selected} catalogue={home.links.catalogue} />
      ),
      start: forest,
      end: forest,
    });
  if (home.families.length)
    chapters.push({
      key: 'families',
      content: <Families families={home.families} />,
      start: night,
      end: forest,
    });
  if (home.collections.length)
    chapters.push({
      key: 'collections',
      content: <Collections collections={home.collections} />,
      start: paper,
      end: paper,
    });
  chapters.push(
    {
      key: 'assurances',
      content: <Assurances />,
      start: sand,
      end: sand,
    },
    {
      key: 'reflection',
      content: <Reflection />,
      start: night,
      end: night,
    },
    {
      key: 'card',
      content: <CardStory />,
      start: night,
      end: night,
      pinned: true,
    },
  );
  if (home.journal)
    chapters.push({
      key: 'journal',
      content: <Journal journal={home.journal} />,
      start: paper,
      end: paper,
    });
  chapters.push(
    {
      key: 'origins',
      content: <Origins />,
      start: paper,
      end: night,
    },
    {
      key: 'territories',
      content: <Territories />,
      start: night,
      end: night,
      pinned: true,
    },
    {
      key: 'community',
      content: <FinalCall catalogue={home.links.catalogue} />,
      start: night,
      end: night,
    },
  );
  return (
    <main id="contenu" tabIndex={-1} className={styles.main}>
      <JsonLd data={graph(organizationNode(), websiteNode())} />
      <HomeJourney chapters={chapters} />
      <ScrollScenes />
    </main>
  );
}
