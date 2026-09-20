import { OrderFulfillment } from '@/components/fulfillment/OrderFulfillment';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCartCookie } from '@/lib/cart/cartCookie';
import { getCustomerOrder } from '@/lib/orders/queries';
import { reconcileOwnedOrder } from '@/lib/payments/reconcile';
import { Container } from '@/components/ui/Container/Container';
import { OrderSummary } from '@/components/payment/OrderSummary';
import { OrderStatusRefresh } from '@/components/payment/OrderStatusRefresh';
import styles from '@/components/payment/Payment.module.scss';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Votre commande | Les Terres de Caldera',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};
const copy = {
  PAID: [
    'Votre commande est confirmée',
    'Votre paiement a été confirmé. Merci pour votre confiance.',
  ],
  PENDING_PAYMENT: [
    'En attente de confirmation',
    'La commande sera confirmée après vérification du paiement.',
  ],
  PAYMENT_PROCESSING: [
    'Votre paiement est en cours',
    'Nous attendons sa confirmation. Ne démarrez pas un autre paiement.',
  ],
  PAYMENT_FAILED: [
    'Le paiement n’a pas abouti',
    'Vous pouvez réessayer tant que votre réservation reste valide.',
  ],
  PAYMENT_REVIEW: [
    'Votre commande nécessite une vérification',
    'Ne recommencez pas le paiement. Conservez votre numéro de commande et contactez la boutique.',
  ],
  CANCELLED: [
    'Tentative annulée',
    'Votre panier reste disponible pour une nouvelle commande.',
  ],
  EXPIRED: [
    'La réservation a expiré',
    'Reprenez votre panier pour vérifier la disponibilité des articles.',
  ],
} as const;
export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ publicId: string }>;
  searchParams: Promise<{ access?: string }>;
}) {
  const { publicId } = await params;
  const token = await getCartCookie();

  let order = await reconcileOwnedOrder(publicId, token, { force: true });

  if (!order) {
    order = await getCustomerOrder(
      publicId,
      token,
      (await searchParams).access,
    );
  }

  if (!order) notFound();
  const [title, description] = copy[order.status];
  return (
    <main id="contenu" className={styles.main}>
      <Container>
        <div className={styles.heading}>
          <p className={styles.eyebrow}>Commande {order.orderNumber}</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className={styles.grid}>
          <section className={styles.panel}>
            <h2>Votre commande Caldera</h2>
            <p>
              Retrouvez ici les informations enregistrées au moment de votre
              achat.
            </p>
            {[
              'PENDING_PAYMENT',
              'PAYMENT_PROCESSING',
              'PAYMENT_FAILED',
            ].includes(order.status) && (
              <OrderStatusRefresh
                key={order.status}
                publicId={publicId}
                status={order.status}
              />
            )}
            <div className={styles.actions}>
              {['PENDING_PAYMENT', 'PAYMENT_FAILED'].includes(order.status) && (
                <Link href={`/checkout/paiement/${publicId}`}>
                  Reprendre le paiement
                </Link>
              )}
              {['CANCELLED', 'EXPIRED'].includes(order.status) && (
                <Link href="/checkout">Reprendre mon panier</Link>
              )}
              <Link href="/">Retour aux terres</Link>
            </div>
          </section>
          <OrderSummary order={order} />
        </div>
        <OrderFulfillment order={order} />
      </Container>
    </main>
  );
}
