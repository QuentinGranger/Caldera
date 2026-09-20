'use client';
import { ShoppingBag } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton/IconButton';
import { refreshCartAction } from '@/lib/cart/actions';
import { useCart } from './CartProvider';
import styles from './CartButton.module.scss';
export function CartButton() {
  const { cart, open, setOpen, cartButton, execute } = useCart();
  return (
    <IconButton
      ref={cartButton}
      className={styles.button}
      label={
        cart.readError
          ? 'Panier momentanément indisponible'
          : `Ouvrir le panier · ${cart.itemCount} article${cart.itemCount === 1 ? '' : 's'}`
      }
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls="caldera-cart-drawer"
      onClick={() => {
        setOpen(true);
        execute(refreshCartAction);
      }}
    >
      <ShoppingBag aria-hidden="true" />
      {cart.itemCount > 0 && (
        <span aria-hidden="true" className={styles.badge}>
          {cart.itemCount}
        </span>
      )}
    </IconButton>
  );
}
