import { getCartCookie } from '@/lib/cart/cartCookie';
import { getActiveOrder } from '@/lib/orders/queries';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Container } from '@/components/ui/Container/Container';
import { CheckoutFlow } from '@/components/checkout/CheckoutFlow';
import { getCheckout } from '@/lib/checkout/getCheckout';
import type { CheckoutStep } from '@/lib/checkout/types';
import styles from '@/components/checkout/Checkout.module.scss';
export const metadata: Metadata = {
  title: 'Commande | Les Terres de Caldera',
  robots: { index: false, follow: false },
};
const steps: CheckoutStep[] = ['contact', 'shipping', 'review'];
export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string | string[] }>;
}) {
  const active = await getActiveOrder(await getCartCookie());
  if (active) redirect(`/checkout/paiement/${active.publicId}`);
  const view = await getCheckout();
  if (!view) redirect('/panier');
  const requested = (await searchParams).step;
  const step = steps.includes(requested as CheckoutStep)
    ? (requested as CheckoutStep)
    : view.requiredStep;
  if (steps.indexOf(step) > steps.indexOf(view.requiredStep))
    redirect(`/checkout?step=${view.requiredStep}`);
  return (
    <main id="contenu" className={styles.main}>
      <Container>
        <CheckoutFlow
          key={`${view.sessionId}-${step}`}
          view={view}
          step={step}
        />
      </Container>
    </main>
  );
}
