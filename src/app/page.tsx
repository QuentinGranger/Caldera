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
import { ProductRail } from '@/components/home/ProductRail/ProductRail';
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
  getNewProducts,
  getFeaturedProducts,
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
// Commercial journey: discover the families and available products first,
// then reassurance, guides, origins and territories before the last call.
// A section without data is simply absent; the
// products are those of the licence sold (shopProductWhere).
export default async function HomePage() {
  await connection();
  const [home, newProducts, featuredProducts, restockProducts] =
    await Promise.all([
      getHomeData(),
      getNewProducts(4, shopProductWhere),
      getFeaturedProducts(2, shopProductWhere),
      getRestockedProducts(4, shopProductWhere),
    ]);
  // Reserve the team's selection, then distribute the remaining products
  // between new arrivals and restocks without repeating a card.
  const [selected, latest, restocked] = distinctSections([
    featuredProducts,
    newProducts,
    restockProducts,
  ]);
  const firstSection = home.families.length
    ? '#familles'
    : selected.length
      ? '#selection'
      : latest.length || restocked.length
        ? '#nouveautes'
        : home.collections.length
          ? '#collections'
          : '#territoires';
  const night = '#03140e',
    forest = '#072419',
    paper = '#f6f1e4',
    sand = '#ebe5d7';
  const chapters: HomeChapter[] = [
    {
      key: 'hero',
      content: <Hero links={home.links} next={firstSection} />,
      start: night,
      end: night,
      pinned: true,
    },
  ];
  if (home.families.length)
    chapters.push({
      key: 'families',
      content: <Families families={home.families} />,
      start: night,
      end: forest,
    });
  if (selected.length)
    chapters.push(
      {
        key: 'card',
        content: <CardStory />,
        start: night,
        end: night,
        pinned: true,
      },
      {
        key: 'selection',
        content: (
          <Showcase products={selected} catalogue={home.links.catalogue} />
        ),
        start: forest,
        end: forest,
      },
    );
  if (latest.length || restocked.length)
    chapters.push({
      key: 'new',
      content: (
        <ProductRail
          latest={latest}
          restocked={restocked.slice(0, 3)}
          newLink={home.links.nouveautes}
          stockLink={home.links['en-stock']}
          demo={isDemoCatalogue([...selected, ...latest, ...restocked])}
        />
      ),
      start: paper,
      end: paper,
    });
  if (home.collections.length)
    chapters.push({
      key: 'collections',
      content: <Collections collections={home.collections} />,
      start: paper,
      end: paper,
    });
  chapters.push({
    key: 'assurances',
    content: <Assurances />,
    start: sand,
    end: sand,
  });
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
