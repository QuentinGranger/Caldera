'use client';
import { useActionState, useEffect, useRef } from 'react';
import { withdrawalAction, type ReturnFormState } from '@/lib/returns/actions';
import styles from './Returns.module.scss';

const initial: ReturnFormState = { success: false, message: '' };

/** The online withdrawal function (CGV art. 12.2), for the whole order. */
export function WithdrawalForm() {
  const [state, formAction, pending] = useActionState(
    withdrawalAction,
    initial,
  );
  const message = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state.message) message.current?.focus();
  }, [state]);
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
          <label>
            Numéro de commande
            <input
              name="orderNumber"
              required
              maxLength={40}
              autoComplete="off"
              spellCheck={false}
              placeholder="CAL-2026-…"
            />
          </label>
          <label>
            Adresse e-mail utilisée pour la commande
            <input
              name="email"
              type="email"
              required
              maxLength={254}
              autoComplete="email"
            />
          </label>
          <label className={styles.message}>
            Un message — facultatif
            <textarea name="message" maxLength={2000} rows={3} />
          </label>
          <button type="submit" disabled={pending}>
            {pending ? 'Enregistrement…' : 'Confirmer ma rétractation'}
          </button>
        </form>
      )}
    </>
  );
}
