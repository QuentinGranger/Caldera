import type { Metadata } from 'next';
import Link from 'next/link';
import { AccountField, AccountForm } from '@/components/account/AccountForm';
import { AccountShell } from '@/components/account/AccountShell';
import {
  resendVerificationAction,
  verifyEmailAction,
} from '@/lib/account/actions';
import styles from '@/components/account/Account.module.scss';

export const metadata: Metadata = { title: 'Confirmer votre adresse' };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// Confirmation needs a click: mail scanners that open links do not consume it.
export default async function VerifyEmailPage({ searchParams }: Props) {
  const { token } = await searchParams;
  return (
    <AccountShell
      title="Confirmer votre adresse"
      lead="Une dernière étape : confirmez votre adresse e-mail pour activer votre compte."
    >
      {typeof token === 'string' && token && (
        <div className={styles.card}>
          <AccountForm
            action={verifyEmailAction}
            submit="Confirmer mon adresse"
          >
            <input type="hidden" name="token" value={token} />
          </AccountForm>
        </div>
      )}
      <h2 className={styles.subheading}>Lien expiré ou perdu ?</h2>
      <div className={styles.card}>
        <AccountForm
          action={resendVerificationAction}
          submit="Recevoir un nouveau lien"
          done
        >
          <AccountField
            label="Adresse e-mail du compte"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
          />
        </AccountForm>
      </div>
      <div className={styles.links}>
        <Link href="/compte/connexion">Se connecter</Link>
      </div>
    </AccountShell>
  );
}
