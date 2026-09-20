import Image from 'next/image';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton/IconButton';
import { ProductBadge } from '@/components/product/ProductBadge/ProductBadge';
import { ProductCardQuickAdd } from './ProductCardQuickAdd';
import type { CatalogProduct } from '@/types/product';
import { formatPrice } from '@/utils/formatPrice';
import styles from './ProductCard.module.scss';
export function ProductCard({
  product,
  compact = false,
}: {
  product: CatalogProduct;
  compact?: boolean;
}) {
  return (
    <article className={`${styles.card} ${compact ? styles.compact : ''}`}>
      <div className={styles.visual}>
        <div className={styles.badge}>
          {product.badge && <ProductBadge kind={product.badge} />}
        </div>
        <IconButton
          className={styles.favorite}
          label={`Ajouter ${product.name} aux favoris — bientôt disponible`}
          disabled
        >
          <Heart aria-hidden="true" />
        </IconButton>
        <Link
          href={`/produit/${product.slug}`}
          aria-label={`Découvrir ${product.name}`}
        >
          <Image
            src={product.image}
            alt={product.imageAlt}
            fill
            sizes={
              compact
                ? '(min-width: 768px) 160px, 120px'
                : '(min-width: 1200px) 300px, (min-width: 768px) 42vw, 80vw'
            }
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
            variantId={product.quickAddVariantId}
            unavailable={product.availability === 'OUT_OF_STOCK'}
          />
        </div>
      </div>
    </article>
  );
}
