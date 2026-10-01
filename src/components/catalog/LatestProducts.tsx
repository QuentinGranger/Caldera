import { ProductCard } from '@/components/product/ProductCard/ProductCard';
import { SectionTitle } from '@/components/ui/SectionTitle/SectionTitle';
import type { CatalogProduct } from '@/types/product';
import styles from './Catalog.module.scss';

/** Phones and tablets: a swiped row; wide screens: one row of four. */
const SIZES =
  '(min-width: 1200px) 300px, (min-width: 768px) 30vw, (min-width: 300px) 46vw, 90vw';

/**
 * The latest products of an aisle, above its full listing: the same cards,
 * swiped on phones (the next one peeking), one row of four on wide screens.
 * `all` leads to the whole listing in the same order.
 */
export function LatestProducts({
  title,
  products,
  all,
}: {
  title: string;
  products: readonly CatalogProduct[];
  all: { href: string; label: string };
}) {
  if (!products.length) return null;
  return (
    <section className={styles.latest} aria-labelledby="derniers-ajouts">
      <SectionTitle
        id="derniers-ajouts"
        eyebrow="Nouveautés"
        title={title}
        link={all}
      />
      <ul className={styles.latestRow}>
        {products.map((product) => (
          <li key={product.id}>
            <ProductCard product={product} sizes={SIZES} />
          </li>
        ))}
      </ul>
    </section>
  );
}
