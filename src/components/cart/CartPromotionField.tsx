'use client';

import {
  Check,
  ChevronDown,
  TicketPercent,
  TriangleAlert,
} from 'lucide-react';
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
  const [open, setOpen] = useState(Boolean(initialState?.promotionIssue));
  const [pending, startTransition] = useTransition();

  const fingerprint = useMemo(
    () =>
      cart.items
        .map(
          (item) =>
            \`\${item.id}:\${item.variantId}:\${item.quantity}:\${item.price}:\${item.issue ?? ''}\`,
        )
        .join('|'),
    [cart.items],
  );
  const previousFingerprint = useRef(fingerprint);

  useEffect(() => {
    if (previousFingerprint.current === fingerprint) return;
    previousFingerprint.current = fingerprint;

    startTransition(async () => {
      try {
        const next = await refreshCartPromotionAction();
        setState(next);
        setMessage('');
      } catch {
        setMessage(
          'Le code promo sera revérifié avant le paiement. Actualisez la page si nécessaire.',
        );
      }
    });
  }, [fingerprint]);

  const promotion = state?.promotion ?? null;
  const issue = state?.promotionIssue ?? null;
  const applied = promotion ?? issue;
  const discount = Number(promotion?.discount ?? 0);

  function apply() {
    if (!code.trim() || pending) return;

    setMessage('');
    startTransition(async () => {
      const result = await applyCartPromotionAction(code);
      setState(result.state);
      setMessage(result.success ? '' : result.message);

      if (result.success) {
        setCode('');
        setOpen(false);
      }
    });
  }

  function remove() {
    if (pending) return;

    setMessage('');
    startTransition(async () => {
      const result = await removeCartPromotionAction();
      setState(result.state);
      setMessage(result.success ? '' : result.message);

      if (result.success) {
        setCode('');
        setOpen(false);
      }
    });
  }

  if (applied) {
    const valid = Boolean(promotion);

    return (
      <section
        className={\`\${styles.promotionCard} \${
          valid ? styles.promotionValid : styles.promotionInvalid
        }\`}
        aria-label={valid ? 'Code promo appliqué' : 'Code promo à vérifier'}
      >
        <div className={styles.promotionCardHeader}>
          <span className={styles.promotionStatusIcon} aria-hidden="true">
            {valid ? <Check size={15} /> : <TriangleAlert size={15} />}
          </span>

          <div className={styles.promotionIdentity}>
            <span>{valid ? 'Code promo appliqué' : 'Code promo à vérifier'}</span>
            <strong>{applied.code}</strong>
            {promotion && <small>{promotion.label}</small>}
          </div>

          <button
            type="button"
            className={styles.promotionRemove}
            disabled={pending}
            onClick={remove}
          >
            {pending ? 'Retrait…' : 'Retirer'}
          </button>
        </div>

        {promotion && discount > 0 && (
          <div className={styles.promotionResult}>
            <div>
              <span>Votre économie</span>
              <strong className={styles.promotionSaving}>
                −{formatPrice(promotion.discount)}
              </strong>
            </div>
            <div>
              <span>Total provisoire</span>
              <strong>{formatPrice(state!.provisionalTotal)}</strong>
            </div>
          </div>
        )}

        {promotion && discount === 0 && (
          <div className={styles.promotionShipping}>
            <TicketPercent size={16} aria-hidden="true" />
            <p>
              Code validé. L’avantage sur la livraison sera calculé dès que vous
              aurez choisi votre mode de livraison.
            </p>
          </div>
        )}

        {issue && (
          <p className={styles.promotionError} role="alert">
            {issue.message}
          </p>
        )}

        {message && (
          <p className={styles.promotionError} role="alert">
            {message}
          </p>
        )}
      </section>
    );
  }

  return (
    <div className={styles.promotionEntry}>
      <button
        type="button"
        className={styles.promotionTrigger}
        aria-expanded={open}
        aria-controls="cart-promotion-panel"
        onClick={() => {
          setOpen((current) => !current);
          setMessage('');
        }}
      >
        <span className={styles.promotionTriggerIcon} aria-hidden="true">
          <TicketPercent size={17} />
        </span>
        <span>
          <strong>Ajouter un code promo</strong>
          <small>Vous pourrez aussi le modifier avant le paiement</small>
        </span>
        <ChevronDown
          size={17}
          className={open ? styles.promotionChevronOpen : undefined}
          aria-hidden="true"
        />
      </button>

      {open && (
        <form
          id="cart-promotion-panel"
          className={styles.promotionPanel}
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
              onChange={(event) => {
                setCode(event.target.value.toUpperCase());
                if (message) setMessage('');
              }}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={40}
              placeholder="Ex. BIENVENUE10"
              aria-invalid={Boolean(message)}
              aria-describedby={
                message
                  ? 'cart-promotion-message'
                  : 'cart-promotion-description'
              }
              autoFocus
            />

            <button type="submit" disabled={pending || !code.trim()}>
              {pending ? 'Vérification…' : 'Appliquer'}
            </button>
          </div>

          <p
            id="cart-promotion-description"
            className={styles.promotionHint}
          >
            La remise est calculée côté serveur et sera revérifiée avant le
            paiement.
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
      )}
    </div>
  );
}
