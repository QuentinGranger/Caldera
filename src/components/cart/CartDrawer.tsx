'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton/IconButton';
import { formatPrice } from '@/utils/formatPrice';
import { useCart } from './CartProvider';
import { CartItem } from './CartItem';
import { CartUnavailable } from './CartUnavailable';
import { CartEmpty } from './CartEmpty';
import styles from './CartDrawer.module.scss';
export function CartDrawer() {
  const { cart, pending, message, open, setOpen, cartButton } = useCart();
  const dialog = useRef<HTMLDialogElement>(null);
  const overlayStart = useRef(false);
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);
  return (
    <dialog
      ref={dialog}
      id="caldera-cart-drawer"
      className={styles.drawer}
      aria-labelledby="cart-drawer-title"
      onClose={() => {
        setOpen(false);
        cartButton.current?.focus();
      }}
      onPointerDown={(event) => {
        overlayStart.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (overlayStart.current && event.target === event.currentTarget)
          setOpen(false);
      }}
    >
      <div className={styles.panel}>
        <header className={styles.header}>
          <div>
            <span>VOTRE EXPÉDITION</span>
            <h2 id="cart-drawer-title">
              Le panier <small>({cart.itemCount})</small>
            </h2>
          </div>
          <IconButton label="Fermer le panier" onClick={() => setOpen(false)}>
            <X aria-hidden="true" />
          </IconButton>
        </header>
        <p className={styles.feedback} role="status">
          {pending ? 'Mise à jour du panier…' : message}
        </p>
        <div className={styles.content} aria-busy={pending}>
          {cart.readError ? (
            <CartUnavailable />
          ) : cart.items.length ? (
            <ul>
              {cart.items.map((item) => (
                <CartItem
                  key={item.id}
                  item={item}
                  onNavigate={() => setOpen(false)}
                />
              ))}
            </ul>
          ) : (
            <CartEmpty onNavigate={() => setOpen(false)} />
          )}
        </div>
        {cart.items.length > 0 && (
          <footer className={styles.footer}>
            {cart.hasUnavailableItems && (
              <p className={styles.warning}>
                Certains articles nécessitent votre attention.
              </p>
            )}
            <div>
              <span>Sous-total</span>
              <strong>{formatPrice(cart.subtotal)}</strong>
            </div>
            <p>Livraison calculée lors de la commande.</p>
            <Link href="/panier" onClick={() => setOpen(false)}>
              Voir mon panier
            </Link>
          </footer>
        )}
      </div>
    </dialog>
  );
}
