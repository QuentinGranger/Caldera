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
  buy = false,
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
  /**
   * The shop shelves of the home page: the stock always said, last pieces
   * counted, and a written « Ajouter au panier » button.
   */
  buy?: boolean;
}) {
  const edition = layout === 'edition';
  const salesEnabled = process.env.CATALOG_DEMO_MODE !== '1';
  const inStock =
    salesEnabled &&
    !product.isDemonstration &&
    product.availability === 'IN_STOCK';
  const stock =
    buy && salesEnabled && !product.isDemonstration ? stockLine(product) : null;
  return (
    <article
      className={`${styles.card} ${compact ? styles.compact : ''} ${tone === 'night' ? styles.night : ''} ${layout === 'spotlight' ? styles.spotlight : ''} ${buy ? styles.buying : ''}`}
      data-product-card=""
    >
      <div
        className={styles.visual}
        data-depth-stage={depth ? 'product' : undefined}
      >
        <div className={styles.badge}>
          {salesEnabled && product.badge && (
            <ProductBadge kind={product.badge} />
          )}
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
        ) : stock ? (
          <p className={styles.availability} data-stock={stock.tone}>
            {stock.text}
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
          {salesEnabled && !product.isDemonstration && (
            <ProductCardQuickAdd
              className={buy ? styles.buy : styles.add}
              productName={product.name}
              variantId={product.quickAddVariantId ?? null}
              unavailable={product.availability === 'OUT_OF_STOCK'}
              labelled={buy}
              preorder={product.availability === 'PREORDER'}
            />
          )}
        </div>
      </div>
    </article>
  );
}

/** What the shelves say of the stock: the same words as the product page. */
function stockLine(product: CatalogProduct): {
  text: string;
  tone: 'available' | 'low' | 'preorder' | 'none';
} {
  switch (product.availability) {
    case 'LOW_STOCK':
      return {
        text: product.lowStockLeft
          ? `Plus que ${product.lowStockLeft} en stock`
          : 'Dernières pièces',
        tone: 'low',
      };
    case 'PREORDER':
      return { text: 'Précommande ouverte', tone: 'preorder' };
    case 'OUT_OF_STOCK':
      return { text: 'Rupture de stock', tone: 'none' };
    default:
      return { text: 'En stock', tone: 'available' };
  }
}
