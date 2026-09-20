'use client';

import { LoaderCircle, Plus } from 'lucide-react';
import { useCart } from '@/components/cart/CartProvider';
import { IconButton } from '@/components/ui/IconButton/IconButton';
import { addToCartAction } from '@/lib/cart/actions';

type Props = {
  productName: string;
  variantId: string | null;
  unavailable: boolean;
  className?: string;
};

export function ProductCardQuickAdd({
  productName,
  variantId,
  unavailable,
  className = '',
}: Props) {
  const { pending, execute } = useCart();
  const disabled = unavailable || !variantId || pending;

  const label = unavailable || !variantId
    ? `${productName} — indisponible`
    : pending
      ? `Ajout de ${productName} au panier…`
      : `Ajouter ${productName} au panier`;

  return (
    <IconButton
      className={className}
      disabled={disabled}
      label={label}
      aria-busy={pending || undefined}
      onClick={() => {
        if (!variantId) return;
        execute(() => addToCartAction(variantId, 1), true);
      }}
    >
      {pending ? (
        <LoaderCircle className="quick-add-spinner" aria-hidden="true" />
      ) : (
        <Plus aria-hidden="true" />
      )}
    </IconButton>
  );
}
