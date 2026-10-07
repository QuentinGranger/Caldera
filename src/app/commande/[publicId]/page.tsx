import { OrderFulfillment } from '@/components/fulfillment/OrderFulfillment';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCartCookie } from '@/lib/cart/cartCookie';
import { getPrisma } from '@/lib/db/prisma';
import { formatPrice } from '@/utils/formatPrice';
import { canReportProblem, canWithdraw } from '@/lib/returns/rules';
import { orderDocuments } from '@/lib/invoices/service';
import { getCustomerOrder } from '@/lib/orders/queries';
import { reconcileOwnedOrder } from '@/lib/payments/reconcile';
import { Container } from '@/components/ui/Container/Container';
import { OrderSummary } from '@/components/payment/OrderSummary';
import { OrderStatusRefresh } from '@/components/payment/OrderStatusRefresh';
import styles from '@/components/payment/Payment.module.scss';
export const dynamic = 'force-dynamic';
const refundDate = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'long',
  timeZone: 'Europe/Paris',
});
export const metadata: Metadata = {
  title: 'Votre commande',
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
  const access = (await searchParams).access;
  const token = await getCartCookie();

  let order = await reconcileOwnedOrder(publicId, token, { force: true });

  if (!order) {
    order = await getCustomerOrder(publicId, token, access);
  }

  if (!order) notFound();
  // Paid, then cancelled from the review: refunded, not a mere attempt.
  const [title, description] =
    order.status === 'CANCELLED' && order.payment?.status === 'SUCCEEDED'
      ? [
          'Commande annulée et remboursée',
          'Nous n’avons pas pu honorer votre commande : elle est intégralement remboursée. Selon votre banque, le montant apparaît sous 5 à 10 jours ouvrés.',
        ]
      : copy[order.status];
  // Refunds confirmed or on their way; failed attempts are the shop's business.
  const refunds = await getPrisma().refund.findMany({
    where: {
      orderId: order.id,
      status: { in: ['PENDING', 'REQUIRES_ACTION', 'SUCCEEDED'] },
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      amount: true,
      status: true,
      succeededAt: true,
      createdAt: true,
    },
  });
  const documents =
    order.status === 'PAID' ? await orderDocuments(order.id) : [];
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
            {refunds.length > 0 && (
              <div className={styles.refunds} role="status">
                <h3>Remboursements</h3>
                <ul>
                  {refunds.map((refund) => (
                    <li key={refund.id}>
                      {refund.status === 'SUCCEEDED'
                        ? `${formatPrice(refund.amount.toFixed(2))} remboursés le ${refundDate.format(refund.succeededAt ?? refund.createdAt)}`
                        : `${formatPrice(refund.amount.toFixed(2))} en cours de remboursement`}
                    </li>
                  ))}
                </ul>
                <p>
                  Le montant revient sur le moyen de paiement utilisé, sous 5 à
                  10 jours ouvrés selon votre banque.
                </p>
              </div>
            )}
            {documents.length > 0 && (
              <div className={styles.refunds}>
                <h3>Vos documents</h3>
                <ul>
                  {documents.map((document) => (
                    <li key={document.id}>
                      <a
                        href={`/commande/${publicId}/documents/${document.id}${access ? `?access=${encodeURIComponent(access)}` : ''}`}
                        target="_blank"
                        rel="noopener"
                      >
                        {document.kind === 'INVOICE' ? 'Facture' : 'Avoir'}{' '}
                        {document.number}
                      </a>{' '}
                      ({formatPrice(document.totalAmount.toFixed(2))})
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {order.status === 'PAID' &&
              (canWithdraw(order.deliveredAt) || canReportProblem(order)) && (
                <div className={styles.refunds}>
                  <h3>Retour ou rétractation</h3>
                  <p>
                    {canWithdraw(order.deliveredAt)
                      ? 'Vous pouvez vous rétracter sans justification dans les 14 jours suivant la réception, ou nous signaler un article abîmé.'
                      : 'Un article abîmé, défectueux ou différent de votre commande ? Signalez-le ici.'}
                  </p>
                  <p>
                    <Link
                      href={`/commande/${publicId}/retour${access ? `?access=${encodeURIComponent(access)}` : ''}`}
                    >
                      {canWithdraw(order.deliveredAt)
                        ? 'Se rétracter du contrat ici'
                        : 'Signaler un problème'}
                    </Link>
                  </p>
                </div>
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
