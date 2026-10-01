'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  applyCartPromotionAction,
  refreshCartPromotionAction,
  removeCartPromotionAction,
} from '@/lib/checkout/actions';
import type { CartView } from '@/lib/cart/types';
import type { CartPromotionState } from '@/lib/checkout/types';
import { formatPrice } from '@/utils/formatPrice';
import styles from './CartSummary.module.scss';

export function CartPromotionField({
  cart,
  initialState,
}: {
  cart: CartView;
  initialState: CartPromotionState | null;
}) {
  const [state, setState] = useState(initialState);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const fingerprint = useMemo(
    () =>
      cart.items
        .map(
          (item) =>
            `${item.id}:${item.variantId}:${item.quantity}:${item.price}:${item.issue ?? ''}`,
        )
        .join('|'),
    [cart.items],
  );
  const previousFingerprint = useRef(fingerprint);

  useEffect(() => {
    setState(initialState);
  }, [initialState]);

  useEffect(() => {
    if (previousFingerprint.current === fingerprint) return;
    previousFingerprint.current = fingerprint;
    startTransition(async () => {
      try {
        setState(await refreshCartPromotionAction());
      } catch {
        setMessage(
          'Le code promo sera revérifié avant le paiement. Actualisez la page si nécessaire.',
        );
      }
    });
  }, [fingerprint]);

  const applied = state?.promotion ?? state?.promotionIssue;
  const discount = Number(state?.promotion?.discount ?? 0);

  function apply() {
    if (!code.trim() || pending) return;
    setMessage('');
    startTransition(async () => {
      const result = await applyCartPromotionAction(code);
      setState(result.state);
      setMessage(result.message);
      if (result.success) setCode('');
    });
  }

  function remove() {
    if (pending) return;
    setMessage('');
    startTransition(async () => {
      const result = await removeCartPromotionAction();
      setState(result.state);
      setMessage(result.message);
    });
  }

  if (applied)
    return (
      <div className={styles.promotion}>
        <div className={styles.promotionApplied}>
          <div>
            <span>Code promo</span>
            <strong>{applied.code}</strong>
            {state?.promotion && <small>{state.promotion.label}</small>}
          </div>
          <button type="button" disabled={pending} onClick={remove}>
            Retirer
          </button>
        </div>

        {state?.promotion && discount > 0 && (
          <>
            <div className={styles.promotionSaving}>
              <span>Réduction</span>
              <strong>−{formatPrice(state.promotion.discount)}</strong>
            </div>
            <div className={styles.promotionTotal}>
              <span>Total provisoire</span>
              <strong>{formatPrice(state.provisionalTotal)}</strong>
            </div>
          </>
        )}

        {state?.promotion && discount === 0 && (
          <p className={styles.promotionHint}>
            Code validé. L’avantage lié à la livraison sera calculé après le
            choix du mode de livraison.
          </p>
        )}

        {state?.promotionIssue && (
          <p className={styles.promotionError} role="alert">
            {state.promotionIssue.message}
          </p>
        )}

        {message && (
          <p
            className={
              state?.promotionIssue
                ? styles.promotionError
                : styles.promotionFeedback
            }
            role="status"
          >
            {message}
          </p>
        )}
      </div>
    );

  return (
    <form
      className={styles.promotion}
      onSubmit={(event) => {
        event.preventDefault();
        apply();
      }}
    >
      <label htmlFor="cart-promotion-code">Code promo</label>
      <div className={styles.promotionRow}>
        <input
          id="cart-promotion-code"
          name="promotionCode"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={40}
          placeholder="Ex. BIENVENUE10"
          aria-invalid={Boolean(message)}
          aria-describedby={message ? 'cart-promotion-message' : undefined}
        />
        <button type="submit" disabled={pending || !code.trim()}>
          {pending ? '…' : 'Appliquer'}
        </button>
      </div>
      <p className={styles.promotionHint}>
        Le code est conservé pour la commande et revérifié avant le paiement.
      </p>
      {message && (
        <p
          id="cart-promotion-message"
          className={styles.promotionError}
          role="alert"
        >
          {message}
        </p>
      )}
    </form>
  );
}
