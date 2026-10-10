import { ProductCard } from '@/components/product/ProductCard/ProductCard';
import { SectionTitle } from '@/components/ui/SectionTitle/SectionTitle';
import type { CatalogProduct } from '@/types/product';
import styles from './RelatedProducts.module.scss';
export function RelatedProducts({
  products,
  id = 'related-title',
  eyebrow = 'Poursuivre l’exploration',
  title = 'À découvrir également',
  description,
  tone = 'day',
}: {
  products: CatalogProduct[];
  tone?: 'day' | 'night';
  /** Id of the heading, also usable as an in-page anchor. */
  id?: string;
  eyebrow?: string;
  title?: string;
  description?: string;
}) {
  if (!products.length) return null;
  return (
    <section className={styles.section} aria-labelledby={id}>
      <SectionTitle
        id={id}
        eyebrow={eyebrow}
        title={title}
        description={description}
      />
      <div className={styles.grid}>
        {products.map((product) => (
          <ProductCard key={product.id} product={product} tone={tone} />
        ))}
      </div>
    </section>
  );
}
