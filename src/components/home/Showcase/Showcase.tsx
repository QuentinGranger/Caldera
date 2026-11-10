import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { ProductCard } from '@/components/product/ProductCard/ProductCard';
import type { CatalogProduct } from '@/types/product';
import { merchandisingPath } from '@/lib/catalog/merchandising';
import styles from './Showcase.module.scss';

/**
 * The Caldera selection, the last shelf of the shop: the team's picks shown
 * like pieces in a cabinet, lit, few, with their real price, their stock
 * and a button to buy. Absent when nothing is selected.
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
    <>
      <section
        id="selection"
        className={styles.section}
        aria-labelledby="selection-title"
        data-scroll-scene="selection"
      >
        <div className={styles.inner}>
          <header className={styles.story}>
            <div>
              <p className={styles.eyebrow}>Choisi par Caldera</p>
              <h2 id="selection-title">
                Sélection <em>du moment.</em>
              </h2>
            </div>
            <div className={styles.intro}>
              {catalogue && (
                <Link
                  href={merchandisingPath('du-moment')}
                  className={styles.link}
                  aria-label="Voir toute la sélection"
                >
                  Tout voir <ArrowRight size={16} aria-hidden="true" />
                </Link>
              )}
            </div>
          </header>
          <ul
            id="selection-produits"
            className={styles.pieces}
            data-count={products.length}
          >
            {products.map((product) => (
              <li key={product.id}>
                <ProductCard
                  product={product}
                  tone="night"
                  layout="spotlight"
                  sizes="(min-width: 1440px) 640px, (min-width: 768px) 46vw, 92vw"
                  buy
                />
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
