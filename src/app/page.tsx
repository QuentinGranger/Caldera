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
  homeCopy,
  isDemoCatalogue,
} from '@/components/home/homeData';
import { DEFAULT_TITLE } from '@/components/layout/siteMetadata';
import { JsonLd } from '@/components/seo/JsonLd';
import { getListingHub } from '@/components/catalog/listingHub';
import {
  getNewProducts,
  getFeaturedProducts,
  getRestockedProducts,
} from '@/lib/catalog/queries';
import { graph, organizationNode, websiteNode } from '@/lib/seo/jsonld';
import { buildMetadata } from '@/lib/seo/metadata';
import styles from './page.module.scss';
export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const hub = await getListingHub('catalogue');
  return buildMetadata({
    title: DEFAULT_TITLE,
    absoluteTitle: true,
    description: homeCopy(hub).description,
    path: '/',
    index: true,
  });
}
// The page as a journey: enter the landscape, see what is sold, explore the
// territories, then daylight for the products, the promises and the reading,
// and dusk for the last call. A section without data is simply absent.
export default async function HomePage() {
  await connection();
  const [home, newProducts, featuredProducts, restockProducts] =
    await Promise.all([
      getHomeData(),
      getNewProducts(4),
      getFeaturedProducts(2),
      getRestockedProducts(4),
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
      <Hero
        copy={home.copy}
        links={home.links}
        stats={home.hub.stats}
        next={home.families.length ? '#familles' : '#territoires'}
      />
      <Families families={home.families} total={home.hub.stats.productCount} />
      <Showcase products={selected} catalogue={home.links.catalogue} />
      <Territories />
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
      <FinalCall catalogue={home.links.catalogue} />
    </main>
  );
}
