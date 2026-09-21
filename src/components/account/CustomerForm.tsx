'use client';

import { useActionState } from 'react';
import type { CustomerActionState } from '@/lib/auth/customer/actions';
import styles from './Account.module.scss';

type Action = (
  state: CustomerActionState,
  formData: FormData,
) => Promise<CustomerActionState>;

export function CustomerAuthForm({
  action,
  mode,
  next,
  token,
}: {
  action: Action;
  mode: 'login' | 'register' | 'reset-request' | 'reset';
  next?: string;
  token?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {
    success: false,
    message: '',
  });
  return (
    <form className={styles.form} action={formAction} aria-busy={pending}>
      {next && <input type="hidden" name="next" value={next} />}
      {token && <input type="hidden" name="token" value={token} />}
      {mode === 'register' && (
        <div className={styles.fields}>
          <Field name="firstName" label="Prénom" autoComplete="given-name" />
          <Field name="lastName" label="Nom" autoComplete="family-name" />
        </div>
      )}
      <div className={styles.field}>
        <label htmlFor="account-email">Adresse email</label>
        <input
          id="account-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
        />
      </div>
      {mode === 'login' && (
        <div className={styles.field}>
          <label htmlFor="account-password">Mot de passe</label>
          <input
            id="account-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
          />
        </div>
      )}
      {mode === 'register' && (
        <div className={styles.fields}>
          <div className={styles.field}>
            <label htmlFor="account-password">Mot de passe</label>
            <input
              id="account-password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={10}
              required
              maxLength={128}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="account-confirmation">Confirmation</label>
            <input
              id="account-confirmation"
              name="confirmation"
              type="password"
              autoComplete="new-password"
              minLength={10}
              required
              maxLength={128}
            />
          </div>
        </div>
      )}
      {mode === 'reset' && (
        <div className={styles.fields}>
          <div className={styles.field}>
            <label htmlFor="account-password">Nouveau mot de passe</label>
            <input
              id="account-password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={10}
              required
              maxLength={128}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="account-confirmation">Confirmation</label>
            <input
              id="account-confirmation"
              name="confirmation"
              type="password"
              autoComplete="new-password"
              minLength={10}
              required
              maxLength={128}
            />
          </div>
        </div>
      )}
      {state.message && (
        <p
          role={state.success ? 'status' : 'alert'}
          className={`${styles.message} ${state.success ? '' : styles.error}`}
        >
          {state.message}
        </p>
      )}
      <button className={styles.button} type="submit" disabled={pending}>
        {pending
          ? 'Un instant…'
          : mode === 'login'
            ? 'Se connecter'
            : mode === 'register'
              ? 'Créer mon compte'
              : mode === 'reset-request'
                ? 'Recevoir le lien'
                : 'Réinitialiser le mot de passe'}
      </button>
    </form>
  );
}

function Field({
  name,
  label,
  autoComplete,
}: {
  name: string;
  label: string;
  autoComplete: string;
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={`account-${name}`}>{label}</label>
      <input
        id={`account-${name}`}
        name={name}
        autoComplete={autoComplete}
        required
        maxLength={80}
      />
    </div>
  );
}

export function ProfileForm({
  action,
  customer,
}: {
  action: Action;
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
  };
}) {
  const [state, formAction, pending] = useActionState(action, {
    success: false,
    message: '',
  });
  return (
    <form className={styles.form} action={formAction} aria-busy={pending}>
      <div className={styles.fields}>
        <div className={styles.field}>
          <label htmlFor="profile-firstName">Prénom</label>
          <input
            id="profile-firstName"
            name="firstName"
            defaultValue={customer.firstName}
            autoComplete="given-name"
            required
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="profile-lastName">Nom</label>
          <input
            id="profile-lastName"
            name="lastName"
            defaultValue={customer.lastName}
            autoComplete="family-name"
            required
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="profile-email">Email</label>
          <input
            id="profile-email"
            name="email"
            type="email"
            defaultValue={customer.email}
            autoComplete="email"
            required
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="profile-phone">Téléphone — facultatif</label>
          <input
            id="profile-phone"
            name="phone"
            type="tel"
            defaultValue={customer.phone ?? ''}
            autoComplete="tel"
          />
        </div>
      </div>
      {state.message && (
        <p
          role={state.success ? 'status' : 'alert'}
          className={`${styles.message} ${state.success ? '' : styles.error}`}
        >
          {state.message}
        </p>
      )}
      <button className={styles.button} type="submit" disabled={pending}>
        {pending ? 'Enregistrement…' : 'Enregistrer le profil'}
      </button>
    </form>
  );
}

