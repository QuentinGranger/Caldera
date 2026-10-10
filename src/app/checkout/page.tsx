import { getCartCookie } from '@/lib/cart/cartCookie';
import { currentCustomer } from '@/lib/account/auth';
import { getCustomerAddress } from '@/lib/account/queries';
import { getActiveOrder } from '@/lib/orders/queries';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { Container } from '@/components/ui/Container/Container';
import { CheckoutFlow } from '@/components/checkout/CheckoutFlow';
import { CheckoutPageSkeleton } from '@/components/loading/LoadingSkeleton';
import { getCheckout } from '@/lib/checkout/getCheckout';
import type { CheckoutStep } from '@/lib/checkout/types';
import styles from '@/components/checkout/Checkout.module.scss';
export const metadata: Metadata = {
  title: 'Commande',
  robots: { index: false, follow: false },
};
const steps: CheckoutStep[] = ['contact', 'shipping', 'review'];
async function CheckoutContent({
  checkout,
  step,
}: {
  checkout: NonNullable<Awaited<ReturnType<typeof getCheckout>>>;
  step: CheckoutStep;
}) {
  // A signed-in customer starts from the account's e-mail and saved address;
  // anything already typed in this checkout wins.
  const customer = await currentCustomer();
  const address =
    customer && !checkout.contact.email
      ? await getCustomerAddress(customer.id)
      : null;
  const view =
    customer && !checkout.contact.email
      ? {
          ...checkout,
          contact: {
            ...checkout.contact,
            email: customer.email,
            phone: address?.phone ?? checkout.contact.phone,
            shipping: address
              ? { ...address, phone: '' }
              : checkout.contact.shipping,
          },
        }
      : checkout;
  return (
    <main id="contenu" className={styles.main}>
      <Container>
        <CheckoutFlow
          key={`${view.sessionId}-${step}`}
          view={view}
          step={step}
          account={customer ? { email: customer.email } : null}
        />
      </Container>
    </main>
  );
}

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string | string[] }>;
}) {
  if (process.env.CATALOG_DEMO_MODE === '1') redirect('/catalogue');
  // Authentication/order redirects must settle before streaming a fallback.
  const active = await getActiveOrder(await getCartCookie());
  if (active) redirect(`/checkout/paiement/${active.publicId}`);
  const checkout = await getCheckout();
  if (!checkout) redirect('/panier');

  const requested = (await searchParams).step;
  const step = steps.includes(requested as CheckoutStep)
    ? (requested as CheckoutStep)
    : checkout.requiredStep;
  if (steps.indexOf(step) > steps.indexOf(checkout.requiredStep))
    redirect(`/checkout?step=${checkout.requiredStep}`);

  return (
    <Suspense fallback={<CheckoutPageSkeleton />}>
      <CheckoutContent checkout={checkout} step={step} />
    </Suspense>
  );
}
