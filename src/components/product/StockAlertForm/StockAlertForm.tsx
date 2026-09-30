'use client';
import { startTransition, useActionState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { BellRing } from 'lucide-react';
import { subscribeStockAlertAction } from '@/lib/stock-alerts/actions';
import { initialAccountState } from '@/lib/account/validation';
import styles from './StockAlertForm.module.scss';

/**
 * « Prévenez-moi » of a sold-out variant: one e-mail, once, when it is back.
 * A signed-in customer is alerted at the account's address; a visitor
 * confirms the address by e-mail first.
 */
export function StockAlertForm({
  variantId,
  language,
  accountEmail,
}: {
  variantId: string;
  /** « Français »… : alerts are per version. */
  language: string;
  accountEmail: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    subscribeStockAlertAction,
    initialAccountState,
  );
  const message = useRef<HTMLParagraphElement>(null);
  const error = state.errors?.email;
  useEffect(() => {
    if (state.message) message.current?.focus();
  }, [state]);
  return (
    <section className={styles.alert} aria-labelledby={`alerte-${variantId}`}>
      <div className={styles.heading}>
        <BellRing size={20} aria-hidden="true" />
        <div>
          <h2 id={`alerte-${variantId}`}>Être prévenu du retour</h2>
          <p>
            Un e-mail, une seule fois, dès que la version sélectionnée (
            {language}) est de nouveau disponible.
          </p>
        </div>
      </div>
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
        <form
          action={formAction}
          onSubmit={(event) => {
            // Keeps the typed address if the request fails.
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            startTransition(() => formAction(data));
          }}
          noValidate
          className={styles.form}
        >
          <input type="hidden" name="variantId" value={variantId} />
          <div className={styles.trap} aria-hidden="true">
            <label>
              Site web
              <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          {accountEmail ? (
            <p className={styles.account}>
              Alerte envoyée à <strong>{accountEmail}</strong>.
            </p>
          ) : (
            <div className={styles.field}>
              <label htmlFor={`alerte-email-${variantId}`}>
                Adresse e-mail
              </label>
              <input
                id={`alerte-email-${variantId}`}
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                maxLength={254}
                required
                aria-invalid={Boolean(error)}
                aria-describedby={
                  error ? `alerte-email-${variantId}-error` : undefined
                }
              />
              {error && (
                <p
                  id={`alerte-email-${variantId}-error`}
                  className={styles.fieldError}
                >
                  {error}
                </p>
              )}
            </div>
          )}
          <button type="submit" disabled={pending} className={styles.submit}>
            {pending ? 'Un instant…' : 'M’avertir du retour'}
          </button>
          <p className={styles.legal}>
            Adresse utilisée uniquement pour cette alerte, puis effacée.{' '}
            <Link href="/confidentialite">Confidentialité</Link>
          </p>
        </form>
      )}
    </section>
  );
}
