import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { ProductCard } from '@/components/product/ProductCard/ProductCard';
import type { CatalogProduct } from '@/types/product';
import styles from './ProductRail.module.scss';

/**
 * The market of the page: the latest products, then those back in stock.
 * A row to swipe on phones, a grid on wide screens. Absent when empty.
 */
export function ProductRail({
  latest,
  restocked,
  newLink,
  stockLink,
  demo,
}: {
  latest: CatalogProduct[];
  restocked: CatalogProduct[];
  /** /nouveautes while indexable. */
  newLink?: string;
  /** /en-stock while indexable. */
  stockLink?: string;
  /** The products come from the demonstration seed. */
  demo: boolean;
}) {
  if (!latest.length && !restocked.length) return null;
  return (
    <section
      id="nouveautes"
      className={styles.section}
      aria-labelledby={latest.length ? 'new-title' : 'restock-title'}
    >
      <div className={styles.inner}>
        {latest.length > 0 && (
          <>
            <header className={styles.head}>
              <div>
                <p className={styles.eyebrow}>Derniers produits publiés</p>
                <h2 id="new-title">Nouveautés</h2>
              </div>
              {newLink && (
                <Link href={newLink} className={styles.all}>
                  Toutes les nouveautés{' '}
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              )}
            </header>
            <ul className={styles.rail}>
              {latest.map((product) => (
                <li key={product.id} data-journey-item="product">
                  {/* A swiped row on phones: wider cards than the grid. */}
                  <ProductCard
                    product={product}
                    sizes="(min-width: 1200px) 300px, (min-width: 960px) 24vw, (min-width: 768px) 46vw, 72vw"
                  />
                </li>
              ))}
            </ul>
          </>
        )}
        {restocked.length > 0 && (
          <div className={styles.restock}>
            <div className={styles.restockHead}>
              <h3 id="restock-title">De retour sur les terres</h3>
              {stockLink && (
                <Link href={stockLink} className={styles.all}>
                  Tous les produits en stock{' '}
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              )}
            </div>
            <ul className={styles.compact}>
              {restocked.map((product) => (
                <li key={product.id} data-journey-item="product">
                  <ProductCard product={product} compact />
                </li>
              ))}
            </ul>
          </div>
        )}
        {demo && (
          <p className={styles.demo}>
            Aperçu de la boutique · Produits, prix et disponibilités présentés à
            titre de démonstration.
          </p>
        )}
      </div>
    </section>
  );
}
