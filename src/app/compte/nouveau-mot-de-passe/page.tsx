import type { Metadata } from 'next';
import Link from 'next/link';
import { AccountField, AccountForm } from '@/components/account/AccountForm';
import { AccountShell } from '@/components/account/AccountShell';
import { LinkTokenInput } from '@/components/auth/LinkTokenInput';
import { resetPasswordAction } from '@/lib/account/actions';
import { PASSWORD_MAX, PASSWORD_MIN } from '@/lib/account/validation';
import styles from '@/components/account/Account.module.scss';

export const metadata: Metadata = { title: 'Nouveau mot de passe' };

// The token arrives in the link fragment (#token=), read in the browser.
export default function ResetPasswordPage() {
  return (
    <AccountShell
      title="Nouveau mot de passe"
      lead="Choisissez le mot de passe de votre compte. Tous vos appareils connectés seront déconnectés et un e-mail de confirmation vous sera envoyé."
    >
      <AccountForm action={resetPasswordAction} submit="Enregistrer" wide>
        <LinkTokenInput
          className={styles.error}
          missing={
            <>
              Ce lien est incomplet : ouvrez le lien complet reçu par e-mail, ou{' '}
              <Link href="/compte/mot-de-passe-oublie">
                demandez-en un nouveau
              </Link>
              .
            </>
          }
        />
        <AccountField
          label="Nouveau mot de passe"
          name="password"
          type="password"
          autoComplete="new-password"
          hint={`${PASSWORD_MIN} caractères minimum. Un mot de passe déjà exposé dans une fuite de données est refusé.`}
          minLength={PASSWORD_MIN}
          maxLength={PASSWORD_MAX}
        />
        <AccountField
          label="Confirmation"
          name="confirmation"
          type="password"
          autoComplete="new-password"
          minLength={PASSWORD_MIN}
          maxLength={PASSWORD_MAX}
        />
      </AccountForm>
      <p className={styles.links}>
        <Link href="/compte/mot-de-passe-oublie">Demander un nouveau lien</Link>
      </p>
    </AccountShell>
  );
}
