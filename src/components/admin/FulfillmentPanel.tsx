import Link from 'next/link';
import type { getAdminOrder } from '@/lib/admin/queries';
import { formatDate, label } from '@/lib/admin/format';
import { carriers, fulfillmentLabels } from '@/lib/fulfillment/carriers';
import {
  fulfillmentAction,
  shipmentAction,
  correctTrackingAction,
  retryEmailAction,
} from '@/lib/fulfillment/actions';
import { canRetryEmail, MAX_EMAIL_ATTEMPTS } from '@/lib/email/processor';
import { AdminForm } from './AdminForm';
import { Hidden, Field, Check, SelectField } from './AdminFields';
import { AdminTable } from './AdminUI';
import styles from './Admin.module.scss';
type Order = NonNullable<Awaited<ReturnType<typeof getAdminOrder>>>;
function ShipmentForm({
  order,
  correction = false,
}: {
  order: Order;
  correction?: boolean;
}) {
  const shipment = order.shipments[0];
  return (
    <AdminForm
      key={shipment?.updatedAt.toISOString() ?? 'new'}
      action={correction ? correctTrackingAction : shipmentAction}
      submit={
        correction
          ? 'Corriger le suivi'
          : shipment
            ? 'Enregistrer le brouillon'
            : 'Créer l’expédition'
      }
      confirm={
        correction
          ? 'Cette correction sera visible sur la page client et auditée. L’email d’expédition ne sera pas renvoyé.'
          : undefined
      }
    >
      <Hidden name="orderId" value={order.id} />
      {shipment && (
        <>
          <Hidden name="shipmentId" value={shipment.id} />
          <Hidden name="version" value={shipment.updatedAt.toISOString()} />
        </>
      )}
      <div className={styles.fields}>
        <SelectField
          name="carrierCode"
          label="Transporteur"
          defaultValue={shipment?.carrierCode ?? 'COLISSIMO'}
        >
          {carriers.map((carrier) => (
            <option key={carrier.code} value={carrier.code}>
              {carrier.label}
            </option>
          ))}
        </SelectField>
        <Field
          label="Nom si transporteur « Autre »"
          name="carrierName"
          maxLength={100}
          defaultValue={shipment?.carrierName ?? ''}
        />
        <Field
          label="Numéro de suivi"
          name="trackingNumber"
          maxLength={100}
          defaultValue={shipment?.trackingNumber ?? ''}
        />
        <Field
          label="URL de suivi (lien réel du transporteur)"
          name="trackingUrl"
          type="url"
          maxLength={2000}
          defaultValue={shipment?.trackingUrl ?? ''}
        />
        {correction && (
          <Field
            label="Motif de correction"
            name="reason"
            maxLength={500}
            required
          />
        )}
      </div>
      <div className={styles.checks}>
        <Check
          name="hasTracking"
          label="Envoi suivi (option pour « Autre » ; obligatoire pour les transporteurs prédéfinis)"
          checked={shipment?.hasTracking ?? true}
        />
      </div>
      <small>
        Aucune API transporteur connectée. Saisissez le lien fourni par le
        transporteur ; aucune URL n’est inventée.
      </small>
    </AdminForm>
  );
}
export function FulfillmentPanel({ order }: { order: Order }) {
  const shipment = order.shipments[0];
  const allowed =
    order.status === 'PAID' && order.payment?.status === 'SUCCEEDED';
  const next = {
    UNFULFILLED: ['PREPARING', 'Commencer la préparation'],
    PREPARING: ['READY_TO_SHIP', 'Commande prête à expédier'],
    READY_TO_SHIP: ['SHIPPED', 'Marquer comme expédiée'],
    SHIPPED: ['DELIVERED', 'Marquer manuellement comme livrée'],
  } as const;
  const action =
    order.fulfillmentStatus === 'DELIVERED'
      ? null
      : next[order.fulfillmentStatus];
  return (
    <>
      <section className={styles.card}>
        <h2>Préparation & expédition</h2>
        <p>
          <strong>
            {allowed
              ? fulfillmentLabels[order.fulfillmentStatus]
              : 'En attente d’un paiement confirmé'}
          </strong>{' '}
          · {order.shippingMethodName}
        </p>
        <p className={styles.muted}>
          Payée → Préparation → Prête → Expédiée → Livrée
        </p>
        {allowed && (
          <Link href={`/admin/commandes/${order.id}/bon-preparation`}>
            Ouvrir le bon de préparation imprimable
          </Link>
        )}
        {shipment ? (
          <>
            <p>
              Transporteur : {shipment.carrierName} ·{' '}
              {shipment.status === 'DRAFT'
                ? 'Brouillon'
                : fulfillmentLabels[shipment.status]}
            </p>
            <p>Suivi : {shipment.trackingNumber ?? 'Envoi sans suivi'}</p>
            {shipment.trackingUrl && (
              <p>
                <a
                  href={shipment.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Ouvrir le suivi transporteur ↗
                </a>
              </p>
            )}
            <p>
              Expédiée le : {formatDate(shipment.shippedAt)} · Livrée le :{' '}
              {formatDate(shipment.deliveredAt)}
            </p>
          </>
        ) : (
          <p>Aucune expédition créée.</p>
        )}
        {allowed && order.fulfillmentStatus === 'READY_TO_SHIP' && (
          <details open={!shipment}>
            <summary>
              {shipment
                ? 'Modifier le brouillon d’expédition'
                : 'Créer l’expédition'}
            </summary>
            <ShipmentForm order={order} />
          </details>
        )}
        {allowed &&
          shipment &&
          ['SHIPPED', 'DELIVERED'].includes(shipment.status) && (
            <details>
              <summary>Corriger le suivi</summary>
              <ShipmentForm order={order} correction />
            </details>
          )}
        {allowed && action && (action[0] !== 'SHIPPED' || shipment) && (
          <AdminForm
            action={fulfillmentAction}
            submit={action[1]}
            confirm={
              action[0] === 'SHIPPED'
                ? 'Confirmer la remise réelle du colis au transporteur ? Cette action enregistrera l’expédition et préparera son email.'
                : action[0] === 'DELIVERED'
                  ? 'Confirmer manuellement la livraison ? Aucun transporteur ne confirme automatiquement cette information.'
                  : undefined
            }
          >
            <Hidden name="orderId" value={order.id} />
            <Hidden name="next" value={action[0]} />
          </AdminForm>
        )}
        <details>
          <summary>Historique logistique</summary>
          <ul className={styles.audit}>
            {order.fulfillmentAudit.map((event) => (
              <li key={event.id}>
                <strong>{label(event.action)}</strong> · {event.adminUser.name}
                <small>{formatDate(event.createdAt)}</small>
              </li>
            ))}
          </ul>
        </details>
      </section>
      <section className={styles.card}>
        <h2>Emails transactionnels</h2>
        {process.env.EMAILS_ENABLED !== 'true' && (
          <p className={styles.warning}>
            Envois désactivés. Les emails restent en attente ; les aperçus sont
            disponibles.
          </p>
        )}
        <small>
          « Envoyé » signifie accepté par le fournisseur, pas livré dans la
          boîte de réception.
        </small>
        {order.emails.length ? (
          <AdminTable
            caption="Historique des emails"
            headings={[
              'Email',
              'Statut',
              'Tentatives',
              'Date / référence',
              'Action',
            ]}
          >
            {order.emails.map((email) => (
              <tr key={email.id}>
                <td>
                  {email.type === 'ORDER_CONFIRMATION'
                    ? 'Confirmation de commande'
                    : 'Confirmation d’expédition'}
                </td>
                <td>
                  {
                    {
                      PENDING: 'En attente',
                      SENDING: 'En cours',
                      SENT: 'Envoyé',
                      FAILED: 'Échec',
                    }[email.status]
                  }
                  {email.lastError && <small>{email.lastError}</small>}
                  {email.retryBlocked && (
                    <small>
                      Vérification chez le fournisseur requise avant toute
                      décision.
                    </small>
                  )}
                </td>
                <td>
                  {email.attemptCount} / {MAX_EMAIL_ATTEMPTS}
                </td>
                <td>
                  {formatDate(email.sentAt)}
                  <small>{email.providerMessageId ?? '—'}</small>
                </td>
                <td>
                  <Link
                    href={`/admin/emails/${email.id}/preview`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Aperçu
                  </Link>
                  {canRetryEmail(email) && (
                    <AdminForm
                      action={retryEmailAction}
                      submit="Réessayer l’envoi"
                    >
                      <Hidden name="emailId" value={email.id} />
                    </AdminForm>
                  )}
                </td>
              </tr>
            ))}
          </AdminTable>
        ) : (
          <p>
            Aucun email enregistré. Les anciennes commandes payées avant cette
            phase ne sont pas envoyées rétroactivement.
          </p>
        )}
      </section>
    </>
  );
}
