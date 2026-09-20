import { ProductCard } from '@/components/product/ProductCard/ProductCard';
import { SectionTitle } from '@/components/ui/SectionTitle/SectionTitle';
import type { CatalogProduct } from '@/types/product';
import styles from './RelatedProducts.module.scss';
export function RelatedProducts({ products }: { products: CatalogProduct[] }) {
  if (!products.length) return null;
  return (
    <section className={styles.section} aria-labelledby="related-title">
      <SectionTitle
        id="related-title"
        eyebrow="Poursuivre l’exploration"
        title="À découvrir également"
      />
      <div className={styles.grid}>
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
