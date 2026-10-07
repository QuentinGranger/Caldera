import { randomUUID } from 'node:crypto';
import type { getAdminOrder } from '@/lib/admin/queries';
import { euros } from '@/lib/admin/format';
import {
  approveReviewAction,
  checkReviewAction,
  refundReviewAction,
} from '@/lib/payments/review-actions';
import { AdminForm } from './AdminForm';
import { Hidden } from './AdminFields';
import { IntegrityWarning } from './AdminUI';
import styles from './Admin.module.scss';

type Order = NonNullable<Awaited<ReturnType<typeof getAdminOrder>>>;

/**
 * An order held for review, and its ways out: validate once the stock is
 * back, refund and cancel, or ask Stripe what became of a lost attempt.
 */
export function ReviewPanel({ order }: { order: Order }) {
  const paid = order.payment?.status === 'SUCCEEDED';
  const pending = order.refunds.some((refund) =>
    ['PENDING', 'REQUIRES_ACTION'].includes(refund.status),
  );
  // What each line can take now: free stock, plus what this order still holds.
  const lines = order.items.map((item) => {
    const reservation = order.reservations.find(
      (row) => row.variantId === item.variantId,
    );
    const free =
      (reservation?.variant.availableQuantity ?? 0) +
      (reservation?.status === 'ACTIVE' ? reservation.quantity : 0);
    return {
      item,
      free,
      enough: Boolean(reservation) && free >= item.quantity,
    };
  });
  const short = lines.filter((line) => !line.enough);
  return (
    <section
      className={`${styles.card} ${styles.storefront}`}
      aria-labelledby="verification"
    >
      <h2 id="verification">Commande à vérifier</h2>
      {!paid ? (
        <>
          <p>
            Une tentative de paiement de plus de 23 heures ne peut plus être
            reprise automatiquement. Stripe dit ce qu’elle est devenue :
            encaissée, vous pourrez valider ou rembourser ; sinon, la commande
            est annulée et sa réservation libérée.
          </p>
          <AdminForm
            action={checkReviewAction}
            submit="Vérifier auprès de Stripe"
            pendingLabel="Vérification…"
          >
            <Hidden name="id" value={order.id} />
          </AdminForm>
        </>
      ) : pending ? (
        <p>
          Remboursement en attente de Stripe : la commande s’annulera à sa
          confirmation.
        </p>
      ) : (
        <>
          <p>
            Le client a payé <strong>{euros(order.totalAmount)}</strong>, mais
            le stock réservé ne couvrait plus la commande. Elle n’est ni
            préparée ni confirmée au client tant que vous ne décidez pas.
          </p>
          <ul className={styles.plainList}>
            {lines.map(({ item, free, enough }) => (
              <li key={item.id}>
                {item.quantity} × {item.productName} ·{' '}
                <span className={enough ? '' : styles.errorText}>
                  {free} disponible{free > 1 ? 's' : ''}
                </span>
              </li>
            ))}
          </ul>
          <div className={styles.grid}>
            <div>
              <h3>Valider</h3>
              {short.length ? (
                <IntegrityWarning>
                  Stock insuffisant : réapprovisionnez{' '}
                  {short.map((line) => line.item.productName).join(', ')} pour
                  pouvoir valider, ou remboursez.
                </IntegrityWarning>
              ) : (
                <AdminForm
                  action={approveReviewAction}
                  submit="Valider la commande"
                  confirm="Valider cette commande ? Le stock est décompté, la facture émise et la confirmation envoyée au client."
                >
                  <Hidden name="id" value={order.id} />
                  <small>
                    Elle devient une commande payée ordinaire, à préparer.
                  </small>
                </AdminForm>
              )}
            </div>
            <div>
              <h3>Annuler et rembourser</h3>
              <AdminForm
                action={refundReviewAction}
                tone="danger"
                submit={`Rembourser ${euros(order.totalAmount)}`}
                confirm="Rembourser intégralement et annuler cette commande ? L’argent repart vers le moyen de paiement du client : l’opération ne peut pas être annulée."
              >
                <Hidden name="id" value={order.id} />
                <Hidden name="key" value={randomUUID()} />
                <small>
                  Remboursement intégral via Stripe ; le client reçoit un e-mail
                  d’annulation.
                </small>
              </AdminForm>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
