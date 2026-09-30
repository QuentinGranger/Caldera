'use client';
import { useActionState } from 'react';
import { removeMyStockAlertAction } from '@/lib/stock-alerts/actions';
import { initialAccountState } from '@/lib/account/validation';
import styles from './Account.module.scss';

export function StockAlertRemoveButton({
  alertId,
  label,
}: {
  alertId: string;
  /** Product and version, for screen readers. */
  label: string;
}) {
  const [state, action, pending] = useActionState(
    removeMyStockAlertAction,
    initialAccountState,
  );
  return (
    <form action={action}>
      <input type="hidden" name="alert" value={alertId} />
      <button
        type="submit"
        className={styles.secondary}
        disabled={pending}
        aria-label={`Supprimer l’alerte : ${label}`}
      >
        {pending ? 'Un instant…' : 'Supprimer'}
      </button>
      {!state.success && state.message && (
        <p role="alert" className={styles.fieldError}>
          {state.message}
        </p>
      )}
    </form>
  );
}
