'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { MAX_CART_ITEM_QUANTITY } from '@/lib/cart/constants';
import { useSearchParams } from 'next/navigation';
import { Package, RotateCcw, Truck } from 'lucide-react';
import { ProductVariantSelector } from '@/components/product/ProductVariantSelector/ProductVariantSelector';
import { QuantitySelector } from '@/components/product/QuantitySelector/QuantitySelector';
import { AddToCartButton } from '@/components/product/AddToCartButton/AddToCartButton';
import { StockAlertForm } from '@/components/product/StockAlertForm/StockAlertForm';
import { languageLabels } from '@/lib/catalog/params';
import {
  selectProductVariant,
  canPreparePurchase,
  conditionLabels,
  type ProductVariantView,
} from '@/lib/product/purchase';
import {
  DELIVERY_ZONE_LABEL,
  HANDLING_HEADLINE,
  PREORDER_HANDLING_LABEL,
  RETURN_LABEL,
  RETURN_POLICY_PATH,
  type ShippingOptionView,
} from '@/lib/product/services';
import { formatPrice } from '@/utils/formatPrice';
import { formatProductDate, formatProductWeight } from '@/utils/formatProduct';
import { StickyBuyBar } from './StickyBuyBar';
import { stockLabel } from '@/lib/product/stock';
import { StockStatus } from './StockStatus';
import { TrustStrip } from './TrustStrip';
import styles from './ProductPurchasePanel.module.scss';
/** The page of the delivery terms (src/components/editorial/delivery.ts). */
const DELIVERY_PATH = '/livraison';
type Props = {
  productId: string;
  variants: ProductVariantView[];
  newArrival: boolean;
  /** Product sold on preorder; a variant with no quota left is sold out. */
  preorder: boolean;
  releaseDate: string | null;
  typeLabel: string;
  /** A sealed type (src/lib/product/services.ts): « neuf et scellé ». */
  sealed: boolean;
  /** Shipping methods offered at checkout (ShippingMethod). */
  shipping: ShippingOptionView[];
  /** Signed-in customer's e-mail, for back-in-stock alerts. */
  accountEmail: string | null;
};
function SelectedVariant({
  variant,
  preorder: preorderProduct,
  releaseDate,
  typeLabel,
  sealed,
  shipping,
  accountEmail,
}: Omit<Props, 'variants' | 'newArrival'> & { variant: ProductVariantView }) {
  const [quantity, setQuantity] = useState(1);
  const buy = useRef<HTMLDivElement>(null);
  const preorder = variant.availability === 'PREORDER',
    soldOut = variant.availability === 'OUT_OF_STOCK';
  return (
    <div>
      {preorderProduct && releaseDate && (
        <p className={styles.release}>
          Sortie prévue le {formatProductDate(releaseDate)}
        </p>
      )}
      {preorderProduct && variant.maxQuantity === 0 && (
        <p className={styles.release}>
          Aucune quantité de précommande disponible actuellement.
        </p>
      )}
      <p className={styles.sku}>
        SKU : <span>{variant.sku}</span> · {languageLabels[variant.language]}
      </p>
      <div className={styles.purchase} ref={buy}>
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
      {!soldOut && canPreparePurchase(variant, quantity) && (
        <StickyBuyBar
          target={buy}
          variantId={variant.id}
          quantity={quantity}
          price={formatPrice(variant.price)}
          stock={stockLabel(variant).text}
          preorder={preorder}
        />
      )}
      {soldOut && (
        <StockAlertForm
          variantId={variant.id}
          language={languageLabels[variant.language]}
          accountEmail={accountEmail}
        />
      )}
      <TrustStrip sealed={sealed} secureOrders={shipping.length > 0} />
      <div className={`${styles.service} ${styles.delivery}`}>
        <Truck size={20} aria-hidden="true" />
        <div>
          {shipping.length ? (
            <>
              {/* CGV art. 10.3, right under the button. */}
              <strong>
                {preorderProduct ? PREORDER_HANDLING_LABEL : HANDLING_HEADLINE}
              </strong>
              <ul className={styles.shipping}>
                {shipping.map((option) => (
                  <li key={option.code}>
                    {option.name}
                    {option.destinations.length > 0 &&
                      ` (${option.destinations.join(', ')})`}{' '}
                    : {option.details.join(', ')}
                  </li>
                ))}
              </ul>
              <p>
                Après confirmation du paiement · {DELIVERY_ZONE_LABEL} ·{' '}
                <Link href={DELIVERY_PATH}>Détails de la livraison</Link>
              </p>
            </>
          ) : (
            <>
              <strong>Livraison</strong>
              <p>
                Les modalités, frais et délais seront précisés à l’ouverture des
                commandes.
              </p>
            </>
          )}
        </div>
      </div>
      <div className={styles.service}>
        <RotateCcw size={20} aria-hidden="true" />
        <div>
          <strong>Retours</strong>
          <p>
            {RETURN_LABEL}{' '}
            <Link href={RETURN_POLICY_PATH}>
              Conditions de retour (article 12 des CGV)
            </Link>
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
      <StockStatus variant={selected} newArrival={props.newArrival} />
      <ProductVariantSelector
        variants={props.variants}
        selected={selected.sku}
        onChange={change}
      />
      <SelectedVariant key={selected.id} {...props} variant={selected} />
    </section>
  );
}
