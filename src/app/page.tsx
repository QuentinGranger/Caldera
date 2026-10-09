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
// then reassurance, reading and the brand universe before the last call.
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
    : latest.length || restocked.length
      ? '#nouveautes'
      : selected.length
        ? '#selection'
        : home.collections.length
          ? '#collections'
          : '#territoires';
  return (
    <main id="contenu" tabIndex={-1} className={styles.main}>
      <JsonLd data={graph(organizationNode(), websiteNode())} />
      <Hero links={home.links} next={firstSection} />
      <Families families={home.families} />
      <div className={styles.dawn} aria-hidden="true" />
      <ProductRail
        latest={latest}
        restocked={restocked.slice(0, 3)}
        newLink={home.links.nouveautes}
        stockLink={home.links['en-stock']}
        demo={isDemoCatalogue([...selected, ...latest, ...restocked])}
      />
      <Showcase products={selected} catalogue={home.links.catalogue} />
      <Collections collections={home.collections} />
      <Assurances />
      <Journal journal={home.journal} />
      <div className={styles.dusk} aria-hidden="true" />
      <Territories />
      <Origins />
      <FinalCall catalogue={home.links.catalogue} />
      <ScrollScenes />
    </main>
  );
}
