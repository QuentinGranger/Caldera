'use client';
import { useEffect, useState, type RefObject } from 'react';
import { ShoppingBag } from 'lucide-react';
import { useCart } from '@/components/cart/CartProvider';
import { addToCartAction } from '@/lib/cart/actions';
import { ADD_TO_CART_LABEL } from '@/lib/ux/copy';
import styles from './StickyBuyBar.module.scss';

/**
 * Phones and tablets: the price, the stock and the button stay in reach
 * while the buy button of the page is out of sight (below the first screen,
 * or scrolled past), and give way to the footer. It does not exist for a
 * product that cannot be bought. Wide screens keep the panel beside the
 * gallery and never show it.
 */
export function StickyBuyBar({
  target,
  variantId,
  quantity,
  price,
  stock,
  preorder,
}: {
  /** The page's own buy button: the bar shows when it does not. */
  target: RefObject<HTMLElement | null>;
  variantId: string;
  quantity: number;
  price: string;
  stock: string;
  preorder: boolean;
}) {
  const { pending, execute } = useCart();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const button = target.current;
    const footer = document.querySelector('footer');
    if (!button || !('IntersectionObserver' in window)) return;
    let buttonOut = false,
      footerIn = false;
    const update = () => setVisible(buttonOut && !footerIn);
    // The band under the bar counts as hidden: no flicker at its edge.
    const watchButton = new IntersectionObserver(
      ([entry]) => {
        buttonOut = !entry!.isIntersecting;
        update();
      },
      { rootMargin: '0px 0px -88px 0px' },
    );
    const watchFooter = new IntersectionObserver(([entry]) => {
      footerIn = entry!.isIntersecting;
      update();
    });
    watchButton.observe(button);
    if (footer) watchFooter.observe(footer);
    return () => {
      watchButton.disconnect();
      watchFooter.disconnect();
    };
  }, [target]);
  return (
    <div
      className={styles.bar}
      data-visible={visible || undefined}
      // Not reachable, not read, while the page's own button is on screen.
      inert={!visible}
    >
      <div className={styles.summary}>
        <strong>{price}</strong>
        <span>{stock}</span>
      </div>
      <button
        type="button"
        disabled={pending}
        aria-busy={pending || undefined}
        onClick={() =>
          execute(() => addToCartAction(variantId, quantity), true)
        }
      >
        <ShoppingBag size={18} aria-hidden="true" />
        {pending ? 'Ajout…' : preorder ? 'Précommander' : ADD_TO_CART_LABEL}
      </button>
    </div>
  );
}
