'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { MAX_CART_ITEM_QUANTITY } from '@/lib/cart/constants';
import { useSearchParams } from 'next/navigation';
import { Truck } from 'lucide-react';
import { ProductVariantSelector } from '@/components/product/ProductVariantSelector/ProductVariantSelector';
import { QuantitySelector } from '@/components/product/QuantitySelector/QuantitySelector';
import { AddToCartButton } from '@/components/product/AddToCartButton/AddToCartButton';
import { StockAlertForm } from '@/components/product/StockAlertForm/StockAlertForm';
import { languageLabels } from '@/lib/catalog/params';
import {
  selectProductVariant,
  canPreparePurchase,
  type ProductVariantView,
} from '@/lib/product/purchase';
import {
  DELIVERY_ZONE_LABEL,
  HANDLING_HEADLINE,
  PREORDER_HANDLING_LABEL,
  RETURN_POLICY_PATH,
  RETURN_LABEL,
  type ShippingOptionView,
} from '@/lib/product/services';
import { formatPrice } from '@/utils/formatPrice';
import { formatProductDate } from '@/utils/formatProduct';
import { cartShippingPrice } from '@/lib/shipping/summary';
import { ShippingFromLine } from '@/components/shipping/ShippingFromLine';
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
  sealed,
  shipping,
  accountEmail,
}: Omit<Props, 'variants' | 'newArrival'> & { variant: ProductVariantView }) {
  const [quantity, setQuantity] = useState(1);
  const buy = useRef<HTMLDivElement>(null);
  const itemsTotal = (
    (Math.round(Number(variant.price) * 100) * quantity) /
    100
  ).toFixed(2);
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
      {!soldOut && (
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
      )}
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
      <TrustStrip
        sealed={sealed}
        secureOrders={shipping.length > 0}
        preorder={preorderProduct}
      />
      <div className={`${styles.service} ${styles.delivery}`}>
        <Truck size={20} aria-hidden="true" />
        <div>
          {shipping.length ? (
            <>
              {/* CGV art. 10.3, right under the button. */}
              <strong>
                {preorderProduct ? PREORDER_HANDLING_LABEL : HANDLING_HEADLINE}
              </strong>
              <details className={styles.estimate}>
                <summary>Estimer les frais de livraison</summary>
                <p>
                  Pour {quantity} exemplaire{quantity > 1 ? 's' : ''} de ce
                  produit, hors autres articles et remises.
                </p>
                <ul className={styles.shipping} aria-live="polite">
                  {shipping.map((option) => (
                    <li key={option.code}>
                      <span>
                        <strong>{option.name}</strong>
                        <small>
                          {[
                            option.transit && `livraison en ${option.transit}`,
                            option.freeFromAmount &&
                              Number(option.price) > 0 &&
                              `offerte dès ${formatPrice(option.freeFromAmount)} d’achat`,
                            option.destinations.length > 0 &&
                              option.destinations.join(', '),
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </small>
                      </span>
                      <b>
                        {Number(cartShippingPrice(option, itemsTotal)) > 0
                          ? formatPrice(cartShippingPrice(option, itemsTotal))
                          : 'Offerte'}
                      </b>
                    </li>
                  ))}
                </ul>
                <p>
                  Estimation selon la destination et le transporteur. Le tarif
                  exact est confirmé avant le paiement.
                </p>
              </details>
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
      <p className={styles.returnNote}>
        <Link href={RETURN_POLICY_PATH}>Retours : conditions et procédure</Link>
        <span>{RETURN_LABEL}</span>
      </p>
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
        <span className={styles.tax}>TTC</span>
        {selected.compareAtPrice && (
          <del
            aria-label={`Ancien prix : ${formatPrice(selected.compareAtPrice)}`}
          >
            {formatPrice(selected.compareAtPrice)}
          </del>
        )}
      </div>
      <StockStatus variant={selected} newArrival={props.newArrival} />
      {/* Delivery where the price is read: from how much, free from when. */}
      <div className={styles.shippingFrom}>
        <ShippingFromLine offers={props.shipping} />
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
