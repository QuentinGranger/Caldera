import { randomUUID } from 'node:crypto';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { ChevronLeft, Mail } from 'lucide-react';
import { AdminForm } from '@/components/admin/AdminForm';
import {
  Check,
  Field,
  Hidden,
  SelectField,
} from '@/components/admin/AdminFields';
import { customerReplyLink } from '@/emails/reply';
import { carriers } from '@/lib/fulfillment/carriers';
import { MAX_RETURN_PHOTOS } from '@/lib/returns/photos';
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
  addReturnPhotosAction,
  approveReturnAction,
  cancelReturnAction,
  receiveReturnAction,
  refundReturnAction,
  rejectReturnAction,
  replaceReturnAction,
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
  // Settled with new items: open, nothing refunded, every unit in stock.
  const canReplace =
    canMoveReturn(request.status, 'REPLACED') &&
    !committedRefund &&
    order.status === 'PAID';
  const shortages = request.items.filter(
    (item) =>
      !item.orderItem.variant ||
      item.orderItem.variant.availableQuantity < item.quantity,
  );
  const shipping = order.addresses[0];
  const customerName = shipping
    ? `${shipping.firstName} ${shipping.lastName}`
    : null;
  const writeTo = customerReplyLink({
    to: order.email,
    subject: `Votre demande ${request.number} — commande ${order.orderNumber}`,
    name: customerName,
    quote: request.customerMessage,
  });
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
    ...(request.replacement?.shippedAt
      ? [
          {
            date: request.replacement.shippedAt,
            text: `Remplacement expédié (${request.replacement.carrierName})`,
          },
        ]
      : []),
    ...(request.closedAt && !request.refundedAt && !request.replacement
      ? [{ date: request.closedAt, text: 'Retour clos' }]
      : []),
  ];
  return (
    <>
      <PageHeader
        title={`Retour ${request.number}`}
        description={`${returnReasonLabels[request.reason]} · ${request.source === 'ADMIN' ? `créé par ${request.createdBy?.name ?? 'la boutique'}` : 'déclaré par le client'} le ${formatDate(request.createdAt)}`}
      >
        <div className={styles.inline}>
          <a className={styles.button} href={writeTo}>
            <Mail size={16} aria-hidden="true" />
            Écrire au client
          </a>
          <Link
            className={`${styles.button} ${styles.secondaryButton}`}
            href="/admin/retours"
          >
            <ChevronLeft size={16} aria-hidden="true" />
            Retours
          </Link>
        </div>
      </PageHeader>
      <section className={styles.card}>
        <p>
          <Badge value={`RETURN_STATE_${request.status}`} /> · Commande{' '}
          <Link href={`/admin/commandes/${order.id}`}>{order.orderNumber}</Link>{' '}
          · {customerName ? `${customerName} · ` : ''}
          <a href={`mailto:${order.email}`}>{order.email}</a>
          {order.phone && (
            <>
              {' · '}
              <a href={`tel:${order.phone.replace(/[^\d+]/g, '')}`}>
                {order.phone}
              </a>
            </>
          )}
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
      <section className={styles.card} aria-labelledby="photos">
        <h2 id="photos">Photos · {request.photos.length}</h2>
        {request.photos.length ? (
          <ul className={styles.returnPhotos}>
            {request.photos.map((photo, index) => (
              <li key={photo.id}>
                <a
                  href={`/admin/photos/retours/${photo.id}`}
                  target="_blank"
                  rel="noopener"
                >
                  {/* Private: read with the session, never optimized nor cached. */}
                  <Image
                    unoptimized
                    src={`/admin/photos/retours/${photo.id}`}
                    alt={`Photo ${index + 1} du retour ${request.number}`}
                    width={160}
                    height={160}
                  />
                </a>
                <small>
                  {photo.source === 'CUSTOMER'
                    ? 'Envoyée par le client'
                    : 'Ajoutée par la boutique'}{' '}
                  · {formatDate(photo.createdAt)}
                </small>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.muted}>
            Aucune photo. Si le client en envoie par e-mail, ajoutez-les ici
            pour garder le dossier complet.
          </p>
        )}
        {request.photos.length < MAX_RETURN_PHOTOS && (
          <details>
            <summary>Ajouter des photos reçues par e-mail</summary>
            <AdminForm action={addReturnPhotosAction} submit="Ajouter">
              <Hidden name="id" value={request.id} />
              <label>
                Photos (JPEG, PNG ou WebP, 5 Mo chacune,{' '}
                {MAX_RETURN_PHOTOS - request.photos.length} au plus)
                <input
                  type="file"
                  name="photos"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  required
                />
              </label>
            </AdminForm>
          </details>
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
                <Check
                  name="notify"
                  label="Prévenir le client par e-mail"
                  checked
                />
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
      {request.replacement && (
        <section className={styles.card} aria-labelledby="remplacement">
          <h2 id="remplacement">Remplacement expédié</h2>
          <p>
            {request.replacement.carrierName}
            {request.replacement.trackingNumber &&
              ` · suivi ${request.replacement.trackingNumber}`}{' '}
            · {formatDate(request.replacement.shippedAt)}
            {request.replacement.trackingUrl && (
              <>
                {' · '}
                <a
                  href={request.replacement.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Suivre le colis ↗
                </a>
              </>
            )}
          </p>
        </section>
      )}
      {canReplace && (
        <section className={styles.card} aria-labelledby="remplacer">
          <h2 id="remplacer">Envoyer un remplacement</h2>
          <p className={styles.muted}>
            À la place d’un remboursement : les mêmes articles repartent, le
            stock est décompté et le client reçoit le suivi par e-mail. Le
            retour se clôt aussitôt. Inutile d’attendre l’article défectueux si
            vous n’en avez pas besoin.
          </p>
          <ul className={styles.plainList}>
            {request.items.map((item) => (
              <li key={item.id}>
                {item.quantity} × {item.orderItem.productName} ·{' '}
                {item.orderItem.variant
                  ? `${item.orderItem.variant.availableQuantity} en stock`
                  : 'plus au catalogue'}
              </li>
            ))}
          </ul>
          {shortages.length ? (
            <IntegrityWarning>
              Stock insuffisant pour{' '}
              {shortages.map((item) => item.orderItem.productName).join(', ')}
              {' : '}
              <Link href="/admin/stocks">réapprovisionnez</Link> ou remboursez
              ce retour.
            </IntegrityWarning>
          ) : (
            <AdminForm
              action={replaceReturnAction}
              submit="Envoyer le remplacement"
              confirm="Enregistrer l’envoi du remplacement ? Le stock est décompté, le retour se clôt et le client reçoit le suivi par e-mail."
            >
              <Hidden name="id" value={request.id} />
              <div className={styles.fields}>
                <SelectField
                  name="carrierCode"
                  label="Transporteur"
                  defaultValue="COLISSIMO"
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
                />
                <Field
                  label="Numéro de suivi"
                  name="trackingNumber"
                  maxLength={100}
                />
                <Field
                  label="URL de suivi (lien réel du transporteur)"
                  name="trackingUrl"
                  type="url"
                  maxLength={2000}
                />
                <label className={styles.full}>
                  Message au client — facultatif
                  <textarea
                    name="message"
                    maxLength={2000}
                    placeholder="ex. Toutes nos excuses : voici un coffret neuf, inutile de nous renvoyer l’ancien."
                  />
                </label>
              </div>
              <div className={styles.checks}>
                <Check
                  name="hasTracking"
                  label="Envoi suivi (option pour « Autre » ; obligatoire pour les transporteurs prédéfinis)"
                  checked
                />
              </div>
            </AdminForm>
          )}
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
