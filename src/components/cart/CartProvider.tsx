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
  type RefObject,
} from 'react';
import { usePathname } from 'next/navigation';
import { refreshCartAction } from '@/lib/cart/actions';
import type { CartActionResult, CartView } from '@/lib/cart/types';
import type { ShippingOptionView } from '@/lib/product/services';
import { CartDrawer } from './CartDrawer';

type CartContextValue = {
  cart: CartView;
  /** The delivery methods offered, for what the cart says of delivery. */
  shipping: ShippingOptionView[];
  pending: boolean;
  message: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  cartButton: RefObject<HTMLButtonElement | null>;
  execute: (
    action: () => Promise<CartActionResult>,
    openOnSuccess?: boolean,
  ) => void;
};
const CartContext = createContext<CartContextValue | null>(null);
export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('CartProvider manquant.');
  return context;
}

/** Background refreshes closer than this reuse the current snapshot. */
const REFRESH_INTERVAL_MS = 15_000;

function isPrivateArea(pathname: string) {
  return (
    pathname === '/checkout' ||
    pathname.startsWith('/checkout/') ||
    pathname === '/admin' ||
    pathname.startsWith('/admin/')
  );
}

export function CartProvider({
  cart: serverCart,
  shipping,
  enabled = true,
  children,
}: {
  cart: CartView;
  shipping: ShippingOptionView[];
  enabled?: boolean;
  children: ReactNode;
}) {
  // The layout snapshot wins whenever the server renders it again (cookie
  // change, router.refresh); actions then keep the client copy current.
  const [cart, setCart] = useState(serverCart);
  const [snapshot, setSnapshot] = useState(serverCart);
  if (snapshot !== serverCart) {
    setSnapshot(serverCart);
    setCart(serverCart);
  }
  const pathname = usePathname();
  // A message belongs to the page where it was produced.
  const [feedback, setFeedback] = useState({ path: pathname, text: '' });
  const message = feedback.path === pathname ? feedback.text : '';
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const busy = useRef(false);
  const cartButton = useRef<HTMLButtonElement>(null);
  const previousPath = useRef(pathname);
  // Only the answer to the latest request is applied.
  const lastRequest = useRef(0);
  const lastSync = useRef(0);

  function apply(request: number, result: CartActionResult) {
    if (request !== lastRequest.current) return;
    setCart(result.cart);
    lastSync.current = Date.now();
  }

  function execute(
    action: () => Promise<CartActionResult>,
    openOnSuccess = false,
  ) {
    if (busy.current || pending) return;
    busy.current = true;
    const request = ++lastRequest.current;
    const path = pathname;
    setFeedback({ path, text: '' });
    startTransition(async () => {
      try {
        const result = await action();
        apply(request, result);
        setFeedback({ path, text: result.message });
        if (result.success && openOnSuccess) setOpen(true);
      } catch {
        setFeedback({
          path,
          text: 'Impossible de joindre le panier. Vérifiez votre connexion puis réessayez.',
        });
      } finally {
        busy.current = false;
      }
    });
  }

  // Silent re-read of prices and availability: no pending state, no message,
  // and no re-render of the page (refreshCartAction only returns data).
  const refresh = useEffectEvent(() => {
    if (
      !enabled ||
      isPrivateArea(pathname) ||
      busy.current ||
      pending ||
      document.visibilityState !== 'visible' ||
      Date.now() - lastSync.current < REFRESH_INTERVAL_MS
    )
      return;
    const request = ++lastRequest.current;
    refreshCartAction().then(
      (result) => apply(request, result),
      () => {
        /* Kept as is; the next action or refresh reports errors. */
      },
    );
  });

  useEffect(() => {
    lastSync.current = Date.now();
  }, [serverCart]);

  // Shared layouts persist across navigation: read the cart again on a new page.
  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    refresh();
  }, [pathname]);

  // Another tab may have changed the server cart; refetch on returning here.
  useEffect(() => {
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  return (
    <CartContext
      value={{
        cart,
        shipping,
        pending,
        message,
        open,
        setOpen,
        cartButton,
        execute,
      }}
    >
      {children}
      {enabled && pathname !== '/admin' && !pathname.startsWith('/admin/') && (
        <CartDrawer />
      )}
    </CartContext>
  );
}
