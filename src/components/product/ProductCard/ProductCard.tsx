import Link from 'next/link';
import { ProductBadge } from '@/components/product/ProductBadge/ProductBadge';
import { SharedProductImage } from '@/components/transitions/SharedProductImage';
import { ProductCardQuickAdd } from './ProductCardQuickAdd';
import { ProductFavorite } from './ProductFavorite';
import { languageLabels } from '@/lib/catalog/params';
import type { CatalogProduct } from '@/types/product';
import { formatPrice } from '@/utils/formatPrice';
import { viewProductLabel } from '@/lib/ux/copy';
import styles from './ProductCard.module.scss';
/** The listing grid: 2 columns on phones, 3 on tablets, 4 from 75rem. */
const GRID_SIZES =
  '(min-width: 1200px) 300px, (min-width: 768px) 31vw, (min-width: 300px) 46vw, 90vw';

export function ProductCard({
  product,
  compact = false,
  tone = 'day',
  sizes = GRID_SIZES,
  layout = 'default',
  returnTarget = false,
  depth = layout === 'spotlight',
}: {
  product: CatalogProduct;
  compact?: boolean;
  /** Decorative image depth on the immersive shop pages. */
  depth?: boolean;
  /** `night`: on the dark sections of the home page. */
  tone?: 'day' | 'night';
  /** Width of the card where it is shown; the listing grid by default. */
  sizes?: string;
  /**
   * `spotlight`: a large product stage reserved for the homepage.
   * `edition`: where the edition decides (displays), the set alone above
   * the name (the family is the page's) and the languages on sale beside
   * the availability. Same card, same height.
   */
  layout?: 'default' | 'edition' | 'spotlight';
  /**
   * The main listing: back from the product page, its image returns into
   * this card (src/components/transitions/SharedProductImage.tsx).
   */
  returnTarget?: boolean;
}) {
  const edition = layout === 'edition';
  const inStock =
    !product.isDemonstration && product.availability === 'IN_STOCK';
  return (
    <article
      className={`${styles.card} ${compact ? styles.compact : ''} ${tone === 'night' ? styles.night : ''} ${layout === 'spotlight' ? styles.spotlight : ''}`}
      data-product-card=""
    >
      <div
        className={styles.visual}
        data-depth-stage={depth ? 'product' : undefined}
      >
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
          aria-label={viewProductLabel(product.name)}
        >
          <SharedProductImage
            slug={product.slug}
            returnTarget={returnTarget}
            src={product.image}
            alt={product.imageAlt}
            sizes={compact ? '(min-width: 768px) 160px, 120px' : sizes}
          />
        </Link>
      </div>
      <div className={styles.content}>
        <p className={styles.category}>
          {edition && product.tcgSet
            ? product.tcgSet.name
            : `${product.category}${product.tcgSet ? ` · ${product.tcgSet.name}` : ''}`}
        </p>
        <h3>
          <Link href={`/produit/${product.slug}`}>{product.name}</Link>
        </h3>
        {/* Pre-order, sold out and last pieces already show as a badge. */}
        {edition && product.languages.length > 0 ? (
          <p className={styles.facts}>
            <span className={styles.languages}>
              {product.languages.map((language) => (
                <span key={language} className={styles.language}>
                  <span aria-hidden="true">
                    {language === 'OTHER' ? 'Autre' : language}
                  </span>
                  <span className={styles.srOnly}>
                    {languageLabels[language]}
                  </span>
                </span>
              ))}
            </span>
            {inStock && <span className={styles.availability}>En stock</span>}
          </p>
        ) : (
          inStock && <p className={styles.availability}>En stock</p>
        )}
        <div className={styles.bottom}>
          {/* The amount always ends the block: amounts align along a row. */}
          <div className={styles.price}>
            {product.price === null ? (
              <span
                className={
                  product.isDemonstration ? styles.exampleLabel : undefined
                }
              >
                {product.isDemonstration
                  ? 'Exemple · non commercialisé'
                  : 'Indisponible'}
              </span>
            ) : (
              <>
                {(product.priceFrom || product.compareAtPrice) && (
                  <span className={styles.priceNote}>
                    {product.priceFrom && 'À partir de '}
                    {product.compareAtPrice && (
                      <del
                        aria-label={`Ancien prix : ${formatPrice(product.compareAtPrice)}`}
                      >
                        {formatPrice(product.compareAtPrice)}
                      </del>
                    )}
                  </span>
                )}
                <span>{formatPrice(product.price)}</span>
              </>
            )}
          </div>
          {!product.isDemonstration && (
            <ProductCardQuickAdd
              className={styles.add}
              productName={product.name}
              variantId={product.quickAddVariantId ?? null}
              unavailable={product.availability === 'OUT_OF_STOCK'}
            />
          )}
        </div>
      </div>
    </article>
  );
}
