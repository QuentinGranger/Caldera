'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button/Button';
import { saveContactAction } from '@/lib/checkout/actions';
import { emptyAddress, type CheckoutView } from '@/lib/checkout/types';
import { AddressForm } from './AddressForm';
import { useCheckoutAction } from './useCheckoutAction';
import styles from './Checkout.module.scss';
export function CheckoutContactForm({ view }: { view: CheckoutView }) {
  const [contact, setContact] = useState(view.contact);
  const { execute, pending, result } = useCheckoutAction();
  const errorSummary = useRef<HTMLDivElement>(null);
  const errors = result?.errors ?? {};
  useEffect(() => {
    if (result && !result.success) errorSummary.current?.focus();
  }, [result]);
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        execute(() => saveContactAction(view.sessionId, contact));
      }}
    >
      {result && !result.success && (
        <div
          ref={errorSummary}
          tabIndex={-1}
          role="alert"
          className={styles.errorSummary}
        >
          <p>{result.message}</p>
          <ul>
            {Object.entries(errors).map(([field, message]) => (
              <li key={field}>
                <a href={`#${field}`}>{message}</a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <fieldset disabled={pending} className={styles.formSection}>
        <legend>Votre contact</legend>
        <p className={styles.hint}>
          Sans création de compte. Les champs marqués * sont obligatoires.
        </p>
        <div className={styles.fields}>
          <div className={styles.full}>
            <label htmlFor="email">Adresse email *</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              maxLength={254}
              value={contact.email}
              required
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'email-error' : undefined}
              onChange={(event) =>
                setContact({ ...contact, email: event.target.value })
              }
            />
            {errors.email && (
              <p id="email-error" className={styles.fieldError}>
                {errors.email}
              </p>
            )}
          </div>
          <div className={styles.full}>
            <label htmlFor="phone">Téléphone — facultatif</label>
            <input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              maxLength={32}
              value={contact.phone}
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={errors.phone ? 'phone-error' : undefined}
              onChange={(event) =>
                setContact({ ...contact, phone: event.target.value })
              }
            />
            {errors.phone && (
              <p id="phone-error" className={styles.fieldError}>
                {errors.phone}
              </p>
            )}
          </div>
        </div>
      </fieldset>
      <fieldset disabled={pending} className={styles.formSection}>
        <legend>Adresse de livraison</legend>
        <AddressForm
          prefix="shipping"
          value={contact.shipping}
          countries={view.countries}
          errors={errors}
          onChange={(shipping) => setContact({ ...contact, shipping })}
        />
      </fieldset>
      <fieldset disabled={pending} className={styles.formSection}>
        <legend>Adresse de facturation</legend>
        <label className={styles.checkbox} htmlFor="billingSame">
          <input
            type="checkbox"
            id="billingSame"
            name="billingSame"
            checked={contact.billingSame}
            onChange={(event) =>
              setContact({
                ...contact,
                billingSame: event.target.checked,
                billing: contact.billing ?? emptyAddress(),
              })
            }
          />
          Utiliser la même adresse pour la facturation
        </label>
        {!contact.billingSame && (
          <AddressForm
            prefix="billing"
            value={contact.billing ?? emptyAddress()}
            countries={view.countries}
            errors={errors}
            onChange={(billing) => setContact({ ...contact, billing })}
          />
        )}
      </fieldset>
      <div className={styles.actions}>
        <Link href="/panier">Retour au panier</Link>
        <Button type="submit" disabled={pending || !view.countries.length}>
          {pending ? 'Enregistrement…' : 'Continuer vers la livraison'}
        </Button>
      </div>
      {!view.countries.length && (
        <p role="status">
          Aucun pays de livraison n’est actuellement configuré.
        </p>
      )}
      <p className={styles.hint}>
        Vos informations sont conservées après validation de cette étape.
      </p>
    </form>
  );
}
