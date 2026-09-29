import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { AccountField, AccountForm } from '@/components/account/AccountForm';
import { AccountShell } from '@/components/account/AccountShell';
import { LinkTokenInput } from '@/components/auth/LinkTokenInput';
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
      lead="Une dernière étape : confirmez votre adresse e-mail pour activer votre compte. Le lien reçu est valable 24 heures."
    >
      <AccountForm
        action={verifyEmailAction}
        submit="Confirmer mon adresse"
        wide
      >
        <LinkTokenInput
          fallback={typeof token === 'string' ? token : ''}
          className={styles.error}
          missing="Ce lien est incomplet : ouvrez le lien complet reçu par e-mail, ou demandez-en un nouveau ci-dessous."
        />
      </AccountForm>
      <details className={styles.resend}>
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
