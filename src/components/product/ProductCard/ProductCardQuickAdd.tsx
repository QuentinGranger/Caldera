'use client';

import { LoaderCircle, Plus, ShoppingBag } from 'lucide-react';
import { useCart } from '@/components/cart/CartProvider';
import { IconButton } from '@/components/ui/IconButton/IconButton';
import { addToCartAction } from '@/lib/cart/actions';
import { ADD_TO_CART_LABEL, addProductToCartLabel } from '@/lib/ux/copy';

type Props = {
  productName: string;
  variantId: string | null;
  unavailable: boolean;
  className?: string;
  /**
   * The shop shelves of the home page: a written button, « Ajouter au
   * panier » (« Précommander » for a preorder), instead of the icon.
   */
  labelled?: boolean;
  preorder?: boolean;
};

export function ProductCardQuickAdd({
  productName,
  variantId,
  unavailable,
  className = '',
  labelled = false,
  preorder = false,
}: Props) {
  const { pending, execute } = useCart();
  const disabled = unavailable || !variantId || pending;
  const add = () => {
    if (!variantId) return;
    execute(() => addToCartAction(variantId, 1), true);
  };

  if (labelled) {
    const text =
      unavailable || !variantId
        ? 'Indisponible'
        : pending
          ? 'Ajout en cours…'
          : preorder
            ? 'Précommander'
            : ADD_TO_CART_LABEL;
    return (
      <button
        type="button"
        className={className}
        disabled={disabled}
        // The visible words first, then the product they act on.
        aria-label={`${text} : ${productName}`}
        aria-busy={pending || undefined}
        onClick={add}
      >
        {pending ? (
          <LoaderCircle aria-hidden="true" />
        ) : (
          <ShoppingBag aria-hidden="true" />
        )}
        {text}
      </button>
    );
  }

  const label =
    unavailable || !variantId
      ? `${productName} — indisponible`
      : pending
        ? `Ajout de ${productName} au panier…`
        : addProductToCartLabel(productName);

  return (
    <IconButton
      className={className}
      disabled={disabled}
      label={label}
      aria-busy={pending || undefined}
      onClick={add}
    >
      {pending ? (
        <LoaderCircle aria-hidden="true" />
      ) : (
        <Plus aria-hidden="true" />
      )}
    </IconButton>
  );
}
