'use client';

import {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  refreshWishlistAction,
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

function sameIds(left: ReadonlySet<string>, right: readonly string[]) {
  return left.size === right.length && right.every((id) => left.has(id));
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
  const [pendingIds, setPendingIds] = useState(() => new Set<string>());
  const [serverSnapshot, setServerSnapshot] = useState(snapshot);
  if (serverSnapshot !== snapshot) {
    setServerSnapshot(snapshot);
    if (!pendingIds.size) setProductIds(new Set(snapshot.productIds));
  }
  const [message, setMessage] = useState('');
  const [, startTransition] = useTransition();
  const idsRef = useRef(productIds);
  const pendingRef = useRef(pendingIds);
  const refreshBusy = useRef(false);
  const mergeStarted = useRef(false);
  const previousPath = useRef(pathname);
  const latestMutation = useRef(0);

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
    idsRef.current = productIds;
  }, [productIds]);

  const refresh = useEffectEvent((announceMerge = false) => {
    if (refreshBusy.current || pendingRef.current.size) return;
    refreshBusy.current = true;
    startTransition(async () => {
      try {
        const result = await refreshWishlistAction();
        const changed =
          !result.readError && !sameIds(idsRef.current, result.productIds);
        if (!result.readError) updateProducts(result.productIds);
        if (announceMerge && result.message) setMessage(result.message);
        if (changed && pathname === '/favoris') router.refresh();
      } catch {
        if (announceMerge)
          setMessage('Impossible de synchroniser vos favoris pour le moment.');
      } finally {
        refreshBusy.current = false;
      }
    });
  });

  // Shared layouts persist across navigation. Re-read the cookie/database on a
  // new page, and merge guest favorites after a login redirect.
  useEffect(() => {
    const changedPath = previousPath.current !== pathname;
    previousPath.current = pathname;
    const needsMerge =
      snapshot.authenticated &&
      snapshot.hasGuestFavorites &&
      !mergeStarted.current;
    if (!snapshot.hasGuestFavorites) mergeStarted.current = false;
    if (needsMerge) mergeStarted.current = true;
    if (changedPath || needsMerge) refresh(needsMerge);
  }, [pathname, snapshot.authenticated, snapshot.hasGuestFavorites]);

  // Cookies are shared between tabs. Returning to this tab picks up a favorite,
  // login or logout performed elsewhere.
  useEffect(() => {
    const onFocus = () => refresh(false);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(''), 4500);
    return () => window.clearTimeout(timeout);
  }, [message]);

  function toggle(productId: string) {
    if (pendingRef.current.has(productId)) return;
    const request = ++latestMutation.current;
    const wasFavorite = idsRef.current.has(productId);
    const nextFavorite = !wasFavorite;
    const optimistic = new Set(idsRef.current);
    if (nextFavorite) optimistic.add(productId);
    else optimistic.delete(productId);
    updateProducts([...optimistic]);
    updatePending(new Set(pendingRef.current).add(productId));
    setMessage('');

    startTransition(async () => {
      try {
        const result = await setWishlistProductAction(productId, nextFavorite);
        if (request === latestMutation.current) {
          if (!result.readError) updateProducts(result.productIds);
          else if (!result.success) {
            const rollback = new Set(idsRef.current);
            if (wasFavorite) rollback.add(productId);
            else rollback.delete(productId);
            updateProducts([...rollback]);
          }
          setMessage(result.message);
          if (result.success && pathname === '/favoris') router.refresh();
        }
      } catch {
        if (request === latestMutation.current) {
          const rollback = new Set(idsRef.current);
          if (wasFavorite) rollback.add(productId);
          else rollback.delete(productId);
          updateProducts([...rollback]);
          setMessage('Impossible de modifier vos favoris pour le moment.');
        }
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
