import type { Metadata } from 'next';
import Link from 'next/link';
import { AccountField, AccountForm } from '@/components/account/AccountForm';
import { AccountShell } from '@/components/account/AccountShell';
import { requestPasswordResetAction } from '@/lib/account/actions';
import styles from '@/components/account/Account.module.scss';

export const metadata: Metadata = { title: 'Mot de passe oublié' };

export default function ForgotPasswordPage() {
  return (
    <AccountShell
      title="Mot de passe oublié"
      lead="Indiquez l’adresse e-mail de votre compte : vous recevrez un lien pour choisir un nouveau mot de passe."
    >
      <div className={styles.card}>
        <AccountForm
          action={requestPasswordResetAction}
          submit="Recevoir le lien"
          done
        >
          <AccountField
            label="Adresse e-mail"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
          />
        </AccountForm>
      </div>
      <div className={styles.links}>
        <Link href="/compte/connexion">Retour à la connexion</Link>
      </div>
    </AccountShell>
  );
}
