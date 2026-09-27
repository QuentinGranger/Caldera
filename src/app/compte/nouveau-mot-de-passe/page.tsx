import type { Metadata } from 'next';
import Link from 'next/link';
import { AccountField, AccountForm } from '@/components/account/AccountForm';
import { AccountShell } from '@/components/account/AccountShell';
import { resetPasswordAction } from '@/lib/account/actions';
import { PASSWORD_MAX, PASSWORD_MIN } from '@/lib/account/validation';
import styles from '@/components/account/Account.module.scss';

export const metadata: Metadata = { title: 'Nouveau mot de passe' };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ResetPasswordPage({ searchParams }: Props) {
  const { token } = await searchParams;
  if (typeof token !== 'string' || !token)
    return (
      <AccountShell
        title="Lien incomplet"
        lead="Ce lien ne contient pas de jeton valable. Ouvrez le lien complet reçu par e-mail, ou demandez-en un nouveau."
      >
        <div className={styles.links}>
          <Link href="/compte/mot-de-passe-oublie">
            Demander un nouveau lien
          </Link>
        </div>
      </AccountShell>
    );
  return (
    <AccountShell
      title="Nouveau mot de passe"
      lead="Choisissez le mot de passe de votre compte. Vos appareils connectés seront déconnectés."
    >
      <div className={styles.card}>
        <AccountForm action={resetPasswordAction} submit="Enregistrer">
          <input type="hidden" name="token" value={token} />
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
            minLength={PASSWORD_MIN}
            maxLength={PASSWORD_MAX}
          />
        </AccountForm>
      </div>
      <div className={styles.links}>
        <Link href="/compte/mot-de-passe-oublie">Demander un nouveau lien</Link>
      </div>
    </AccountShell>
  );
}
