import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { ProductCard } from '@/components/product/ProductCard/ProductCard';
import type { CatalogProduct } from '@/types/product';
import { ALL_PRODUCTS_LABEL } from '@/lib/ux/copy';
import styles from './Showcase.module.scss';

/**
 * The team's selection, shown like pieces in a cabinet: lit, few, with
 * their real price and availability. Absent when nothing is selected.
 */
export function Showcase({
  products,
  catalogue,
}: {
  products: CatalogProduct[];
  /** /catalogue while indexable. */
  catalogue?: string;
}) {
  if (!products.length) return null;
  return (
    <section
      id="selection"
      className={styles.section}
      aria-labelledby="selection-title"
      data-scroll-scene="selection"
    >
      <div className={styles.inner}>
        <header className={styles.story}>
          <div>
            <p className={styles.eyebrow}>Le regard du collectionneur</p>
            <h2 id="selection-title">
              Les trésors <em>de Caldera.</em>
            </h2>
          </div>
          <div className={styles.intro}>
            <p className={styles.lead}>
              Il y a des pièces que l’on cherche. Et celles qui nous trouvent.
            </p>
            <p>
              Mises en avant par l’équipe, avec leur prix et leur disponibilité
              du jour.
            </p>
            {catalogue && (
              <Link href={catalogue} className={styles.link}>
                {ALL_PRODUCTS_LABEL} <ArrowRight size={16} aria-hidden="true" />
              </Link>
            )}
          </div>
        </header>
        <ul className={styles.pieces} data-count={products.length}>
          {products.map((product) => (
            <li key={product.id}>
              <ProductCard
                product={product}
                tone="night"
                layout="spotlight"
                sizes="(min-width: 1440px) 640px, (min-width: 768px) 46vw, 92vw"
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
