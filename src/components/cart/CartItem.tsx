'use client';
import Image from 'next/image';
import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { QuantitySelector } from '@/components/product/QuantitySelector/QuantitySelector';
import { ProductBadge } from '@/components/product/ProductBadge/ProductBadge';
import { languageLabels } from '@/lib/catalog/params';
import { removeCartItemAction, updateCartItemAction } from '@/lib/cart/actions';
import type { CartItemView } from '@/lib/cart/types';
import { formatPrice } from '@/utils/formatPrice';
import { useCart } from './CartProvider';
import styles from './CartItem.module.scss';
export function CartItem({
  item,
  onNavigate,
}: {
  item: CartItemView;
  onNavigate?: () => void;
}) {
  const { pending, execute } = useCart();
  const issue =
    item.issue === 'UNAVAILABLE'
      ? 'Ce produit n’est plus disponible.'
      : item.issue === 'OUT_OF_STOCK'
        ? item.preorder
          ? 'Quota de précommande épuisé.'
          : 'Rupture de stock.'
        : item.issue === 'INSUFFICIENT_STOCK'
          ? `Quantité demandée : ${item.quantity}. Seulement ${item.maxQuantity} exemplaire(s) sont désormais disponibles.`
          : null;
  return (
    <li
      className={styles.item}
      aria-label={`${item.name}, ${languageLabels[item.language]}`}
    >
      <Link
        href={item.href}
        onClick={onNavigate}
        className={styles.image}
        tabIndex={-1}
        aria-hidden="true"
      >
        <Image src={item.image} alt="" fill sizes="96px" />
      </Link>
      <div className={styles.body}>
        <Link href={item.href} onClick={onNavigate} className={styles.name}>
          {item.name}
        </Link>
        <p className={styles.language}>
          Langue : {languageLabels[item.language]}
        </p>
        {item.preorder && <ProductBadge kind="preorder" />}
        <p className={styles.unit}>{formatPrice(item.price)} / unité</p>
        {issue && <p className={styles.issue}>{issue}</p>}
        {item.issue === 'INSUFFICIENT_STOCK' && (
          <button
            type="button"
            disabled={pending}
            className={styles.adjust}
            onClick={() =>
              execute(() => updateCartItemAction(item.id, item.maxQuantity))
            }
          >
            Mettre à jour à {item.maxQuantity}
          </button>
        )}
        <div className={styles.controls}>
          <QuantitySelector
            commitOnBlur
            quantity={item.quantity}
            max={item.maxQuantity}
            disabled={pending || item.maxQuantity < 1}
            onChange={(quantity) =>
              execute(() => updateCartItemAction(item.id, quantity))
            }
          />
          <button
            type="button"
            disabled={pending}
            className={styles.remove}
            aria-label={`Supprimer ${item.name} (${languageLabels[item.language]})`}
            onClick={() => execute(() => removeCartItemAction(item.id))}
          >
            <Trash2 size={16} aria-hidden="true" /> Supprimer
          </button>
        </div>
        <p className={styles.total}>
          Sous-total de l’article <strong>{formatPrice(item.lineTotal)}</strong>
        </p>
      </div>
    </li>
  );
}
