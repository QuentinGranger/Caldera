import { Fragment, type ReactNode } from 'react';
import { ProductCard } from '@/components/product/ProductCard/ProductCard';
import type { CatalogProduct } from '@/types/product';
import styles from './Catalog.module.scss';

/** Products before the interlude: two rows on wide screens, four on phones. */
const BEFORE_INTERLUDE = 8;
/** Up to this many products, wide screens give each one more room. */
const FEW = 3;

/**
 * A regular grid, for comparing at a glance. `interlude` takes a whole row
 * after the first products, or follows the grid when it is short.
 */
export function CatalogGrid({
  products,
  interlude,
}: {
  products: CatalogProduct[];
  interlude?: ReactNode;
}) {
  const inside = Boolean(interlude) && products.length > BEFORE_INTERLUDE;
  return (
    <>
      <div
        className={styles.grid}
        data-few={products.length <= FEW || undefined}
      >
        {products.map((product, index) => (
          <Fragment key={product.id}>
            {inside && index === BEFORE_INTERLUDE && (
              <div className={styles.interludeSlot}>{interlude}</div>
            )}
            <div className={styles.item}>
              <ProductCard product={product} />
            </div>
          </Fragment>
        ))}
      </div>
      {interlude && !inside && (
        <div className={styles.interludeAfter}>{interlude}</div>
      )}
    </>
  );
}
