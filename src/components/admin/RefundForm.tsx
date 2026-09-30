'use client';
import { useState } from 'react';
import { AdminForm } from '@/components/admin/AdminForm';
import { Hidden } from '@/components/admin/AdminFields';
import { refundOrderAction } from '@/lib/refunds/admin-actions';
import {
  fromCents,
  lineRefundCents,
  refundReasonLabels,
} from '@/lib/refunds/amounts';
import styles from './Admin.module.scss';

export type RefundableLine = {
  id: string;
  name: string;
  sku: string;
  /** Line total minus its share of a promotional discount. */
  netCents: number;
  quantity: number;
  /** Units already refunded or being refunded. */
  refunded: number;
  /** Still refundable: ordered minus already refunded or pending. */
  left: number;
  /** A deleted variant cannot go back on sale. */
  restockable: boolean;
};

const euros = (cents: number) => `${fromCents(cents).replace('.', ',')} €`;

/**
 * Refund of a paid order: lines and quantities, shipping, optional lower
 * amount (goodwill), reason, restock. The total is computed as you type; the
 * server checks it again against what is left.
 */
export function RefundForm({
  orderId,
  idempotencyKey,
  lines,
  shippingCents,
  remainingCents,
}: {
  orderId: string;
  idempotencyKey: string;
  lines: RefundableLine[];
  shippingCents: number;
  remainingCents: number;
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [shipping, setShipping] = useState(false);
  const [custom, setCustom] = useState('');
  const selected =
    lines.reduce(
      (sum, line) =>
        sum +
        lineRefundCents(
          line.netCents,
          line.quantity,
          line.refunded,
          quantities[line.id] ?? 0,
        ),
      0,
    ) + (shipping ? shippingCents : 0);
  const customCents = /^\d{1,8}([.,]\d{1,2})?$/.test(custom.trim())
    ? Math.round(Number(custom.trim().replace(',', '.')) * 100)
    : null;
  const total = customCents ?? selected;
  const tooHigh =
    total > remainingCents ||
    (selected > 0 && customCents !== null && customCents > selected);
  const anyItem = lines.some((line) => (quantities[line.id] ?? 0) > 0);
  return (
    <AdminForm
      action={refundOrderAction}
      submit="Rembourser"
      confirm="Rembourser ce montant ? L’argent repart immédiatement vers le moyen de paiement du client : l’opération ne peut pas être annulée."
    >
      <Hidden name="id" value={orderId} />
      <Hidden name="key" value={idempotencyKey} />
      <div className={styles.fields}>
        <div className={`${styles.full} ${styles.tableWrapper}`}>
          <table className={styles.table}>
            <caption>Articles à rembourser</caption>
            <thead>
              <tr>
                <th scope="col">Article</th>
                <th scope="col">Payé par unité</th>
                <th scope="col">Quantité</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id}>
                  <td>
                    {line.name}
                    <small>
                      <code>{line.sku}</code>
                    </small>
                  </td>
                  <td>{euros(Math.round(line.netCents / line.quantity))}</td>
                  <td>
                    <label>
                      <span className={styles.visuallyHidden}>
                        Quantité à rembourser pour {line.name}
                      </span>
                      <input
                        type="number"
                        name={`qty:${line.id}`}
                        min={0}
                        max={line.left}
                        step={1}
                        inputMode="numeric"
                        value={quantities[line.id] ?? 0}
                        disabled={!line.left}
                        onChange={(event) =>
                          setQuantities({
                            ...quantities,
                            [line.id]: Math.max(
                              0,
                              Math.min(
                                line.left,
                                Number(event.target.value) || 0,
                              ),
                            ),
                          })
                        }
                      />
                    </label>
                    <small>
                      {line.left ? `${line.left} au plus` : 'Déjà remboursé'}
                    </small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {shippingCents > 0 && (
          <label>
            <input
              type="checkbox"
              name="shipping"
              checked={shipping}
              onChange={(event) => setShipping(event.target.checked)}
            />
            Rembourser les frais de livraison ({euros(shippingCents)})
          </label>
        )}
        <label>
          Montant différent — facultatif
          <input
            name="amount"
            inputMode="decimal"
            placeholder={
              selected ? fromCents(selected).replace('.', ',') : 'ex. 5,00'
            }
            value={custom}
            onChange={(event) => setCustom(event.target.value)}
            aria-describedby="refund-amount-help"
          />
          <small id="refund-amount-help">
            Moins que la sélection pour un geste partiel, ou un montant seul
            sans article (geste commercial).
          </small>
        </label>
        <label>
          Motif
          <select name="reason" defaultValue="CUSTOMER_REQUEST" required>
            {Object.entries(refundReasonLabels).map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.full}>
          Note interne — facultative, jamais montrée au client
          <textarea name="note" maxLength={1000} />
        </label>
        <label className={styles.full}>
          <input type="checkbox" name="restock" disabled={!anyItem} />
          Remettre les articles sélectionnés en stock une fois le remboursement
          confirmé
          {lines.some((line) => !line.restockable) &&
            ' (une variante supprimée ne peut pas l’être)'}
        </label>
        <p
          className={`${styles.full} ${tooHigh ? styles.error : ''}`}
          role="status"
        >
          Montant remboursé : <strong>{euros(total)}</strong> · reste
          remboursable : {euros(remainingCents)}
          {tooHigh && ' — montant trop élevé'}
        </p>
      </div>
    </AdminForm>
  );
}
