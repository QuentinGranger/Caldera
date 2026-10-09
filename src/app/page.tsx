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
// The page as a journey: enter the landscape, explore its
// territories, discover what is sold, then daylight for the products, the promises and the reading,
// and dusk for the last call. A section without data is simply absent; the
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
  // In reading order: a product appears once, where it is met first.
  const [selected, latest, restocked] = distinctSections([
    featuredProducts,
    newProducts,
    restockProducts,
  ]);
  return (
    <main id="contenu" tabIndex={-1} className={styles.main}>
      <JsonLd data={graph(organizationNode(), websiteNode())} />
      <Hero links={home.links} next="#territoires" />
      <Territories />
      <Families families={home.families} />
      <Showcase products={selected} catalogue={home.links.catalogue} />
      <div className={styles.dawn} aria-hidden="true" />
      <Collections collections={home.collections} />
      <ProductRail
        latest={latest}
        restocked={restocked.slice(0, 3)}
        newLink={home.links.nouveautes}
        stockLink={home.links['en-stock']}
        demo={isDemoCatalogue([...selected, ...latest, ...restocked])}
      />
      <Assurances />
      <Journal journal={home.journal} />
      <Origins />
      <FinalCall catalogue={home.links.catalogue} />
      <ScrollScenes />
    </main>
  );
}
