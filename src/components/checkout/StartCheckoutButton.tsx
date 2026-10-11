'use client';
import { trackCommerce } from '@/lib/analytics/client';
import { useCart } from '@/components/cart/CartProvider';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button/Button';
import { startCheckoutAction } from '@/lib/checkout/actions';
import { useCheckoutAction } from './useCheckoutAction';
export function StartCheckoutButton({
  disabled = false,
  restart = false,
  variant = 'primary',
}: {
  disabled?: boolean;
  restart?: boolean;
  variant?: 'primary' | 'gold';
}) {
  const { cart } = useCart();
  const { execute, pending, result } = useCheckoutAction();
  return (
    <div>
      <Button
        variant={variant}
        disabled={disabled || pending}
        onClick={() =>
          execute(async () => {
            const response = await startCheckoutAction();
            if (response.success)
              trackCommerce('begin_checkout', {
                items: cart.items.map((item) => ({
                  item_id: item.variantId,
                  item_name: item.name,
                  price: Number(item.price),
                  quantity: item.quantity,
                })),
                value: Number(cart.subtotal),
              });
            return response;
          })
        }
      >
        {pending
          ? 'Préparation…'
          : restart
            ? 'Démarrer une nouvelle session'
            : 'Passer à la commande'}
        {!restart && <ArrowRight size={18} aria-hidden="true" />}
      </Button>
      <p role="status">{result?.message}</p>
    </div>
  );
}
