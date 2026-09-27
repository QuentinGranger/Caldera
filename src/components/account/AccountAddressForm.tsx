'use client';
import { useRef, useState, useTransition } from 'react';
import { AddressForm } from '@/components/checkout/AddressForm';
import checkoutStyles from '@/components/checkout/Checkout.module.scss';
import { saveAddressAction } from '@/lib/account/actions';
import type { AccountActionState } from '@/lib/account/validation';
import type { AddressValues, CountryView } from '@/lib/checkout/types';
import styles from './Account.module.scss';

/** Default delivery address, with the checkout fields and rules. */
export function AccountAddressForm({
  initial,
  countries,
}: {
  initial: AddressValues;
  countries: CountryView[];
}) {
  const [address, setAddress] = useState(initial);
  const [result, setResult] = useState<AccountActionState | null>(null);
  const [pending, startTransition] = useTransition();
  const message = useRef<HTMLDivElement>(null);
  const errors = result?.errors ?? {};
  return (
    <form
      noValidate
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          let next: AccountActionState;
          try {
            next = await saveAddressAction(address);
          } catch {
            next = {
              success: false,
              message:
                'Impossible de joindre le serveur. Vérifiez votre connexion puis réessayez.',
            };
          }
          setResult(next);
          requestAnimationFrame(() => message.current?.focus());
        });
      }}
    >
      {result?.message && (
        <div
          ref={message}
          tabIndex={-1}
          role={result.success ? 'status' : 'alert'}
          className={result.success ? styles.success : styles.error}
        >
          <p>{result.message}</p>
          {Object.keys(errors).length > 0 && (
            <ul>
              {Object.entries(errors).map(([field, text]) => (
                <li key={field}>
                  <a href={`#${field}`}>{text}</a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <fieldset disabled={pending} className={styles.fieldset}>
        <AddressForm
          prefix="shipping"
          value={address}
          countries={countries}
          errors={errors}
          onChange={setAddress}
        />
        <div className={checkoutStyles.fields}>
          <div className={checkoutStyles.full}>
            <label htmlFor="shipping.phone">Téléphone — facultatif</label>
            <input
              id="shipping.phone"
              name="shipping.phone"
              type="tel"
              inputMode="tel"
              autoComplete="shipping tel"
              maxLength={32}
              value={address.phone}
              aria-invalid={Boolean(errors['shipping.phone'])}
              aria-describedby={
                errors['shipping.phone'] ? 'shipping.phone-error' : undefined
              }
              onChange={(event) =>
                setAddress({ ...address, phone: event.target.value })
              }
            />
            {errors['shipping.phone'] && (
              <p id="shipping.phone-error" className={styles.fieldError}>
                {errors['shipping.phone']}
              </p>
            )}
          </div>
        </div>
        <button type="submit" className={styles.submit}>
          {pending ? 'Un instant…' : 'Enregistrer l’adresse'}
        </button>
      </fieldset>
    </form>
  );
}
