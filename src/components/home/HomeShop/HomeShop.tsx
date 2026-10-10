import { merchandisingPath } from '@/lib/catalog/merchandising';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { ProductCard } from '@/components/product/ProductCard/ProductCard';
import type { CatalogProduct } from '@/types/product';
import styles from './HomeShop.module.scss';

/** A row to swipe on phones, four columns on wide screens. */
const SHELF_SIZES =
  '(min-width: 1200px) 300px, (min-width: 960px) 24vw, (min-width: 768px) 46vw, 72vw';

type Shelf = {
  id: string;
  eyebrow: string;
  title: string;
  products: CatalogProduct[];
  link?: { href: string; label: string };
};

/**
 * The shop, right under the hero: what is new, what is back, what is about
 * to run out. Every card shows its photo, price, stock and a button to buy.
 * It stays in the night of the hero (and of the selection after it): the
 * landscape flows into the products without a seam. A shelf without
 * products is absent; the whole block too.
 */
export function HomeShop({
  latest,
  restocked,
  lastPieces,
}: {
  latest: CatalogProduct[];
  restocked: CatalogProduct[];
  lastPieces: CatalogProduct[];
}) {
  const shelves: Shelf[] = [
    {
      id: 'nouveautes',
      eyebrow: 'Publiées ces 7 derniers jours',
      title: 'Nouveauté de la semaine',
      products: latest,
      link: {
        href: merchandisingPath('nouveaute-de-la-semaine'),
        label: 'Voir les nouveautés de la semaine',
      },
    },
    {
      id: 'reassorts',
      eyebrow: 'De retour sur les terres',
      title: 'Retour en stock',
      products: restocked,
      link: {
        href: merchandisingPath('retour-en-stock'),
        label: 'Voir les retours en stock',
      },
    },
    {
      id: 'dernieres-pieces',
      eyebrow: 'Stock limité',
      title: 'Derniers exemplaires',
      products: lastPieces,
      link: {
        href: merchandisingPath('derniers-exemplaires'),
        label: 'Voir les derniers exemplaires',
      },
    },
  ].filter((shelf) => shelf.products.length > 0);
  if (!shelves.length) return null;
  return (
    <div className={styles.shop}>
      {shelves.map((shelf) => (
        <section
          key={shelf.id}
          id={shelf.id}
          className={styles.shelf}
          aria-labelledby={`${shelf.id}-title`}
        >
          <header className={styles.head}>
            <div>
              <p className={styles.eyebrow}>{shelf.eyebrow}</p>
              <h2 id={`${shelf.id}-title`}>{shelf.title}</h2>
            </div>
            {shelf.link && (
              <Link href={shelf.link.href} className={styles.all}>
                {shelf.link.label} <ArrowRight size={16} aria-hidden="true" />
              </Link>
            )}
          </header>
          <ul className={styles.rail}>
            {shelf.products.map((product) => (
              // Still and readable at once: no scroll entrance on a shelf.
              <li key={product.id}>
                <ProductCard
                  product={product}
                  sizes={SHELF_SIZES}
                  tone="night"
                  buy
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