export function PasswordForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, {
    success: false,
    message: '',
  });
  return (
    <form className={styles.form} action={formAction} aria-busy={pending}>
      <div className={styles.field}>
        <label htmlFor="current-password">Mot de passe actuel</label>
        <input
          id="current-password"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <div className={styles.fields}>
        <div className={styles.field}>
          <label htmlFor="new-password">Nouveau mot de passe</label>
          <input
            id="new-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={10}
            required
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="new-password-confirmation">Confirmation</label>
          <input
            id="new-password-confirmation"
            name="confirmation"
            type="password"
            autoComplete="new-password"
            minLength={10}
            required
          />
        </div>
      </div>
      {state.message && (
        <p
          role={state.success ? 'status' : 'alert'}
          className={`${styles.message} ${state.success ? '' : styles.error}`}
        >
          {state.message}
        </p>
      )}
      <button className={styles.button} type="submit" disabled={pending}>
        {pending ? 'Enregistrement…' : 'Modifier le mot de passe'}
      </button>
    </form>
  );
}

export function DeleteAccountForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, {
    success: false,
    message: '',
  });
  return (
    <form className={styles.form} action={formAction} aria-busy={pending}>
      <div className={styles.field}>
        <label htmlFor="delete-current-password">Mot de passe actuel</label>
        <input
          id="delete-current-password"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="delete-confirmation">
          Écrivez SUPPRIMER pour confirmer
        </label>
        <input
          id="delete-confirmation"
          name="confirmation"
          autoComplete="off"
          required
        />
      </div>
      {state.message && (
        <p
          role={state.success ? 'status' : 'alert'}
          className={`${styles.message} ${state.success ? '' : styles.error}`}
        >
          {state.message}
        </p>
      )}
      <button
        className={`${styles.button} ${styles.dangerButton}`}
        type="submit"
        disabled={pending}
      >
        {pending ? 'Traitement…' : 'Désactiver mon compte'}
      </button>
    </form>
  );
}

export function AddressForm({
  action,
  address,
}: {
  action: Action;
  address?: Record<string, string | boolean | null>;
}) {
  const [state, formAction, pending] = useActionState(action, {
    success: false,
    message: '',
  });
  const value = (key: string) => String(address?.[key] ?? '');
  return (
    <form className={styles.form} action={formAction} aria-busy={pending}>
      {address?.id && <input type="hidden" name="id" value={value('id')} />}
      <div className={styles.fields}>
        <div className={styles.field}>
          <label htmlFor="address-label">Nom de l’adresse</label>
          <input
            id="address-label"
            name="label"
            defaultValue={value('label')}
            placeholder="Maison"
            required
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="address-firstName">Prénom</label>
          <input
            id="address-firstName"
            name="firstName"
            defaultValue={value('firstName')}
            autoComplete="given-name"
            required
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="address-lastName">Nom</label>
          <input
            id="address-lastName"
            name="lastName"
            defaultValue={value('lastName')}
            autoComplete="family-name"
            required
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="address-company">Société — facultatif</label>
          <input
            id="address-company"
            name="company"
            defaultValue={value('company')}
            autoComplete="organization"
          />
        </div>
        <div className={`${styles.field} ${styles.fieldFull}`}>
          <label htmlFor="address-line1">Adresse</label>
          <input
            id="address-line1"
            name="addressLine1"
            defaultValue={value('addressLine1')}
            autoComplete="street-address"
            required
          />
        </div>
        <div className={`${styles.field} ${styles.fieldFull}`}>
          <label htmlFor="address-line2">Complément — facultatif</label>
          <input
            id="address-line2"
            name="addressLine2"
            defaultValue={value('addressLine2')}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="address-postal">Code postal</label>
          <input
            id="address-postal"
            name="postalCode"
            defaultValue={value('postalCode')}
            autoComplete="postal-code"
            required
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="address-city">Ville</label>
          <input
            id="address-city"
            name="city"
            defaultValue={value('city')}
            autoComplete="address-level2"
            required
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="address-region">Région — facultatif</label>
          <input
            id="address-region"
            name="region"
            defaultValue={value('region')}
            autoComplete="address-level1"
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="address-country">Pays</label>
          <select
            id="address-country"
            name="countryCode"
            defaultValue={value('countryCode') || 'FR'}
            autoComplete="country"
          >
            <option value="FR">France</option>
            <option value="BE">Belgique</option>
            <option value="LU">Luxembourg</option>
            <option value="CH">Suisse</option>
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor="address-phone">Téléphone — facultatif</label>
          <input
            id="address-phone"
            name="phone"
            type="tel"
            defaultValue={value('phone')}
            autoComplete="tel"
          />
        </div>
      </div>
      <label className={styles.check}>
        <input
          type="checkbox"
          name="isDefaultShipping"
          defaultChecked={Boolean(address?.isDefaultShipping)}
        />{' '}
        Adresse de livraison par défaut
      </label>
      <label className={styles.check}>
        <input
          type="checkbox"
          name="isDefaultBilling"
          defaultChecked={Boolean(address?.isDefaultBilling)}
        />{' '}
        Adresse de facturation par défaut
      </label>
      {state.message && (
        <p
          role={state.success ? 'status' : 'alert'}
          className={`${styles.message} ${state.success ? '' : styles.error}`}
        >
          {state.message}
        </p>
      )}
      <button className={styles.button} type="submit" disabled={pending}>
        {pending
          ? 'Enregistrement…'
          : address
            ? 'Enregistrer l’adresse'
            : 'Ajouter l’adresse'}
      </button>
    </form>
  );
}
