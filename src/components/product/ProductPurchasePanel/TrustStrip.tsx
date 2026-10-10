import { PurchaseAssurance } from '@/components/shipping/PurchaseAssurance';

/** The same policies as the cart, directly below the product purchase button. */
export function TrustStrip({
  sealed,
  secureOrders,
  preorder,
}: {
  sealed: boolean;
  secureOrders: boolean;
  preorder: boolean;
}) {
  return (
    <PurchaseAssurance
      sealed={sealed}
      commerce={secureOrders}
      preorder={preorder}
    />
  );
}
