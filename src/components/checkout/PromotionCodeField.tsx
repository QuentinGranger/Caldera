'use client';
import { useState } from 'react';
import {
  applyPromotionAction,
  removePromotionAction,
} from '@/lib/checkout/actions';
import type { CheckoutView } from '@/lib/checkout/types';
import { formatPrice } from '@/utils/formatPrice';
import { useCheckoutAction } from './useCheckoutAction';
import styles from './Checkout.module.scss';

/** Code typed in the summary; the server checks it again at every step. */
export function PromotionCodeField({ view }: { view: CheckoutView }) {
  const { execute, pending, result } = useCheckoutAction();
  const [code, setCode] = useState('');
  const applied = view.promotion ?? view.promotionIssue;
  const error = result && !result.success ? result.message : null;
  if (applied)
    return (
      <div className={styles.promotion}>
        <p className={styles.promotionApplied}>
          <span>
            Code <strong>{applied.code}</strong>
            {view.promotion && (
              <>
                {' '}
                · {view.promotion.label}
                {Number(view.promotion.discount) > 0 &&
                  ` · −${formatPrice(view.promotion.discount)}`}
              </>
            )}
          </span>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              execute(() => removePromotionAction(view.sessionId), false)
            }
          >
            Retirer
          </button>
        </p>
        {view.promotionIssue && (
          <p className={styles.promotionError} role="alert">
            {view.promotionIssue.message}
          </p>
        )}
        {error && (
          <p className={styles.promotionError} role="alert">
            {error}
          </p>
        )}
      </div>
    );
  return (
    <form
      className={styles.promotion}
      onSubmit={(event) => {
        event.preventDefault();
        if (code.trim())
          execute(() => applyPromotionAction(view.sessionId, code), false);
      }}
    >
      <label htmlFor="promotion-code">Code promo</label>
      <div className={styles.promotionRow}>
        <input
          id="promotion-code"
          name="promotionCode"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={40}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'promotion-code-error' : undefined}
        />
        <button type="submit" disabled={pending || !code.trim()}>
          {pending ? '…' : 'Appliquer'}
        </button>
      </div>
      {error && (
        <p
          id="promotion-code-error"
          className={styles.promotionError}
          role="alert"
        >
          {error}
        </p>
      )}
    </form>
  );
}
