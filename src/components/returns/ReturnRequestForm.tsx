'use client';
import { useActionState, useEffect, useRef, useState } from 'react';
import {
  requestReturnAction,
  type ReturnFormState,
} from '@/lib/returns/actions';
import styles from './Returns.module.scss';

export type ReturnableLine = {
  id: string;
  name: string;
  quantity: number;
  left: number;
};

const initial: ReturnFormState = { success: false, message: '' };

/**
 * Withdrawal or return declared from the order page. The withdrawal button
 * carries the wording of the law: « Confirmer ma rétractation ».
 */
export function ReturnRequestForm({
  publicId,
  access,
  lines,
  canWithdraw,
  canReport,
}: {
  publicId: string;
  access: string;
  lines: ReturnableLine[];
  canWithdraw: boolean;
  canReport: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    requestReturnAction,
    initial,
  );
  const [reason, setReason] = useState(canWithdraw ? 'WITHDRAWAL' : 'DAMAGED');
  const message = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state.message) message.current?.focus();
  }, [state]);
  const withdrawal = reason === 'WITHDRAWAL';
  return (
    <>
      {state.message && (
        <p
          ref={message}
          tabIndex={-1}
          role={state.success ? 'status' : 'alert'}
          className={state.success ? styles.success : styles.error}
        >
          {state.message}
        </p>
      )}
      {!state.success && (
        <form action={formAction} className={styles.form}>
          <input type="hidden" name="publicId" value={publicId} />
          <input type="hidden" name="access" value={access} />
          <fieldset>
            <legend>Motif</legend>
            {canWithdraw && (
              <label className={styles.choice}>
                <input
                  type="radio"
                  name="reason"
                  value="WITHDRAWAL"
                  checked={withdrawal}
                  onChange={() => setReason('WITHDRAWAL')}
                />
                <span>
                  <strong>Je me rétracte</strong>
                  <small>
                    Sans avoir à vous justifier, dans les 14 jours suivant la
                    réception.
                  </small>
                </span>
              </label>
            )}
            {canReport &&
              (
                [
                  ['DAMAGED', 'Un article est arrivé abîmé'],
                  ['DEFECTIVE', 'Un article est défectueux ou non conforme'],
                  [
                    'WRONG_ITEM',
                    'J’ai reçu un autre article que celui commandé',
                  ],
                  ['OTHER', 'Autre demande de retour'],
                ] as const
              ).map(([value, text]) => (
                <label key={value} className={styles.choice}>
                  <input
                    type="radio"
                    name="reason"
                    value={value}
                    checked={reason === value}
                    onChange={() => setReason(value)}
                  />
                  <span>
                    <strong>{text}</strong>
                  </span>
                </label>
              ))}
          </fieldset>
          <fieldset>
            <legend>Articles concernés</legend>
            {lines.map((line) => (
              <label key={line.id} className={styles.line}>
                <span>
                  {line.name}
                  <small>
                    {line.left
                      ? `${line.left} sur ${line.quantity} à retourner au plus`
                      : 'Déjà retourné ou remboursé'}
                  </small>
                </span>
                <select
                  name={`qty:${line.id}`}
                  defaultValue={String(line.left)}
                  disabled={!line.left}
                  aria-label={`Quantité à retourner pour ${line.name}`}
                >
                  {Array.from({ length: line.left + 1 }, (_, count) => (
                    <option key={count} value={count}>
                      {count}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </fieldset>
          <label className={styles.message}>
            {withdrawal
              ? 'Un message — facultatif'
              : 'Décrivez le problème (photos bienvenues en réponse à notre e-mail)'}
            <textarea
              name="message"
              maxLength={2000}
              rows={4}
              required={!withdrawal}
            />
          </label>
          <button type="submit" disabled={pending}>
            {pending
              ? 'Enregistrement…'
              : withdrawal
                ? 'Confirmer ma rétractation'
                : 'Envoyer ma demande'}
          </button>
          <p className={styles.hint}>
            Un accusé de réception vous est envoyé par e-mail. N’expédiez rien
            avant de l’avoir lu : il indique l’adresse de retour.
          </p>
        </form>
      )}
    </>
  );
}
