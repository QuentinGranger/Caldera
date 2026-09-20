import { CheckoutProgress } from '@/components/checkout/CheckoutProgress';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCartCookie } from '@/lib/cart/cartCookie';
import { getOwnedOrder } from '@/lib/orders/queries';
import { Container } from '@/components/ui/Container/Container';
import { PaymentForm, CancelPayment } from '@/components/payment/PaymentForm';
import { OrderSummary } from '@/components/payment/OrderSummary';
import styles from '@/components/payment/Payment.module.scss';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Paiement | Les Terres de Caldera',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function PaymentPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  const order = await getOwnedOrder(publicId, await getCartCookie());

  if (!order) notFound();

  if (!['PENDING_PAYMENT', 'PAYMENT_FAILED'].includes(order.status))
    redirect(`/commande/${publicId}`);

  const expiresAt = order.reservations[0]?.expiresAt;
  const expired = !expiresAt || expiresAt <= new Date();

  return (
    <main id="contenu" className={styles.main}>
      <Container>
        <CheckoutProgress step="payment" requiredStep="review" />

        <div className={styles.heading}>
          <p className={styles.eyebrow}>04 · Paiement</p>
          <h1>Votre collection vous attend.</h1>
          <p>Commande {order.orderNumber}</p>
          <p>
            Votre sélection et vos coordonnées sont figées pour cette tentative.
          </p>
        </div>

        <div className={styles.grid}>
          {expired ? (
            <section className={styles.panel}>
              <h2>Réservation arrivée à échéance</h2>
              <p>
                Cette tentative va être clôturée automatiquement afin de libérer
                la sélection et vous permettre de reprendre votre panier.
              </p>
              <CancelPayment publicId={publicId} auto />
              <Link href={`/commande/${publicId}`}>Consulter la commande</Link>
            </section>
          ) : (
            <PaymentForm
              publicId={publicId}
              amount={order.totalAmount.toFixed(2)}
              expiresAt={expiresAt.toISOString()}
            />
          )}

          <OrderSummary order={order} />
        </div>
      </Container>
    </main>
  );
}
