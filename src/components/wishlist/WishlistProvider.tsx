'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import { setWishlistProductAction } from '@/lib/wishlist/actions';
import styles from './WishlistProvider.module.scss';

type WishlistContextValue = {
  authenticated: boolean;
  isFavorite: (productId: string) => boolean;
  isPending: (productId: string) => boolean;
  toggle: (productId: string) => void;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) throw new Error('WishlistProvider manquant.');
  return context;
}

export function WishlistProvider({
  authenticated,
  initialProductIds,
  children,
}: {
  authenticated: boolean;
  initialProductIds: string[];
  children: ReactNode;
}) {
  const [productIds, setProductIds] = useState(
    () => new Set(initialProductIds),
  );
  const [pendingIds, setPendingIds] = useState(() => new Set<string>());
  const [message, setMessage] = useState('');
  const [, startTransition] = useTransition();
  const productIdsRef = useRef(productIds);
  const pendingIdsRef = useRef(pendingIds);

  useEffect(() => {
    if (pendingIdsRef.current.size) return;
    const next = new Set(initialProductIds);
    productIdsRef.current = next;
    setProductIds(next);
  }, [initialProductIds]);

  function updateProducts(next: Set<string>) {
    productIdsRef.current = next;
    setProductIds(next);
  }

  function updatePending(next: Set<string>) {
    pendingIdsRef.current = next;
    setPendingIds(next);
  }

  function toggle(productId: string) {
    if (!authenticated || pendingIdsRef.current.has(productId)) return;

    const wasFavorite = productIdsRef.current.has(productId);
    const nextFavorite = !wasFavorite;
    const optimistic = new Set(productIdsRef.current);
    if (nextFavorite) optimistic.add(productId);
    else optimistic.delete(productId);
    updateProducts(optimistic);
    updatePending(new Set(pendingIdsRef.current).add(productId));
    setMessage('');

    startTransition(async () => {
      try {
        const result = await setWishlistProductAction(productId, nextFavorite);
        if (!result.success) {
          const rollback = new Set(productIdsRef.current);
          if (wasFavorite) rollback.add(productId);
          else rollback.delete(productId);
          updateProducts(rollback);
        }
        setMessage(result.message);
      } catch {
        const rollback = new Set(productIdsRef.current);
        if (wasFavorite) rollback.add(productId);
        else rollback.delete(productId);
        updateProducts(rollback);
        setMessage('Impossible de modifier vos favoris pour le moment.');
      } finally {
        const nextPending = new Set(pendingIdsRef.current);
        nextPending.delete(productId);
        updatePending(nextPending);
      }
    });
  }

  return (
    <WishlistContext
      value={{
        authenticated,
        isFavorite: (productId) => productIds.has(productId),
        isPending: (productId) => pendingIds.has(productId),
        toggle,
      }}
    >
      {children}
      <p className={styles.status} role="status" aria-live="polite">
        {message}
      </p>
    </WishlistContext>
  );
}
