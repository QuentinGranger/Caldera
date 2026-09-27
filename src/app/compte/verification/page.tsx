import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
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
  const hasToken = typeof token === 'string' && token !== '';
  return (
    <AccountShell
      title="Confirmer votre adresse"
      lead={
        hasToken
          ? 'Une dernière étape : confirmez votre adresse e-mail pour activer votre compte.'
          : 'Demandez un nouveau lien de confirmation : il est valable 24 heures.'
      }
    >
      {hasToken && (
        <AccountForm
          action={verifyEmailAction}
          submit="Confirmer mon adresse"
          wide
        >
          <input type="hidden" name="token" value={token} />
        </AccountForm>
      )}
      <details className={styles.resend} open={!hasToken}>
        <summary>
          Lien expiré ou perdu ?
          <ChevronDown size={16} aria-hidden="true" />
        </summary>
        <AccountForm
          action={resendVerificationAction}
          submit="Recevoir un nouveau lien"
          done
          wide
        >
          <AccountField
            label="Adresse e-mail du compte"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
          />
        </AccountForm>
      </details>
      <p className={styles.links}>
        <Link href="/compte/connexion">Se connecter</Link>
      </p>
    </AccountShell>
  );
}
