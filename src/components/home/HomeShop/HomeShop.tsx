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
  links,
  demo,
}: {
  latest: CatalogProduct[];
  restocked: CatalogProduct[];
  lastPieces: CatalogProduct[];
  links: { nouveautes?: string; enStock?: string; catalogue?: string };
  /** The products come from the demonstration seed. */
  demo: boolean;
}) {
  const shelves: Shelf[] = [
    {
      id: 'nouveautes',
      eyebrow: 'Derniers produits publiés',
      title: 'Nouveautés',
      products: latest,
      link: links.nouveautes
        ? { href: links.nouveautes, label: 'Toutes les nouveautés' }
        : undefined,
    },
    {
      id: 'reassorts',
      eyebrow: 'De retour sur les terres',
      title: 'Réassorts',
      products: restocked,
      link: links.enStock
        ? { href: links.enStock, label: 'Tous les produits en stock' }
        : undefined,
    },
    {
      id: 'dernieres-pieces',
      eyebrow: 'Stock limité',
      title: 'Dernières pièces',
      products: lastPieces,
      link: links.catalogue
        ? {
            href: `${links.catalogue}?availability=low-stock`,
            label: 'Toutes les dernières pièces',
          }
        : undefined,
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
      {demo && (
        <p className={styles.demo}>
          Aperçu de la boutique · Produits, prix et disponibilités présentés à
          titre de démonstration.
        </p>
      )}
    </div>
  );
}
