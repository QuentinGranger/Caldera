'use client';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
  type RefObject,
} from 'react';
import { usePathname } from 'next/navigation';
import { refreshCartAction } from '@/lib/cart/actions';
import type { CartActionResult, CartView } from '@/lib/cart/types';
import { CartDrawer } from './CartDrawer';

type CartContextValue = {
  cart: CartView;
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
export function CartProvider({
  cart,
  children,
}: {
  cart: CartView;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const busy = useRef(false);
  const cartButton = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const previousPath = useRef(pathname);
  function execute(
    action: () => Promise<CartActionResult>,
    openOnSuccess = false,
  ) {
    if (busy.current || pending) return;
    busy.current = true;
    setMessage('');
    startTransition(async () => {
      try {
        const result = await action();
        setMessage(result.message);
        if (result.success && openOnSuccess) setOpen(true);
      } catch {
        setMessage(
          'Impossible de joindre le panier. Vérifiez votre connexion puis réessayez.',
        );
      } finally {
        busy.current = false;
      }
    });
  }
  // Shared layouts persist across navigation. Refresh the personal snapshot
  // when changing pages so current prices and availability are read again.
  useEffect(() => {
    if (
      previousPath.current !== pathname &&
      pathname !== '/checkout' &&
      !pathname.startsWith('/checkout/') &&
      pathname !== '/admin' &&
      !pathname.startsWith('/admin/') &&
      !busy.current &&
      !pending
    ) {
      previousPath.current = pathname;
      execute(refreshCartAction);
    }
  });
  // Another tab may have changed the server cart; refetch on returning here.
  useEffect(() => {
    const refresh = () => {
      if (
        pathname !== '/checkout' &&
        !pathname.startsWith('/checkout/') &&
        pathname !== '/admin' &&
        !pathname.startsWith('/admin/') &&
        !busy.current &&
        !pending &&
        document.visibilityState === 'visible'
      )
        execute(refreshCartAction);
    };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  });
  return (
    <CartContext
      value={{ cart, pending, message, open, setOpen, cartButton, execute }}
    >
      {children}
      {pathname !== '/admin' && !pathname.startsWith('/admin/') && (
        <CartDrawer />
      )}
    </CartContext>
  );
}
