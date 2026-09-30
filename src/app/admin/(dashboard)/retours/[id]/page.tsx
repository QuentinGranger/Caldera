import { randomUUID } from 'node:crypto';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { AdminForm } from '@/components/admin/AdminForm';
import { Hidden } from '@/components/admin/AdminFields';
import {
  AdminTable,
  Badge,
  IntegrityWarning,
  PageHeader,
} from '@/components/admin/AdminUI';
import { euros, formatDate } from '@/lib/admin/format';
import { uuid } from '@/lib/admin/validation';
import {
  fromCents,
  lineRefundCents,
  refundState,
  toCents,
} from '@/lib/refunds/amounts';
import { getAdminReturn } from '@/lib/returns/admin';
import {
  approveReturnAction,
  cancelReturnAction,
  receiveReturnAction,
  refundReturnAction,
  rejectReturnAction,
  saveReturnNoteAction,
} from '@/lib/returns/admin-actions';
import {
  canMoveReturn,
  endOfDayAfter,
  OPEN_RETURN_STATUSES,
  REFUND_DAYS,
  returnReasonLabels,
} from '@/lib/returns/rules';
import styles from '@/components/admin/Admin.module.scss';
import { requireAdmin } from '@/lib/admin/auth';

export default async function AdminReturnPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // The layout's check runs in parallel: never read data before this one.
  await requireAdmin();
  const { id } = await params;
  let returnId: string;
  try {
    returnId = uuid(id);
  } catch {
    notFound();
  }
  const request = await getAdminReturn(returnId);
  if (!request) notFound();
  const { order } = request;
  const open = OPEN_RETURN_STATUSES.includes(request.status);
  const withdrawal = request.reason === 'WITHDRAWAL';
  const refundDeadline = endOfDayAfter(request.createdAt, REFUND_DAYS);
  const state = order.payment
    ? refundState(
        {
          amount: order.payment.amount.toFixed(2),
          shipping: order.shippingAmount.toFixed(2),
        },
        order.refunds,
      )
    : null;
  const committedRefund =
    request.refund &&
    ['PENDING', 'REQUIRES_ACTION', 'SUCCEEDED'].includes(request.refund.status);
  // What these units cost the customer, after any promotional discount.
  const itemsCents = request.items.reduce(
    (sum, item) =>
      sum +
      lineRefundCents(
        toCents(item.orderItem.lineTotal) -
          toCents(item.orderItem.discountAmount),
        item.orderItem.quantity,
        committedRefund
          ? 0
          : (state?.refundedQuantities.get(item.orderItemId) ?? 0),
        item.quantity,
      ),
    0,
  );
  const wholeOrder =
    request.items.reduce((sum, item) => sum + item.quantity, 0) ===
    order.items.reduce((sum, item) => sum + item.quantity, 0);
  const canRefund =
    open &&
    !committedRefund &&
    order.status === 'PAID' &&
    order.payment?.status === 'SUCCEEDED' &&
    Boolean(state?.remainingCents);
  const timeline = [
    { date: request.createdAt, text: 'Demande enregistrée' },
    ...(request.approvedAt
      ? [{ date: request.approvedAt, text: 'Retour accepté' }]
      : []),
    ...(request.receivedAt
      ? [{ date: request.receivedAt, text: 'Colis reçu' }]
      : []),
    ...(request.refundedAt
      ? [{ date: request.refundedAt, text: 'Remboursement confirmé' }]
      : []),
    ...(request.closedAt && !request.refundedAt
      ? [{ date: request.closedAt, text: 'Retour clos' }]
      : []),
  ];
  return (
    <>
      <PageHeader
        title={`Retour ${request.number}`}
        description={`${returnReasonLabels[request.reason]} · ${request.source === 'ADMIN' ? `créé par ${request.createdBy?.name ?? 'la boutique'}` : 'déclaré par le client'} le ${formatDate(request.createdAt)}`}
      >
        <Link
          className={`${styles.button} ${styles.secondaryButton}`}
          href="/admin/retours"
        >
          <ChevronLeft size={16} aria-hidden="true" />
          Retours
        </Link>
      </PageHeader>
      <section className={styles.card}>
        <p>
          <Badge value={`RETURN_STATE_${request.status}`} /> · Commande{' '}
          <Link href={`/admin/commandes/${order.id}`}>{order.orderNumber}</Link>{' '}
          · {order.email}
          {order.deliveredAt
            ? ` · livrée le ${formatDate(order.deliveredAt)}`
            : ' · livraison non confirmée'}
        </p>
        {withdrawal && open && (
          <IntegrityWarning>
            Rétractation : remboursez au plus tard le{' '}
            {formatDate(new Date(refundDeadline.getTime() - 1))}, frais de
            livraison initiaux compris si toute la commande revient. Vous pouvez
            attendre la réception des articles ou la preuve de leur envoi (CGV
            art. 14).
          </IntegrityWarning>
        )}
        {request.customerMessage && (
          <blockquote className={styles.quote}>
            {request.customerMessage}
          </blockquote>
        )}
        {request.resolution && (
          <p>
            <strong>Réponse envoyée :</strong> {request.resolution}
          </p>
        )}
      </section>
      <section className={styles.card}>
        <AdminTable
          caption="Articles retournés"
          headings={['Article', 'Quantité', 'Commandé']}
        >
          {request.items.map((item) => (
            <tr key={item.id}>
              <td>
                {item.orderItem.productName}
                <small>
                  <code>{item.orderItem.sku}</code>
                </small>
              </td>
              <td>{item.quantity}</td>
              <td>{item.orderItem.quantity}</td>
            </tr>
          ))}
        </AdminTable>
      </section>
      {request.status === 'REQUESTED' && (
        <div className={styles.grid}>
          <section className={styles.card}>
            <h2>Accepter</h2>
            <AdminForm action={approveReturnAction} submit="Accepter le retour">
              <Hidden name="id" value={request.id} />
              <label>
                Message au client — facultatif (l’adresse de retour est ajoutée
                automatiquement)
                <textarea
                  name="resolution"
                  maxLength={2000}
                  placeholder="ex. Les frais de retour sont à votre charge."
                />
              </label>
            </AdminForm>
          </section>
          <section className={styles.card}>
            <h2>Refuser</h2>
            <AdminForm
              action={rejectReturnAction}
              submit="Refuser le retour"
              confirm="Refuser ce retour ? Le client reçoit votre explication par e-mail."
            >
              <Hidden name="id" value={request.id} />
              <label>
                Explication envoyée au client
                <textarea name="resolution" maxLength={2000} required />
              </label>
            </AdminForm>
          </section>
        </div>
      )}
      {open && (
        <section className={styles.card}>
          <h2>Suivi</h2>
          <div className={styles.inline}>
            {canMoveReturn(request.status, 'RECEIVED') && (
              <AdminForm action={receiveReturnAction} submit="Colis reçu">
                <Hidden name="id" value={request.id} />
              </AdminForm>
            )}
            <AdminForm
              action={cancelReturnAction}
              submit="Clore sans remboursement"
              confirm="Clore ce retour sans remboursement (demande abandonnée par le client, par exemple) ?"
            >
              <Hidden name="id" value={request.id} />
            </AdminForm>
          </div>
        </section>
      )}
      <section className={styles.card} id="remboursement">
        <h2>Remboursement</h2>
        {request.refund && (
          <p>
            <Badge value={request.refund.status} />{' '}
            {euros(request.refund.amount)} demandé le{' '}
            {formatDate(request.refund.createdAt)}
            {request.refund.failureReason &&
              ` · ${request.refund.failureReason}`}{' '}
            ·{' '}
            <Link href={`/admin/commandes/${order.id}#remboursements`}>
              voir la commande
            </Link>
          </p>
        )}
        {canRefund ? (
          <AdminForm
            action={refundReturnAction}
            submit="Rembourser ce retour"
            confirm="Rembourser ce retour ? L’argent repart vers le moyen de paiement du client : l’opération ne peut pas être annulée."
          >
            <Hidden name="id" value={request.id} />
            <Hidden name="key" value={randomUUID()} />
            <div className={styles.fields}>
              <p className={styles.full}>
                Articles retournés :{' '}
                <strong>{euros(fromCents(itemsCents))}</strong> (prix payé,
                remise déduite) · reste remboursable sur la commande :{' '}
                {euros(fromCents(state!.remainingCents))}
              </p>
              {state!.shippingRemainingCents > 0 && (
                <label>
                  <input
                    type="checkbox"
                    name="shipping"
                    defaultChecked={withdrawal && wholeOrder}
                  />
                  Rembourser les frais de livraison (
                  {euros(fromCents(state!.shippingRemainingCents))})
                </label>
              )}
              <label>
                <input type="checkbox" name="restock" defaultChecked />
                Remettre les articles en stock à la confirmation
              </label>
              <label>
                Montant inférieur — facultatif (dépréciation constatée)
                <input
                  name="amount"
                  inputMode="decimal"
                  placeholder="ex. 45,00"
                />
              </label>
              <label className={styles.full}>
                Note interne — facultative
                <textarea name="note" maxLength={1000} />
              </label>
            </div>
          </AdminForm>
        ) : (
          !request.refund && (
            <p className={styles.muted}>
              {open ? 'Rien à rembourser sur cette commande.' : 'Retour clos.'}
            </p>
          )
        )}
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
        </section>
        <section className={styles.card}>
          <h2>Note interne</h2>
          <AdminForm action={saveReturnNoteAction}>
            <Hidden name="id" value={request.id} />
            <label>
              Jamais montrée au client
              <textarea
                name="note"
                maxLength={2000}
                defaultValue={request.internalNote ?? ''}
              />
            </label>
          </AdminForm>
        </section>
      </div>
    </>
  );
}
