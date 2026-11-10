import {
  HomeJourney,
  type HomeChapter,
} from '@/components/home/HomeJourney/HomeJourney';
import { CardStory } from '@/components/home/CardStory/CardStory';
import { ScrollScenes } from '@/components/home/ScrollScenes';
import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Hero } from '@/components/home/Hero/Hero';
import { Families } from '@/components/home/Families/Families';
import { Showcase } from '@/components/home/Showcase/Showcase';
import { Collections } from '@/components/home/Collections/Collections';
import { HomeShop } from '@/components/home/HomeShop/HomeShop';
import { Assurances } from '@/components/home/Assurances/Assurances';
import { Journal } from '@/components/home/Journal/Journal';
import { FinalCall } from '@/components/home/FinalCall/FinalCall';
import {
  distinctSections,
  getHomeData,
  getHomeDescription,
} from '@/components/home/homeData';
import { DEFAULT_TITLE } from '@/components/layout/siteMetadata';
import { JsonLd } from '@/components/seo/JsonLd';
import {
  getMerchandisingProducts,
  getLastPiecesProducts,
  getRestockedProducts,
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
// Product shelves lead into one immersive card scene. Buying advice lives
// in the journal; the complete world and its territories live in /univers.
const SHELF = 4;
const SELECTION = 2;

export default async function HomePage() {
  await connection();
  // Editorial choices stay separate from timed, stock-backed shelves.
  // Read extra candidates to avoid repeating cards between shelves.
  const [home, featuredProducts, newProducts, restockProducts, lastProducts] =
    await Promise.all([
      getHomeData(),
      getMerchandisingProducts('du-moment', SELECTION, shopProductWhere),
      getMerchandisingProducts(
        'nouveaute-de-la-semaine',
        SHELF * 2,
        shopProductWhere,
      ),
      getRestockedProducts(SHELF * 2, shopProductWhere),
      getLastPiecesProducts(SHELF * 2, shopProductWhere),
    ]);
  // The team's selection is kept whole; the shelves share the rest without
  // ever repeating a card.
  const [selected, newShelf, restockShelf, lastShelf] = distinctSections(
    [featuredProducts, newProducts, restockProducts, lastProducts],
    [SELECTION, SHELF, SHELF, SHELF],
  );
  const latest = newShelf,
    restocked = restockShelf,
    lastPieces = lastShelf;
  const onSale = [latest, restocked, lastPieces].some((list) => list.length);
  const demonstration = process.env.CATALOG_DEMO_MODE === '1';
  const cardSkip = home.collections.length
    ? { href: '#collections', label: 'Voir les extensions' }
    : home.journal
      ? { href: '#journal', label: 'Passer aux guides et actualités' }
      : { href: '#newsletter', label: 'Rejoindre la communauté' };
  const night = '#03140e',
    forest = '#072419',
    paper = '#f6f1e4',
    sand = '#ebe5d7';
  // Keep adjacent product chapters in the same night, then a single
  // immersive passage before the practical reading and community chapters.
  const chapters: HomeChapter[] = [
    {
      key: 'hero',
      content: <Hero links={home.links} />,
      start: night,
      end: night,
    },
  ];
  if (selected.length)
    chapters.push({
      key: 'selection',
      content: (
        <Showcase products={selected} catalogue={home.links.catalogue} />
      ),
      start: forest,
      end: forest,
    });
  if (onSale)
    chapters.push({
      key: 'shop',
      content: (
        <HomeShop
          latest={latest}
          restocked={restocked}
          lastPieces={lastPieces}
        />
      ),
      start: night,
      end: forest,
    });
  if (home.families.length)
    chapters.push({
      key: 'families',
      content: <Families families={home.families} />,
      start: night,
      end: forest,
    });
  chapters.push({
    key: 'card',
    content: <CardStory skipTo={cardSkip} />,
    start: night,
    end: night,
    pinned: true,
    bridge: true,
  });
  if (home.collections.length)
    chapters.push({
      key: 'collections',
      content: <Collections collections={home.collections} />,
      start: paper,
      end: paper,
    });
  if (!demonstration)
    chapters.push({
      key: 'assurances',
      content: <Assurances />,
      start: sand,
      end: sand,
    });
  if (home.journal)
    chapters.push({
      key: 'journal',
      bridge: true,
      content: <Journal journal={home.journal} />,
      start: paper,
      end: paper,
    });
  chapters.push({
    key: 'community',
    content: <FinalCall catalogue={home.links.catalogue} />,
    start: night,
    end: night,
  });
  return (
    <main id="contenu" tabIndex={-1} className={styles.main}>
      <JsonLd data={graph(organizationNode(), websiteNode())} />
      <HomeJourney chapters={chapters} />
      <ScrollScenes />
    </main>
  );
}
