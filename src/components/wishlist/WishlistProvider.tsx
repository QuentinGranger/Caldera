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
import { usePathname, useRouter } from 'next/navigation';
import {
  mergeGuestFavoritesAction,
  setWishlistProductAction,
} from '@/lib/wishlist/actions';
import type { WishlistSnapshot } from '@/lib/wishlist/data';
import styles from './WishlistProvider.module.scss';

type WishlistContextValue = {
  count: number;
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
  snapshot,
  children,
}: {
  snapshot: WishlistSnapshot;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [productIds, setProductIds] = useState(
    () => new Set(snapshot.productIds),
  );
  const [serverSnapshot, setServerSnapshot] = useState(snapshot);
  if (serverSnapshot !== snapshot) {
    setServerSnapshot(snapshot);
    setProductIds(new Set(snapshot.productIds));
  }
  const [pendingIds, setPendingIds] = useState(() => new Set<string>());
  const [message, setMessage] = useState('');
  const [, startTransition] = useTransition();
  const idsRef = useRef(productIds);
  const pendingRef = useRef(pendingIds);
  const mergeStarted = useRef(false);
  idsRef.current = productIds;
  pendingRef.current = pendingIds;

  function updateProducts(ids: readonly string[]) {
    const next = new Set(ids);
    idsRef.current = next;
    setProductIds(next);
  }

  function updatePending(next: Set<string>) {
    pendingRef.current = next;
    setPendingIds(next);
  }

  useEffect(() => {
    if (!snapshot.authenticated || !snapshot.hasGuestFavorites) {
      mergeStarted.current = false;
      return;
    }
    if (mergeStarted.current) return;
    mergeStarted.current = true;
    startTransition(async () => {
      try {
        const merged = await mergeGuestFavoritesAction();
        updateProducts(merged.productIds);
        setMessage(merged.message);
        if (merged.success && pathname === '/favoris') router.refresh();
      } catch {
        setMessage('Impossible de synchroniser vos favoris pour le moment.');
      }
    });
  }, [pathname, router, snapshot.authenticated, snapshot.hasGuestFavorites]);

  function toggle(productId: string) {
    if (pendingRef.current.has(productId)) return;
    const previous = [...idsRef.current];
    const nextFavorite = !idsRef.current.has(productId);
    const optimistic = new Set(idsRef.current);
    if (nextFavorite) optimistic.add(productId);
    else optimistic.delete(productId);
    updateProducts([...optimistic]);
    updatePending(new Set(pendingRef.current).add(productId));
    setMessage('');

    startTransition(async () => {
      try {
        const result = await setWishlistProductAction(productId, nextFavorite);
        updateProducts(result.productIds);
        setMessage(result.message);
        if (result.success && pathname === '/favoris') router.refresh();
      } catch {
        updateProducts(previous);
        setMessage('Impossible de modifier vos favoris pour le moment.');
      } finally {
        const next = new Set(pendingRef.current);
        next.delete(productId);
        updatePending(next);
      }
    });
  }

  return (
    <WishlistContext
      value={{
        count: productIds.size,
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
