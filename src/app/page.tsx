import type { Metadata } from 'next';
import { Hero } from '@/components/home/Hero/Hero';
import { CategoryGrid } from '@/components/home/CategoryGrid/CategoryGrid';
import { FeaturedProducts } from '@/components/home/FeaturedProducts/FeaturedProducts';
import { EditorialSection } from '@/components/home/EditorialSection/EditorialSection';
import { Collections } from '@/components/home/Collections/Collections';
import { RestockSection } from '@/components/home/RestockSection/RestockSection';
import { Newsletter } from '@/components/home/Newsletter/Newsletter';
import { connection } from 'next/server';
import {
  getNewProducts,
  getFeaturedProducts,
  getRestockedProducts,
  getHomeCategories,
  getCollections,
} from '@/lib/catalog/queries';
import styles from './page.module.scss';
export const metadata: Metadata = {
  title: 'Les Terres de Caldera — Pokémon & Cartes à collectionner',
  description:
    'Découvrez Les Terres de Caldera, une boutique dédiée aux cartes, coffrets et produits de collection Pokémon.',
  alternates: { canonical: '/' },
  openGraph: {
    url: '/',
    title: 'Les Terres de Caldera — Pokémon & Cartes à collectionner',
    description:
      'Cartes, coffrets et objets de collection sélectionnés pour les passionnés.',
    locale: 'fr_FR',
    type: 'website',
  },
};
export default async function HomePage() {
  await connection();
  const [
    newProducts,
    selectedProducts,
    restockProducts,
    categories,
    collections,
  ] = await Promise.all([
    getNewProducts(4),
    getFeaturedProducts(2),
    getRestockedProducts(3),
    getHomeCategories(),
    getCollections(),
  ]);
  return (
    <main id="contenu" tabIndex={-1} className={styles.main}>
      <Hero />
      <CategoryGrid categories={categories} />
      <FeaturedProducts products={newProducts} />
      <FeaturedProducts products={selectedProducts} editorial />
      <EditorialSection />
      <Collections collections={collections} />
      <RestockSection products={restockProducts} />
      <Newsletter />
    </main>
  );
}
