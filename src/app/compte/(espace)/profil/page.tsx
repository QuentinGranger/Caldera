import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronDown, Lock } from 'lucide-react';
import { AccountField, AccountForm } from '@/components/account/AccountForm';
import {
  changePasswordAction,
  deleteAccountAction,
  updateNameAction,
} from '@/lib/account/actions';
import { requireCustomer } from '@/lib/account/guard';
import { NAME_MAX, PASSWORD_MAX, PASSWORD_MIN } from '@/lib/account/validation';
import styles from '@/components/account/Account.module.scss';

export const metadata: Metadata = { title: 'Profil et sécurité' };

export default async function AccountProfile() {
  const customer = await requireCustomer('/compte/profil');
  return (
    <>
      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>Mon compte</p>
        <h1 className={styles.title}>Profil et sécurité</h1>
      </header>

      <section className={styles.panel} aria-labelledby="informations">
        <h2 id="informations">Informations personnelles</h2>
        <div className={styles.readonly}>
          <span className={styles.readonlyLabel}>Adresse e-mail</span>
          <span className={styles.readonlyValue}>
            <Lock size={14} aria-hidden="true" />
            {customer.email}
          </span>
          <span className={styles.hint}>
            Pour la changer, <Link href="/contact">écrivez-nous</Link> : nous
            vérifierons votre identité.
          </span>
        </div>
        <AccountForm action={updateNameAction} submit="Enregistrer" id="profil">
          <AccountField
            label="Nom"
            name="name"
            autoComplete="name"
            defaultValue={customer.name}
            maxLength={NAME_MAX}
          />
        </AccountForm>
      </section>

      <section className={styles.panel} aria-labelledby="mot-de-passe">
        <h2 id="mot-de-passe">Mot de passe</h2>
        <p className={styles.panelLead}>
          Après le changement, vos autres appareils sont déconnectés.
        </p>
        <AccountForm
          action={changePasswordAction}
          submit="Changer le mot de passe"
          resetOnSuccess
          id="securite"
        >
          <AccountField
            label="Mot de passe actuel"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            maxLength={PASSWORD_MAX}
          />
          <div className={styles.pair}>
            <AccountField
              label="Nouveau mot de passe"
              name="password"
              type="password"
              autoComplete="new-password"
              hint={`${PASSWORD_MIN} caractères minimum.`}
              minLength={PASSWORD_MIN}
              maxLength={PASSWORD_MAX}
            />
            <AccountField
              label="Confirmation"
              name="confirmation"
              type="password"
              autoComplete="new-password"
              hint="Le même, une seconde fois."
              minLength={PASSWORD_MIN}
              maxLength={PASSWORD_MAX}
            />
          </div>
        </AccountForm>
      </section>

      <details className={styles.dangerZone}>
        <summary>
          Supprimer mon compte
          <ChevronDown size={18} aria-hidden="true" />
        </summary>
        <div className={styles.dangerBody}>
          <p>
            Votre compte, votre adresse enregistrée et vos sessions sont effacés
            immédiatement et définitivement. Vos commandes restent conservées le
            temps imposé par la loi (factures), sans lien avec un compte.
          </p>
          <AccountForm
            action={deleteAccountAction}
            submit="Supprimer définitivement"
            danger
            id="suppression-compte"
          >
            <AccountField
              label="Mot de passe, pour confirmer"
              name="password"
              type="password"
              autoComplete="current-password"
              maxLength={PASSWORD_MAX}
            />
          </AccountForm>
        </div>
      </details>
    </>
  );
}
