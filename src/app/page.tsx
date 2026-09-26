import type { Metadata } from 'next';
import { Hero } from '@/components/home/Hero/Hero';
import { CategoryGrid } from '@/components/home/CategoryGrid/CategoryGrid';
import { FeaturedProducts } from '@/components/home/FeaturedProducts/FeaturedProducts';
import { EditorialSection } from '@/components/home/EditorialSection/EditorialSection';
import { Collections } from '@/components/home/Collections/Collections';
import { RestockSection } from '@/components/home/RestockSection/RestockSection';
import { Newsletter } from '@/components/home/Newsletter/Newsletter';
import { getHomeData, homeCopy } from '@/components/home/homeData';
import { DEFAULT_TITLE } from '@/components/layout/siteMetadata';
import { JsonLd } from '@/components/seo/JsonLd';
import { getListingHub } from '@/components/catalog/listingHub';
import { connection } from 'next/server';
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
export default async function HomePage() {
  await connection();
  const [home, newProducts, selectedProducts, restockProducts] =
    await Promise.all([
      getHomeData(),
      getNewProducts(4),
      getFeaturedProducts(2),
      getRestockedProducts(3),
    ]);
  return (
    <main id="contenu" tabIndex={-1} className={styles.main}>
      <JsonLd data={graph(organizationNode(), websiteNode())} />
      <Hero
        copy={home.copy}
        links={home.links}
        familiesAnchor={home.families.length > 0}
      />
      <CategoryGrid
        families={home.families}
        total={home.hub.stats.productCount}
      />
      <FeaturedProducts products={newProducts} link={home.links.nouveautes} />
      <FeaturedProducts products={selectedProducts} editorial />
      <EditorialSection />
      <Collections collections={home.collections} />
      <RestockSection
        products={restockProducts}
        link={home.links['en-stock']}
      />
      <Newsletter />
    </main>
  );
}
