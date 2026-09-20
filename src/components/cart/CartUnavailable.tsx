'use client';
import { Button } from '@/components/ui/Button/Button';
import { refreshCartAction } from '@/lib/cart/actions';
import { useCart } from './CartProvider';
import styles from './CartEmpty.module.scss';
export function CartUnavailable() {
  const { cart, execute, pending } = useCart();
  return (
    <div className={styles.empty} role="status">
      <p>{cart.readError}</p>
      <Button disabled={pending} onClick={() => execute(refreshCartAction)}>
        Réessayer
      </Button>
    </div>
  );
}
