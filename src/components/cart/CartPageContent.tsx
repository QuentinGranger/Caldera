'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { clearCartAction } from '@/lib/cart/actions';
import { useCart } from './CartProvider';
import { CartItem } from './CartItem';
import { CartUnavailable } from './CartUnavailable';
import { CartEmpty } from './CartEmpty';
import { CartSummary } from './CartSummary';
import styles from './CartPageContent.module.scss';
export function CartPageContent() {
  const { cart, pending, message, execute } = useCart();
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <div className={styles.heading}>
        <span>LES TERRES DE CALDERA</span>
        <h1>Votre panier</h1>
        <p>
          {cart.itemCount} article{cart.itemCount === 1 ? '' : 's'} dans votre
          sélection
        </p>
      </div>
      <p className={styles.feedback} role="status">
        {pending ? 'Mise à jour du panier…' : message}
      </p>
      {cart.readError ? (
        <CartUnavailable />
      ) : cart.items.length ? (
        <div className={styles.grid} aria-busy={pending}>
          <section aria-label="Articles du panier">
            <ul className={styles.items}>
              {cart.items.map((item) => (
                <CartItem key={item.id} item={item} />
              ))}
            </ul>
            <div className={styles.actions}>
              <Link href="/catalogue">
                <ArrowLeft size={16} aria-hidden="true" /> Continuer mes achats
              </Link>
              {confirm ? (
                <div className={styles.confirm}>
                  <p>Retirer tous les articles ?</p>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      execute(clearCartAction);
                      setConfirm(false);
                    }}
                  >
                    Oui, vider le panier
                  </button>
                  <button type="button" onClick={() => setConfirm(false)}>
                    Annuler
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setConfirm(true)}
                >
                  Vider le panier
                </button>
              )}
            </div>
          </section>
          <aside>
            <CartSummary cart={cart} />
          </aside>
        </div>
      ) : (
        <CartEmpty />
      )}
    </>
  );
}
