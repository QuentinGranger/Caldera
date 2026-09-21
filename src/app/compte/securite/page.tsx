import type { Metadata } from 'next';
import {
  DeleteAccountForm,
  PasswordForm,
} from '@/components/account/CustomerForm';
import {
  changePasswordAction,
  deleteAccountAction,
} from '@/lib/auth/customer/actions';
import styles from '@/components/account/Account.module.scss';
export const metadata: Metadata = {
  title: 'Sécurité | Les Terres de Caldera',
  robots: { index: false, follow: false },
};
export default function SecurityPage() {
  return (
    <>
      <header className={styles.heading}>
        <p className={styles.eyebrow}>MON COMPTE</p>
        <h1>Sécurité</h1>
        <p>Modifiez votre mot de passe ou désactivez votre compte.</p>
      </header>
      <section className={styles.card}>
        <h2>Modifier mon mot de passe</h2>
        <p>
          Par mesure de sécurité, toutes les sessions existantes seront fermées
          après cette opération.
        </p>
        <PasswordForm action={changePasswordAction} />
      </section>
      <section className={styles.card}>
        <h2>Désactiver mon compte</h2>
        <p>
          Vos commandes historiques sont conservées sans rester liées à votre
          profil. Cette action est irréversible depuis cet espace.
        </p>
        <DeleteAccountForm action={deleteAccountAction} />
      </section>
    </>
  );
}
