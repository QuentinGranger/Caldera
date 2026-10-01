import type { Metadata } from 'next';
import { Container } from '@/components/ui/Container/Container';
import { CartPageContent } from '@/components/cart/CartPageContent';
import { getCheckout } from '@/lib/checkout/getCheckout';
import { toCartPromotionState } from '@/lib/checkout/types';

export const metadata: Metadata = {
  title: 'Votre panier',
  robots: { index: false, follow: false },
};

export default async function CartPage() {
  const promotionState = toCartPromotionState(await getCheckout());

  return (
    <main id="contenu">
      <Container>
        <CartPageContent initialPromotionState={promotionState} />
      </Container>
    </main>
  );
}
