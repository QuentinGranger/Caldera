import { FulfillmentPanel } from '@/components/admin/FulfillmentPanel';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAdminOrder } from '@/lib/admin/queries';
import { cancelOrderAction, orderNoteAction } from '@/lib/admin/actions';
import { euros, formatDate, label } from '@/lib/admin/format';
import {
  PageHeader,
  AdminTable,
  Badge,
  IntegrityWarning,
} from '@/components/admin/AdminUI';
import { AdminForm } from '@/components/admin/AdminForm';
import { Hidden, TextField } from '@/components/admin/AdminFields';
import { CopyButton } from '@/components/admin/CopyButton';
import styles from '@/components/admin/Admin.module.scss';
export default async function OrderAdminPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const order = await getAdminOrder((await params).id);
  if (!order) notFound();
  const payment = order.payment;
  const inconsistent =
    order.status === 'PAID' &&
    (payment?.status !== 'SUCCEEDED' ||
      order.reservations.some((item) => item.status !== 'CONSUMED') ||
      !order.reservations.length);
  const timeline = [
    { date: order.createdAt, text: 'Commande créée' },
    ...(payment
      ? [
          {
            date: payment.updatedAt,
            text: `Paiement : ${label(payment.status)}`,
          },
        ]
      : []),
    ...(order.paidAt ? [{ date: order.paidAt, text: 'Commande payée' }] : []),
    ...(order.cancelledAt
      ? [{ date: order.cancelledAt, text: 'Commande annulée' }]
      : []),
    ...order.reservations.map((reservation) => ({
      date: reservation.updatedAt,
      text: `Réservation ${reservation.variant.sku} : ${label(reservation.status)}`,
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());
  return (
    <>
      <PageHeader
        title={order.orderNumber}
        description={`Créée le ${formatDate(order.createdAt)} · heure de Paris`}
      >
        <div className={styles.inline}>
          <Badge value={order.status} />
          <CopyButton value={order.orderNumber} label="le numéro de commande" />
          <Link href="/admin/commandes">Retour aux commandes</Link>
        </div>
      </PageHeader>
      {inconsistent && (
        <IntegrityWarning>
          Commande payée avec un paiement ou des réservations incohérents.
          Vérification technique nécessaire ; aucune correction automatique.
        </IntegrityWarning>
      )}
      {order.status === 'PAYMENT_REVIEW' && (
        <IntegrityWarning>
          Cette commande nécessite une vérification du paiement et du stock.
          Aucune action destructive n’est disponible.
        </IntegrityWarning>
      )}
      <section className={styles.card}>
        <h2>Identifiants & client</h2>
        <p>
          {order.email}
          {order.phone ? ` · ${order.phone}` : ''}
        </p>
        <small>Identifiant public</small>
        <div className={styles.inline}>
          <code>{order.publicId}</code>
          <CopyButton value={order.publicId} label="l’identifiant public" />
        </div>
      </section>
      <section className={styles.card}>
        <h2>Articles commandés</h2>
        <AdminTable
          caption="Snapshots des articles"
          headings={[
            'Article',
            'SKU / langue',
            'Prix unitaire',
            'Quantité',
            'Total',
          ]}
        >
          {order.items.map((item) => (
            <tr key={item.id}>
              <td>
                <div className={styles.inline}>
                  <Image src={item.imageUrl} alt="" width={45} height={55} />
                  <span>
                    {item.productName}
                    {item.productId && (
                      <small>
                        <Link href={`/admin/produits/${item.productId}`}>
                          Ouvrir le produit actuel
                        </Link>
                      </small>
                    )}
                  </span>
                </div>
              </td>
              <td>
                <code>{item.sku}</code>
                <small>{label(item.language)}</small>
                <CopyButton value={item.sku} label="le SKU" />
              </td>
              <td>{euros(item.unitPrice)}</td>
              <td>{item.quantity}</td>
              <td>{euros(item.lineTotal)}</td>
            </tr>
          ))}
        </AdminTable>
        <p>
          Sous-total : {euros(order.subtotalAmount)} · Livraison :{' '}
          {euros(order.shippingAmount)} ·{' '}
          <strong>Total : {euros(order.totalAmount)}</strong>
        </p>
        <small>
          Les informations ci-dessus sont celles enregistrées au moment de la
          commande.
        </small>
      </section>
      <FulfillmentPanel order={order} />
      {order.pickupPoint && (
        <section className={styles.card}>
          <h2>Point de retrait Mondial Relay</h2>
          <p>
            <strong>{order.pickupPoint.name}</strong> · n°{' '}
            {order.pickupPoint.pointId}
          </p>
          <address>
            {order.pickupPoint.address1}
            {order.pickupPoint.address2 && (
              <>
                <br />
                {order.pickupPoint.address2}
              </>
            )}
            <br />
            {order.pickupPoint.postalCode} {order.pickupPoint.city}
            <br />
            {order.pickupPoint.countryCode}
          </address>
        </section>
      )}
      <div className={styles.grid}>
        {order.addresses.map((address) => (
          <section className={styles.card} key={address.id}>
            <h2>
              {address.role === 'SHIPPING'
                ? 'Adresse de livraison'
                : 'Adresse de facturation'}
            </h2>
            <address>
              {address.firstName} {address.lastName}
              <br />
              {address.company && (
                <>
                  {address.company}
                  <br />
                </>
              )}
              {address.addressLine1}
              <br />
              {address.addressLine2 && (
                <>
                  {address.addressLine2}
                  <br />
                </>
              )}
              {address.postalCode} {address.city}
              <br />
              {address.region && (
                <>
                  {address.region}
                  <br />
                </>
              )}
              {address.countryCode}
              {address.phone && (
                <>
                  <br />
                  {address.phone}
                </>
              )}
            </address>
            {address.role === 'SHIPPING' && (
              <p>
                {order.shippingMethodName} · {order.shippingMethodCode}
              </p>
            )}
          </section>
        ))}
      </div>
      <section className={styles.card}>
        <h2>Paiement</h2>
        {payment ? (
          <>
            <p>
              {payment.provider} · <Badge value={payment.status} /> ·{' '}
              {euros(payment.amount)} · {payment.currency}
            </p>
            <p>Payé le : {formatDate(payment.paidAt)}</p>
            {payment.providerPaymentIntentId ? (
              <div className={styles.inline}>
                <code>{payment.providerPaymentIntentId}</code>
                <CopyButton
                  value={payment.providerPaymentIntentId}
                  label="le PaymentIntent"
                />
              </div>
            ) : (
              <p>Aucun PaymentIntent créé.</p>
            )}
          </>
        ) : (
          <p>Aucun paiement associé.</p>
        )}
        {order.status === 'PAID' && (
          <p className={styles.muted}>
            Le remboursement sera implémenté ultérieurement.
          </p>
        )}
        {(order.status === 'PENDING_PAYMENT' ||
          order.status === 'PAYMENT_FAILED') && (
          <AdminForm
            action={cancelOrderAction}
            submit="Annuler la commande impayée"
            confirm="Annuler cette commande ? Le service de paiement vérifiera Stripe avant de libérer les réservations."
          >
            <Hidden name="id" value={order.id} />
          </AdminForm>
        )}
      </section>
      <section className={styles.card}>
        <h2>Réservations de stock</h2>
        <AdminTable
          caption="Réservations"
          headings={['SKU', 'Quantité', 'Statut', 'Échéance']}
        >
          {order.reservations.map((reservation) => (
            <tr key={reservation.id}>
              <td>{reservation.variant.sku}</td>
              <td>{reservation.quantity}</td>
              <td>
                <Badge value={reservation.status} />
              </td>
              <td>{formatDate(reservation.expiresAt)}</td>
            </tr>
          ))}
        </AdminTable>
      </section>
      <div className={styles.grid}>
        <section className={styles.card}>
          <h2>Chronologie</h2>
          <ol className={styles.audit}>
            {timeline.map((event, index) => (
              <li key={index}>
                {event.text}
                <small>{formatDate(event.date)}</small>
              </li>
            ))}
          </ol>
          <small>
            Vue basée sur les dates enregistrées ; ne représente pas un journal
            exhaustif des événements Stripe.
          </small>
        </section>
        <section className={styles.card}>
          <h2>Note interne</h2>
          <AdminForm
            key={order.updatedAt.toISOString()}
            action={orderNoteAction}
          >
            <Hidden name="id" value={order.id} />
            <Hidden name="version" value={order.updatedAt.toISOString()} />
            <TextField
              label="Note réservée à l’équipe"
              name="internalNote"
              defaultValue={order.internalNote}
              maxLength={5000}
            />
          </AdminForm>
        </section>
      </div>
    </>
  );
}
