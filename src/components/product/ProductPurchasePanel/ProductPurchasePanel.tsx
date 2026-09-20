'use client';
import { useState } from 'react';
import { MAX_CART_ITEM_QUANTITY } from '@/lib/cart/constants';
import { useSearchParams } from 'next/navigation';
import { Package, Truck } from 'lucide-react';
import { ProductBadge } from '@/components/product/ProductBadge/ProductBadge';
import { ProductVariantSelector } from '@/components/product/ProductVariantSelector/ProductVariantSelector';
import { QuantitySelector } from '@/components/product/QuantitySelector/QuantitySelector';
import { AddToCartButton } from '@/components/product/AddToCartButton/AddToCartButton';
import { languageLabels } from '@/lib/catalog/params';
import {
  getProductBadge,
  availabilityLabels,
} from '@/lib/catalog/getAvailability';
import {
  selectProductVariant,
  canPreparePurchase,
  conditionLabels,
  type ProductVariantView,
} from '@/lib/product/purchase';
import { formatPrice } from '@/utils/formatPrice';
import { formatProductDate, formatProductWeight } from '@/utils/formatProduct';
import styles from './ProductPurchasePanel.module.scss';
type Props = {
  productId: string;
  variants: ProductVariantView[];
  newArrival: boolean;
  releaseDate: string | null;
  typeLabel: string;
};
function SelectedVariant({
  variant,
  newArrival,
  releaseDate,
  typeLabel,
}: Omit<Props, 'variants'> & { variant: ProductVariantView }) {
  const [quantity, setQuantity] = useState(1);
  const badge = getProductBadge(variant.availability, newArrival);
  const preorder = variant.availability === 'PREORDER',
    soldOut = variant.availability === 'OUT_OF_STOCK';
  const label = soldOut
    ? 'Rupture de stock'
    : variant.lowStockQuantity !== null
      ? `Plus que ${variant.lowStockQuantity} en stock`
      : availabilityLabels[variant.availability];
  return (
    <div>
      <div className={styles.stock} role="status">
        {badge && <ProductBadge kind={badge} />}
        <span className={soldOut ? styles.unavailable : ''}>{label}</span>
      </div>
      {preorder && releaseDate && (
        <p className={styles.release}>
          Sortie prévue le {formatProductDate(releaseDate)}
        </p>
      )}
      {preorder && variant.maxQuantity === 0 && (
        <p className={styles.release}>
          Aucune quantité de précommande disponible actuellement.
        </p>
      )}
      <p className={styles.sku}>
        SKU : <span>{variant.sku}</span> · {languageLabels[variant.language]}
      </p>
      <div className={styles.purchase}>
        <QuantitySelector
          quantity={quantity}
          max={Math.min(variant.maxQuantity, MAX_CART_ITEM_QUANTITY)}
          disabled={!variant.maxQuantity || soldOut}
          onChange={setQuantity}
        />
        <AddToCartButton
          variantId={variant.id}
          quantity={quantity}
          disabled={!canPreparePurchase(variant, quantity)}
          preorder={preorder}
          unavailable={soldOut}
        />
      </div>
      {soldOut && (
        <p className={styles.future}>
          Les alertes de retour seront disponibles ultérieurement.
        </p>
      )}
      <div className={styles.service}>
        <Truck size={20} aria-hidden="true" />
        <div>
          <strong>Livraison</strong>
          <p>
            Les modalités, frais et délais seront précisés à l’ouverture des
            commandes.
          </p>
        </div>
      </div>
      <div className={styles.service}>
        <Package size={20} aria-hidden="true" />
        <div>
          <strong>
            État du produit : {conditionLabels[variant.condition]}
          </strong>
          <p>
            Consultez la description et les caractéristiques de cette sélection.
          </p>
        </div>
      </div>
      <section
        className={styles.specs}
        aria-label="Caractéristiques de la variante"
      >
        <h2>Caractéristiques</h2>
        <dl>
          <div>
            <dt>Type</dt>
            <dd>{typeLabel}</dd>
          </div>
          <div>
            <dt>Langue</dt>
            <dd>{languageLabels[variant.language]}</dd>
          </div>
          <div>
            <dt>État</dt>
            <dd>{conditionLabels[variant.condition]}</dd>
          </div>
          <div>
            <dt>SKU</dt>
            <dd>{variant.sku}</dd>
          </div>
          {releaseDate && (
            <div>
              <dt>Date de sortie</dt>
              <dd>{formatProductDate(releaseDate)}</dd>
            </div>
          )}
          {variant.weightGrams !== null && (
            <div>
              <dt>Poids</dt>
              <dd>{formatProductWeight(variant.weightGrams)}</dd>
            </div>
          )}
        </dl>
      </section>
    </div>
  );
}
export function ProductPurchasePanel(props: Props) {
  const params = useSearchParams();
  const selected = selectProductVariant(props.variants, params.get('variant'));
  if (!selected)
    return (
      <div className={styles.empty}>
        <p>Produit momentanément indisponible.</p>
        <AddToCartButton variantId="" quantity={1} disabled />
      </div>
    );
  function change(sku: string) {
    const url = new URL(window.location.href);
    url.searchParams.set('variant', sku);
    window.history.pushState(null, '', url.pathname + url.search + url.hash);
  }
  return (
    <section aria-label="Choisir votre produit">
      <div className={styles.price} aria-live="polite">
        <strong>{formatPrice(selected.price)}</strong>
        {selected.compareAtPrice && (
          <del
            aria-label={`Ancien prix : ${formatPrice(selected.compareAtPrice)}`}
          >
            {formatPrice(selected.compareAtPrice)}
          </del>
        )}
      </div>
      <ProductVariantSelector
        variants={props.variants}
        selected={selected.sku}
        onChange={change}
      />
      <SelectedVariant key={selected.id} {...props} variant={selected} />
    </section>
  );
}
