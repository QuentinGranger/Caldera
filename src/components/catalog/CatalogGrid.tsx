import { Fragment, type ReactNode } from 'react';
import { ProductCard } from '@/components/product/ProductCard/ProductCard';
import type { CatalogProduct } from '@/types/product';
import styles from './Catalog.module.scss';

/** Products before the interlude: two rows on wide screens, four on phones. */
const BEFORE_INTERLUDE = 8;

/**
 * A regular grid, for comparing at a glance. `interlude` takes a whole row
 * after the first products, only when more follow it.
 */
export function CatalogGrid({
  products,
  interlude,
}: {
  products: CatalogProduct[];
  interlude?: ReactNode;
}) {
  const breaks = interlude && products.length > BEFORE_INTERLUDE;
  return (
    <div className={styles.grid}>
      {products.map((product, index) => (
        <Fragment key={product.id}>
          {breaks && index === BEFORE_INTERLUDE && (
            <div className={styles.interludeSlot}>{interlude}</div>
          )}
          <div className={styles.item}>
            <ProductCard product={product} />
          </div>
        </Fragment>
      ))}
    </div>
  );
}
