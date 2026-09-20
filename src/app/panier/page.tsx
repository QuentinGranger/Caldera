import type { Metadata } from 'next';
import { Container } from '@/components/ui/Container/Container';
import { CartPageContent } from '@/components/cart/CartPageContent';
export const metadata: Metadata = {
  title: 'Votre panier | Les Terres de Caldera',
  robots: { index: false, follow: false },
};
export default function CartPage() {
  return (
    <main id="contenu">
      <Container>
        <CartPageContent />
      </Container>
    </main>
  );
}
