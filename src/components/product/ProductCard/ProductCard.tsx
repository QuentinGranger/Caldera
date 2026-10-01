import Image from 'next/image';
import Link from 'next/link';
import { ProductBadge } from '@/components/product/ProductBadge/ProductBadge';
import { ProductCardQuickAdd } from './ProductCardQuickAdd';
import { ProductFavorite } from './ProductFavorite';
import type { CatalogProduct } from '@/types/product';
import { formatPrice } from '@/utils/formatPrice';
import styles from './ProductCard.module.scss';
/** The listing grid: 2 columns on phones, 3 on tablets, 4 from 75rem. */
const GRID_SIZES =
  '(min-width: 1200px) 300px, (min-width: 768px) 31vw, (min-width: 360px) 46vw, 90vw';

export function ProductCard({
  product,
  compact = false,
  tone = 'day',
  sizes = GRID_SIZES,
}: {
  product: CatalogProduct;
  compact?: boolean;
  /** `night`: on the dark sections of the home page. */
  tone?: 'day' | 'night';
  /** Width of the card where it is shown; the listing grid by default. */
  sizes?: string;
}) {
  return (
    <article
      className={`${styles.card} ${compact ? styles.compact : ''} ${tone === 'night' ? styles.night : ''}`}
    >
      <div className={styles.visual}>
        <div className={styles.badge}>
          {product.badge && <ProductBadge kind={product.badge} />}
        </div>
        <ProductFavorite
          className={styles.favorite}
          productId={product.id}
          productName={product.name}
        />
        <Link
          href={`/produit/${product.slug}`}
          aria-label={`Découvrir ${product.name}`}
        >
          <Image
            src={product.image}
            alt={product.imageAlt}
            fill
            sizes={compact ? '(min-width: 768px) 160px, 120px' : sizes}
          />
        </Link>
      </div>
      <div className={styles.content}>
        <p className={styles.category}>
          {product.category}
          {product.tcgSet ? ` · ${product.tcgSet.name}` : ''}
        </p>
        <h3>
          <Link href={`/produit/${product.slug}`}>{product.name}</Link>
        </h3>
        {/* Pre-order, sold out and last pieces already show as a badge. */}
        {product.availability === 'IN_STOCK' && (
          <p className={styles.availability}>En stock</p>
        )}
        <div className={styles.bottom}>
          <div className={styles.price}>
            {product.price === null ? (
              <span>Indisponible</span>
            ) : (
              <>
                <span>
                  {product.priceFrom ? 'À partir de ' : ''}
                  {formatPrice(product.price)}
                </span>
                {product.compareAtPrice && (
                  <del
                    className={styles.comparePrice}
                    aria-label={`Ancien prix : ${formatPrice(product.compareAtPrice)}`}
                  >
                    {formatPrice(product.compareAtPrice)}
                  </del>
                )}
              </>
            )}
          </div>
          <ProductCardQuickAdd
            className={styles.add}
            productName={product.name}
            variantId={product.quickAddVariantId ?? null}
            unavailable={product.availability === 'OUT_OF_STOCK'}
          />
        </div>
      </div>
    </article>
  );
}
