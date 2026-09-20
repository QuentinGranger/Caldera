'use client';
import { useId } from 'react';
import { useCart } from '@/components/cart/CartProvider';
import { addToCartAction } from '@/lib/cart/actions';
import { ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/Button/Button';
import styles from './AddToCartButton.module.scss';
type Props = {
  variantId: string;
  quantity: number;
  disabled: boolean;
  preorder?: boolean;
  unavailable?: boolean;
};
export function AddToCartButton({
  variantId,
  quantity,
  disabled,
  preorder = false,
  unavailable = false,
}: Props) {
  const { pending, message, execute } = useCart();
  const id = useId();
  return (
    <div className={styles.action}>
      <Button
        className={styles.button}
        disabled={disabled || pending}
        aria-describedby={id}
        onClick={() =>
          execute(() => addToCartAction(variantId, quantity), true)
        }
      >
        <ShoppingBag size={18} aria-hidden="true" />
        {pending
          ? 'Ajout…'
          : unavailable
            ? 'Rupture de stock'
            : preorder
              ? 'Précommander'
              : 'Ajouter au panier'}
      </Button>
      <p id={id} role="status">
        {message || 'Votre sélection est conservée pendant 30 jours.'}
      </p>
    </div>
  );
}
